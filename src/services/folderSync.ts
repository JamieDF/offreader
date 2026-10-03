import { Capacitor } from "@capacitor/core";
import { toast } from "@/components/ui/toast";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { fileStorage } from "@/services/fileStorage";
import { safFiles } from "@/services/safFiles";
import { saveStoredBooks } from "@/services/bookPersistence";
import { sha256Hex } from "@/utils/hash";
import { importFileItems, ImportItem, toastImportError } from "@/services/bookImport";

/**
 * Folder sync: the linked-mode feature proper (Electron only). A watched
 * folder's book files are cataloged in place: new files become linked books,
 * a file that moved or was renamed is re-found by content hash (the
 * `sourcePath` is repointed, progress intact), and a file that vanished marks
 * its book `missing`: never silently deleted.
 */

const SYNC_FOLDERS_KEY = 'offreader-sync-folders';
const SYNC_FAILURES_KEY = 'offreader-sync-failures';

/** A file that failed to import. Retried only when mtime/size change: an
 *  unchanged known-bad file is skipped silently so every rescan doesn't
 *  re-toast the same error. */
interface ScanFailure { mtimeMs: number; size: number }

async function getSyncFailures(): Promise<Record<string, ScanFailure>> {
  try {
    const stored = await storageService.getItem(SYNC_FAILURES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
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
  /** Files newly imported as linked books. */
  added: number;
  /** Books whose file moved/renamed and was re-found by content hash. */
  moved: number;
  /** Linked books whose sourcePath vanished under this folder. */
  missing: number;
}

/**
 * Scan one folder: unchanged known paths are skipped cheaply (no read, no
 * hash); unknown files are read once for hashing: a hash that matches an
 * existing linked book means "moved", a managed match means "already have
 * it", otherwise the file imports as a new linked book.
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
  const seenPaths = new Set<string>();
  const repoints = new Map<string, { sourcePath: string; contentHash: string }>();
  const foundIds = new Set<string>(); // missing books whose file came back
  const toImport: ImportItem[] = [];

  const failures = await getSyncFailures();
  let failuresDirty = false;
  const newlyFailed: { name: string; error: unknown }[] = [];
  const entryByPath = new Map(entries.map(e => [e.path, e]));
  const markFailed = (path: string, name: string, error: unknown) => {
    const prev = failures[path];
    const entry = entryByPath.get(path);
    failures[path] = { mtimeMs: entry?.mtimeMs ?? 0, size: entry?.size ?? 0 };
    failuresDirty = true;
    if (!prev || prev.mtimeMs !== failures[path].mtimeMs || prev.size !== failures[path].size) {
      newlyFailed.push({ name, error });
    }
  };

  for (const entry of entries) {
    const known = books.find(b => b.source === 'linked' && b.sourcePath === entry.path);
    if (known) {
      seenPaths.add(entry.path);
      if (known.missing) foundIds.add(known.id);
      continue;
    }

    // Unchanged known-bad file: skip without re-reading or re-toasting.
    const prevFail = failures[entry.path];
    if (prevFail && prevFail.mtimeMs === entry.mtimeMs && prevFail.size === entry.size) {
      continue;
    }

    try {
      const blob = await fileStorage.retrieveLinkedBlob(entry.path);
      const contentHash = await sha256Hex(blob);
      const match = books.find(b => b.contentHash === contentHash);
      if (match) {
        seenPaths.add(entry.path);
        if (match.source === 'linked') {
          // Same bytes, new location: repoint rather than reimport.
          repoints.set(match.id, { sourcePath: entry.path, contentHash });
        }
        delete failures[entry.path];
        failuresDirty = true;
        continue;
      }
      toImport.push({
        file: new File([blob], entry.name),
        sourcePath: entry.path,
        contentHash,
      });
      if (failures[entry.path]) {
        delete failures[entry.path];
        failuresDirty = true;
      }
    } catch (error) {
      console.error(`Sync: failed to read ${entry.path}:`, error);
      markFailed(entry.path, entry.name, error);
    }
  }

  // Linked books rooted under this folder whose file wasn't seen → missing.
  // Excludes books repointed above (their new path was seen).
  const missingIds = books
    .filter(b =>
      b.source === 'linked' &&
      b.sourcePath && isUnderFolder(b.sourcePath, dirPath) &&
      !seenPaths.has(b.sourcePath) &&
      !repoints.has(b.id) &&
      !b.missing)
    .map(b => b.id);

  if (repoints.size > 0 || missingIds.length > 0 || foundIds.size > 0) {
    const updatedBooks = libraryService.getBooks().map(b => {
      const repoint = repoints.get(b.id);
      if (repoint) {
        return { ...b, sourcePath: repoint.sourcePath, contentHash: repoint.contentHash, missing: undefined };
      }
      if (foundIds.has(b.id)) return { ...b, missing: undefined };
      if (missingIds.includes(b.id)) return { ...b, missing: true };
      return b;
    });
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }

  const added = toImport.length > 0
    ? (await importFileItems(toImport, 'linked', undefined, (item, error) => {
        const path = item.sourcePath ?? item.file.name;
        markFailed(path, item.file.name, error);
      })).length
    : 0;

  // Prune failure entries for files that no longer exist under this folder.
  const entryPaths = new Set(entries.map(e => e.path));
  for (const p of Object.keys(failures)) {
    if (isUnderFolder(p, dirPath) && !entryPaths.has(p)) {
      delete failures[p];
      failuresDirty = true;
    }
  }
  if (failuresDirty) {
    await storageService.setItem(SYNC_FAILURES_KEY, JSON.stringify(failures));
  }

  // Toast only new failures: a file that's been failing unchanged across
  // rescans stays quiet.
  if (newlyFailed.length === 1) {
    toastImportError(newlyFailed[0].name, newlyFailed[0].error);
  } else if (newlyFailed.length > 1) {
    toast.error(`Couldn't import ${newlyFailed.length} files from this folder`);
  }

  return { added, moved: repoints.size, missing: missingIds.length };
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
    const updatedBooks = libraryService.getBooks().map(b =>
      b.id === bookId ? { ...b, sourcePath: newPath, contentHash, missing: undefined } : b
    );
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
    return true;
  } catch (error) {
    console.error(`Failed to relink book ${bookId}:`, error);
    toast.error('Could not read the selected file');
    return false;
  }
}
