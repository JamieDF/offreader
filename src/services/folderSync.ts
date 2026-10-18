import { Capacitor } from "@capacitor/core";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/toast";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { fileStorage } from "@/services/fileStorage";
import { safFiles } from "@/services/safFiles";
import { deleteBookData, deleteBookTracking, saveBook, saveStoredBooks } from "@/services/bookPersistence";
import { sha256Hex } from "@/utils/hash";
import { toastImportError } from "@/services/bookImport";
import { extractBookMetadata } from "@/parsers/bookMetadataParser";
import { calculateReadingMetrics } from "@/utils/readingMetrics";
import { PdfMetadata } from "@/parsers/pdfParser";
import { EpubMetadata } from "@/parsers/epubParser";
import { MobiMetadata } from "@/parsers/mobiParser";
import { Azw3Metadata } from "@/parsers/azw3Parser";
import { Fb2Metadata } from "@/parsers/fb2Parser";
import { CbzMetadata } from "@/parsers/cbzParser";

/**
 * Folder sync: the linked-mode feature proper (Electron only). A watched
 * folder's book files are cataloged in place: new files become linked books,
 * a file that moved or was renamed is re-found by content hash (the
 * `sourcePath` is repointed, progress intact), and a file that vanished marks
 * its book `missing`: never silently deleted.
 */

const SYNC_FOLDERS_KEY = 'offreader-sync-folders';
const SYNC_FAILURES_KEY = 'offreader-sync-failures';
const SYNC_DUPS_KEY = 'offreader-sync-dups';

/** A file that failed to import. Retried only when mtime/size change: an
 *  unchanged known-bad file is skipped silently so every rescan doesn't
 *  re-toast the same error. */
interface ScanFailure { mtimeMs: number; size: number }

/** Failure map lives at module scope: the background index queue mutates it
 *  long after the scan call that queued the work has returned. Loads once,
 *  persists through a serialized write chain so concurrent scan/queue
 *  updates can't tear the stored JSON. */
let failuresCache: Record<string, ScanFailure> | null = null;
let failuresWrite: Promise<unknown> = Promise.resolve();

async function getSyncFailures(): Promise<Record<string, ScanFailure>> {
  if (!failuresCache) {
    try {
      const stored = await storageService.getItem(SYNC_FAILURES_KEY);
      failuresCache = stored ? JSON.parse(stored) : {};
    } catch {
      failuresCache = {};
    }
  }
  return failuresCache;
}

function persistSyncFailures(): void {
  failuresWrite = failuresWrite.then(() =>
    storageService.setItem(SYNC_FAILURES_KEY, JSON.stringify(failuresCache ?? {}))
  ).catch(() => {});
}

/** Record a failure for `path`. Returns true when it's worth telling the
 *  user about: new path, or the file changed since the last failure. */
async function noteSyncFailure(path: string, stat: ScanFailure): Promise<boolean> {
  const failures = await getSyncFailures();
  const prev = failures[path];
  failures[path] = stat;
  persistSyncFailures();
  return !prev || prev.mtimeMs !== stat.mtimeMs || prev.size !== stat.size;
}

async function clearSyncFailure(path: string): Promise<void> {
  const failures = await getSyncFailures();
  if (failures[path]) {
    delete failures[path];
    persistSyncFailures();
  }
}

/** Drop failure entries for files that no longer exist under `dirPath`. */
async function pruneSyncFailures(dirPath: string, entryPaths: Set<string>): Promise<void> {
  const failures = await getSyncFailures();
  let dirty = false;
  for (const p of Object.keys(failures)) {
    if (isUnderFolder(p, dirPath) && !entryPaths.has(p)) {
      delete failures[p];
      dirty = true;
    }
  }
  if (dirty) persistSyncFailures();
}

/** A file whose bytes already belong to another book: remembered so rescans
 *  skip it without a re-read. The marker only holds while the stat is
 *  unchanged AND the matched book still exists: deleting that book lets the
 *  file import again on the next scan. */
interface SyncDup extends ScanFailure { bookId: string }

let dupsCache: Record<string, SyncDup> | null = null;
let dupsWrite: Promise<unknown> = Promise.resolve();

async function getSyncDups(): Promise<Record<string, SyncDup>> {
  if (!dupsCache) {
    try {
      const stored = await storageService.getItem(SYNC_DUPS_KEY);
      dupsCache = stored ? JSON.parse(stored) : {};
    } catch {
      dupsCache = {};
    }
  }
  return dupsCache;
}

function persistSyncDups(): void {
  dupsWrite = dupsWrite.then(() =>
    storageService.setItem(SYNC_DUPS_KEY, JSON.stringify(dupsCache ?? {}))
  ).catch(() => {});
}

async function noteSyncDup(path: string, stat: ScanFailure, bookId: string): Promise<void> {
  const dups = await getSyncDups();
  dups[path] = { ...stat, bookId };
  persistSyncDups();
}

async function pruneSyncDups(dirPath: string, entryPaths: Set<string>): Promise<void> {
  const dups = await getSyncDups();
  let dirty = false;
  for (const p of Object.keys(dups)) {
    if (isUnderFolder(p, dirPath) && !entryPaths.has(p)) {
      delete dups[p];
      dirty = true;
    }
  }
  if (dirty) persistSyncDups();
}

/** Format from a filename's extension, or null for non-book files (SAF
 *  trees can contain anything; Electron's scan already filters). */
function formatForName(name: string): Book['format'] | null {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.epub': return 'EPUB';
    case '.pdf': return 'PDF';
    case '.mobi': return 'MOBI';
    case '.azw3': return 'AZW3';
    case '.fb2': return 'FB2';
    case '.cbz': return 'CBZ';
    default: return null;
  }
}

/** Folder sync exists on Electron (real paths + watchers) and Android (SAF
 *  document trees, scan-on-open: SAF has no watch primitive). */
export function supportsFolderSync(): boolean {
  return !!window.offreaderFiles || Capacitor.getPlatform() === 'android';
}

/** Pick a sync folder: native directory dialog on desktop, SAF tree picker
 *  on Android (returns a persisted content:// URI). */
export async function pickSyncDirectory(): Promise<string | null> {
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { treeUri } = await safFiles.pickDirectory();
      return treeUri;
    } catch {
      return null; // user cancelled
    }
  }
  return window.offreaderFiles?.pickDirectory() ?? null;
}

/** True if `sourcePath` lives under the synced folder. On Android both are
 *  content:// URIs: a tree `…/tree/<id>` yields documents `…/document/<id>%2F…`
 *  so containment is a doc-id prefix test, not a path prefix. */
export function isUnderFolder(sourcePath: string, folderPath: string): boolean {
  if (folderPath.startsWith('content://')) {
    const treeId = folderPath.split('/tree/')[1];
    if (!treeId) return false;
    return sourcePath.includes(`${encodeURIComponent(decodeURIComponent(treeId))}%2F`);
  }
  const sep = folderPath.includes('\\') ? '\\' : '/';
  const prefix = folderPath.endsWith(sep) ? folderPath : folderPath + sep;
  return sourcePath.startsWith(prefix);
}

/** Human-friendly folder label for toasts and lists: SAF tree URIs encode
 *  the path in their id (…/tree/primary%3ABooks%2Fsub → "sub"); desktop
 *  paths display unchanged. */
export function folderDisplayName(folderPath: string): string {
  if (folderPath.startsWith('content://')) {
    const treeId = folderPath.split('/tree/')[1];
    if (!treeId) return folderPath;
    const decoded = decodeURIComponent(treeId);
    const afterVolume = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;
    return afterVolume.split('/').filter(Boolean).pop() ?? decoded;
  }
  return folderPath;
}

export async function getSyncFolders(): Promise<string[]> {
  const stored = await storageService.getItem(SYNC_FOLDERS_KEY);
  try {
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(p => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

async function saveSyncFolders(folders: string[]): Promise<void> {
  await storageService.setItem(SYNC_FOLDERS_KEY, JSON.stringify(folders));
}

/** Add a folder to the sync list, start watching it (desktop), and scan it. */
export async function addSyncFolder(dirPath: string): Promise<string[]> {
  const folders = await getSyncFolders();
  if (!folders.includes(dirPath)) {
    folders.push(dirPath);
    await saveSyncFolders(folders);
  }
  await window.offreaderFiles?.watchFolder(dirPath);
  return folders;
}

/** Remove a folder from the sync list and stop watching. Linked books that
 *  came from it stay in the library: they're still linked by path. */
export async function removeSyncFolder(dirPath: string): Promise<string[]> {
  const folders = (await getSyncFolders()).filter(p => p !== dirPath);
  await saveSyncFolders(folders);
  await window.offreaderFiles?.unwatchFolder(dirPath);
  return folders;
}

export interface ScanResult {
  /** Stub books created for unknown files (indexed in the background). */
  added: number;
  /** Always 0 at scan time: moved files surface as a stub plus a missing
   *  book, and the index queue merges them once the hash lands. */
  moved: number;
  /** Linked books whose sourcePath vanished under this folder. */
  missing: number;
}

/**
 * Scan one folder, stat-only: unchanged known paths and known-bad files are
 * skipped, unknown files become stub books immediately (title from filename,
 * no reads). Hashing and metadata extraction are deferred to the background
 * index queue, so indexing a large folder never blocks on disk.
 */
export async function scanFolder(dirPath: string): Promise<ScanResult> {
  let entries: { path: string; name: string; size: number; mtimeMs: number }[];
  if (dirPath.startsWith('content://')) {
    if (Capacitor.getPlatform() !== 'android') return { added: 0, moved: 0, missing: 0 };
    const { files } = await safFiles.listFiles({ treeUri: dirPath });
    entries = files.map(f => ({ path: f.uri, name: f.name, size: f.size, mtimeMs: f.mtimeMs }));
  } else {
    const files = window.offreaderFiles;
    if (!files) return { added: 0, moved: 0, missing: 0 };
    entries = await files.scanFolder(dirPath);
  }
  const books = libraryService.getBooks();
  const failures = await getSyncFailures();
  const dups = await getSyncDups();
  const seenPaths = new Set<string>();
  const foundIds = new Set<string>(); // missing books whose file came back
  const stubs: Book[] = [];

  for (const entry of entries) {
    const format = formatForName(entry.name);
    if (!format) continue;

    const known = books.find(b => b.source === 'linked' && b.sourcePath === entry.path);
    if (known) {
      seenPaths.add(entry.path);
      if (known.missing) foundIds.add(known.id);
      continue;
    }

    // Unchanged known-bad file: skip silently, the index queue won't retry it.
    const prevFail = failures[entry.path];
    if (prevFail && prevFail.mtimeMs === entry.mtimeMs && prevFail.size === entry.size) {
      continue;
    }

    // Unchanged file whose bytes already belong to a book that still exists:
    // skip without the stub/drop/toast cycle.
    const prevDup = dups[entry.path];
    if (prevDup && prevDup.mtimeMs === entry.mtimeMs && prevDup.size === entry.size
        && books.some(b => b.id === prevDup.bookId)) {
      continue;
    }

    const { readingTime, pageCount } = calculateReadingMetrics(entry.size);
    const stub: Book = {
      id: uuidv4(),
      title: entry.name.replace(/\.[^/.]+$/, ''),
      author: '',
      coverImage: '',
      filePath: '',
      format,
      progress: 0,
      chapters: [],
      totalChapters: 0,
      fileSize: `${(entry.size / 1024 / 1024).toFixed(1)} MB`,
      estimatedReadingTime: readingTime,
      pageCount,
      shelfId: null,
      labelIds: [],
      source: 'linked',
      sourcePath: entry.path,
      sourceSize: entry.size,
      sourceMtimeMs: entry.mtimeMs,
      // No contentHash: that's the pending-index marker the queue drains.
    };
    stubs.push(stub);
    seenPaths.add(entry.path);
  }

  if (stubs.length > 0) {
    const withStubs = [...libraryService.getBooks(), ...stubs];
    libraryService.updateBooks(withStubs);
    await saveStoredBooks(withStubs);
    enqueueIndex(stubs.map(s => s.id));
  }

  // Linked books rooted under this folder whose file wasn't seen → missing.
  const missingIds = books
    .filter(b =>
      b.source === 'linked' &&
      b.sourcePath && isUnderFolder(b.sourcePath, dirPath) &&
      !seenPaths.has(b.sourcePath) &&
      !b.missing)
    .map(b => b.id);

  if (missingIds.length > 0 || foundIds.size > 0) {
    const updatedBooks = libraryService.getBooks().map(b => {
      if (foundIds.has(b.id)) return { ...b, missing: undefined };
      if (missingIds.includes(b.id)) return { ...b, missing: true };
      return b;
    });
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }

  const entryPaths = new Set(entries.map(e => e.path));
  await pruneSyncFailures(dirPath, entryPaths);
  await pruneSyncDups(dirPath, entryPaths);

  return { added: stubs.length, moved: 0, missing: missingIds.length };
}

/**
 * Background index queue: linked stubs (books with no contentHash) are
 * hashed and parsed one file at a time, so a huge first scan doesn't stall
 * the UI. When a hash lands it resolves identity: matching a missing book
 * repoints it (the stub was a moved file), matching a live book drops the
 * stub as a duplicate, otherwise the stub gets its real metadata.
 */
const indexQueue: string[] = [];
let indexRunning = false;

type IndexOutcome =
  | { kind: 'indexed' }
  | { kind: 'failed'; name: string; error: unknown };

export function enqueueIndex(bookIds: string[]): void {
  for (const id of bookIds) {
    if (!indexQueue.includes(id)) indexQueue.push(id);
  }
  void pumpIndexQueue();
}

/** Queue every linked book still missing its contentHash: stub survivors
 *  from a session that quit mid-index. Called at startup after the rescan
 *  so leftover work resumes without any persisted queue state. */
export function enqueuePendingIndex(): number {
  const pending = libraryService.getBooks()
    .filter(b => b.source === 'linked' && !b.contentHash && b.sourcePath)
    .map(b => b.id);
  enqueueIndex(pending);
  return pending.length;
}

async function pumpIndexQueue(): Promise<void> {
  if (indexRunning) return;
  indexRunning = true;
  const newlyFailed: { name: string; error: unknown }[] = [];
  try {
    while (indexQueue.length > 0) {
      const bookId = indexQueue.shift()!;
      const outcome = await indexStubBook(bookId);
      if (outcome?.kind === 'failed') newlyFailed.push(outcome);
      // Yield between files so library interactions stay responsive.
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    indexRunning = false;
  }
  if (newlyFailed.length === 1) {
    toastImportError(newlyFailed[0].name, newlyFailed[0].error);
  } else if (newlyFailed.length > 1) {
    toast.error(`Couldn't import ${newlyFailed.length} files from this folder`);
  }
}

/** Hash + parse one stub. Resolves identity by hash, fills real metadata,
 *  or removes/marks the record on failure. */
async function indexStubBook(bookId: string): Promise<IndexOutcome | null> {
  const book = libraryService.getBooks().find(b => b.id === bookId);
  // Gone (user deleted it) or already hashed: nothing to do.
  if (!book || book.contentHash || book.source !== 'linked' || !book.sourcePath) return null;

  const stat: ScanFailure = { mtimeMs: book.sourceMtimeMs ?? 0, size: book.sourceSize ?? 0 };
  try {
    const blob = await fileStorage.retrieveLinkedBlob(book.sourcePath);
    const contentHash = await sha256Hex(blob);
    if (!libraryService.getBooks().some(b => b.id === bookId)) return null;

    const match = libraryService.getBooks().find(b => b.id !== bookId && b.contentHash === contentHash);
    if (match) {
      if (match.missing && match.source === 'linked') {
        // The stub was this book's file at a new path: repoint the real
        // record (progress intact) and drop the stub.
        const repointed: Book = {
          ...match,
          sourcePath: book.sourcePath,
          sourceSize: book.sourceSize,
          sourceMtimeMs: book.sourceMtimeMs,
          missing: undefined,
        };
        libraryService.updateBooks(
          libraryService.getBooks().map(b => b.id === match.id ? repointed : b).filter(b => b.id !== bookId)
        );
        await saveBook(repointed);
      } else {
        libraryService.updateBooks(libraryService.getBooks().filter(b => b.id !== bookId));
        toast.info(`"${match.title}" is already in your library`);
        await noteSyncDup(book.sourcePath, stat, match.id);
      }
      await deleteBookData([bookId]);
      await deleteBookTracking([bookId]);
      return { kind: 'indexed' };
    }

    const file = new File([blob], `book.${(book.format ?? 'EPUB').toLowerCase()}`);
    const extractedMeta = await extractBookMetadata(file);
    const { title, author, publisher, pubDate, language, identifier, description, subjects, rights, chapters, totalChapters, format, coverImage } = extractedMeta as { title: string; author: string; publisher?: string; pubDate?: string; language?: string; identifier?: string; description?: string; subjects?: string[]; rights?: string; chapters: Book['chapters']; totalChapters: number; format: string; coverImage?: string };

    const pdfMeta = format === 'PDF' ? (extractedMeta as PdfMetadata) : null;
    const epubMeta = format === 'EPUB' ? (extractedMeta as EpubMetadata) : null;
    const mobiMeta = format === 'MOBI' ? (extractedMeta as MobiMetadata) : null;
    const azw3Meta = format === 'AZW3' ? (extractedMeta as Azw3Metadata) : null;
    const fb2Meta = format === 'FB2' ? (extractedMeta as Fb2Metadata) : null;
    const cbzMeta = format === 'CBZ' ? (extractedMeta as CbzMetadata) : null;
    const readingTime = pdfMeta?.readingTime ?? epubMeta?.readingTime ?? mobiMeta?.readingTime
      ?? azw3Meta?.readingTime ?? fb2Meta?.readingTime ?? cbzMeta?.readingTime;
    const parsedPageCount = pdfMeta?.pageCount ?? epubMeta?.pageCount ?? mobiMeta?.pageCount
      ?? azw3Meta?.pageCount ?? fb2Meta?.pageCount ?? cbzMeta?.pageCount;

    // Merge onto the live record: user edits made while indexing (shelf,
    // progress) survive the fill-in.
    const latest = libraryService.getBooks().find(b => b.id === bookId);
    if (!latest) return null;
    const updated: Book = {
      ...latest,
      title: title || latest.title,
      author: author || latest.author,
      format: (format as Book['format']) ?? latest.format,
      publisher, pubDate, language, identifier,
      description: description || latest.description,
      subjects, rights,
      coverImage: coverImage || latest.coverImage,
      chapters, totalChapters,
      estimatedReadingTime: readingTime ?? latest.estimatedReadingTime,
      pageCount: parsedPageCount ?? latest.pageCount,
      contentHash,
    };
    libraryService.updateBooks(libraryService.getBooks().map(b => b.id === bookId ? updated : b));
    await saveBook(updated);
    await clearSyncFailure(book.sourcePath);
    return { kind: 'indexed' };
  } catch (error) {
    console.error(`Index: failed for ${book.sourcePath}:`, error);
    if (!libraryService.getBooks().some(b => b.id === bookId)) return null;

    // File vanished between scan and index: mark missing, a later rescan can
    // re-find it. File present but unreadable: drop the stub and record the
    // failure so rescans skip it quietly.
    if (await fileStorage.bookFileExists(book)) {
      libraryService.updateBooks(libraryService.getBooks().filter(b => b.id !== bookId));
      await deleteBookData([bookId]);
      await deleteBookTracking([bookId]);
      const isNew = await noteSyncFailure(book.sourcePath, stat);
      return isNew ? { kind: 'failed', name: book.title, error } : { kind: 'indexed' };
    }
    const marked = { ...libraryService.getBooks().find(b => b.id === bookId)!, missing: true as const };
    libraryService.updateBooks(libraryService.getBooks().map(b => b.id === bookId ? marked : b));
    await saveBook(marked);
    return { kind: 'indexed' };
  }
}

/** Rescan every configured sync folder (startup + manual refresh). */
export async function syncAllFolders(): Promise<ScanResult> {
  const totals: ScanResult = { added: 0, moved: 0, missing: 0 };
  for (const dirPath of await getSyncFolders()) {
    try {
      const result = await scanFolder(dirPath);
      totals.added += result.added;
      totals.moved += result.moved;
      totals.missing += result.missing;
    } catch (error) {
      console.error(`Failed to sync folder ${dirPath}:`, error);
      toast.error(`Couldn't sync "${dirPath}"`);
    }
  }
  return totals;
}

/**
 * Convert linked books to managed: bytes are copied into the content-addressed
 * store and the record flips to 'managed'. The source file is left untouched,
 * and `sourcePath` is kept as provenance. Returns the count converted.
 */
export async function moveBooksToLibrary(bookIds: string[]): Promise<number> {
  const idSet = new Set(bookIds);
  const targets = libraryService.getBooks()
    .filter(b => idSet.has(b.id) && b.source === 'linked' && b.sourcePath);
  if (targets.length === 0) return 0;

  const movedIds = new Set<string>();
  for (const book of targets) {
    try {
      const blob = await fileStorage.retrieveLinkedBlob(book.sourcePath!);
      // Key the copy under the existing contentHash: same bytes, same slot;
      // ext comes from the format since the Blob has no filename.
      const ext = book.format === 'PDF' ? '.pdf'
        : book.format === 'MOBI' ? '.mobi'
        : book.format === 'AZW3' ? '.azw3'
        : book.format === 'FB2' ? '.fb2'
        : book.format === 'CBZ' ? '.cbz'
        : '.epub';
      await fileStorage.storeFile(blob, book.contentHash ?? book.id, ext);
      movedIds.add(book.id);
    } catch (error) {
      console.error(`Failed to move linked book ${book.id} into library:`, error);
    }
  }

  if (movedIds.size > 0) {
    const updatedBooks = libraryService.getBooks().map(b =>
      movedIds.has(b.id) ? { ...b, source: 'managed' as const, missing: undefined } : b
    );
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }
  return movedIds.size;
}

/**
 * Repoint a missing linked book at a new source. Picks the file natively
 * (open-file dialog on desktop, SAF document picker on Android), re-hashes
 * it so relinking to different bytes updates identity too; progress and
 * metadata are untouched.
 */
export async function relinkBookFile(bookId: string, newPath?: string): Promise<boolean> {
  const book = libraryService.getBooks().find(b => b.id === bookId);
  if (!book || book.source !== 'linked') return false;

  if (!newPath) {
    if (Capacitor.getPlatform() === 'android') {
      try {
        newPath = (await safFiles.pickDocument()).uri;
      } catch {
        return false; // picker cancelled
      }
    } else {
      newPath = await window.offreaderFiles?.pickBookFile() ?? undefined;
      if (!newPath) return false;
    }
  }

  try {
    const blob = await fileStorage.retrieveLinkedBlob(newPath);
    const contentHash = await sha256Hex(blob);
    const updated = { ...book, sourcePath: newPath, contentHash, missing: undefined };
    libraryService.updateBooks(
      libraryService.getBooks().map(b => b.id === bookId ? updated : b)
    );
    await saveBook(updated);
    return true;
  } catch (error) {
    console.error(`Failed to relink book ${bookId}:`, error);
    toast.error('Could not read the selected file');
    return false;
  }
}
