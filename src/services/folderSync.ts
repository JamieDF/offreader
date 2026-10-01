import { toast } from "@/components/ui/toast";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { fileStorage } from "@/services/fileStorage";
import { saveStoredBooks } from "@/services/bookPersistence";
import { sha256Hex } from "@/utils/hash";
import { importFileItems, ImportItem } from "@/services/bookImport";

/**
 * Folder sync — the linked-mode feature proper (Electron only). A watched
 * folder's book files are cataloged in place: new files become linked books,
 * a file that moved or was renamed is re-found by content hash (the
 * `sourcePath` is repointed, progress intact), and a file that vanished marks
 * its book `missing` — never silently deleted.
 */

const SYNC_FOLDERS_KEY = 'offreader-sync-folders';

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

/** Add a folder to the sync list, start watching it, and scan it. */
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
 *  came from it stay in the library — they're still linked by path. */
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
 * hash); unknown files are read once for hashing — a hash that matches an
 * existing linked book means "moved", a managed match means "already have
 * it", otherwise the file imports as a new linked book.
 */
export async function scanFolder(dirPath: string): Promise<ScanResult> {
  const files = window.offreaderFiles;
  if (!files) return { added: 0, moved: 0, missing: 0 };

  const entries = await files.scanFolder(dirPath);
  const books = libraryService.getBooks();
  const seenPaths = new Set<string>();
  const repoints = new Map<string, { sourcePath: string; contentHash: string }>();
  const foundIds = new Set<string>(); // missing books whose file came back
  const toImport: ImportItem[] = [];

  for (const entry of entries) {
    const known = books.find(b => b.source === 'linked' && b.sourcePath === entry.path);
    if (known) {
      seenPaths.add(entry.path);
      if (known.missing) foundIds.add(known.id);
      continue;
    }

    try {
      const blob = await fileStorage.retrieveLinkedBlob(entry.path);
      const contentHash = await sha256Hex(blob);
      const match = books.find(b => b.contentHash === contentHash);
      if (match) {
        seenPaths.add(entry.path);
        if (match.source === 'linked') {
          // Same bytes, new location — repoint rather than reimport.
          repoints.set(match.id, { sourcePath: entry.path, contentHash });
        }
        continue;
      }
      toImport.push({
        file: new File([blob], entry.name),
        sourcePath: entry.path,
        contentHash,
      });
    } catch (error) {
      console.error(`Sync: failed to read ${entry.path}:`, error);
    }
  }

  // Linked books rooted under this folder whose file wasn't seen → missing.
  // Excludes books repointed above (their new path was seen).
  const sep = dirPath.includes('\\') ? '\\' : '/';
  const prefix = dirPath.endsWith(sep) ? dirPath : dirPath + sep;
  const missingIds = books
    .filter(b =>
      b.source === 'linked' &&
      b.sourcePath?.startsWith(prefix) &&
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
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }

  const added = toImport.length > 0
    ? (await importFileItems(toImport, 'linked')).length
    : 0;
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
 * Repoint a missing linked book at a new source path. Re-hashes the picked
 * file so relinking to different bytes updates identity too; progress and
 * metadata are untouched.
 */
export async function relinkBookFile(bookId: string, newPath: string): Promise<boolean> {
  const files = window.offreaderFiles;
  const book = libraryService.getBooks().find(b => b.id === bookId);
  if (!files || !book || book.source !== 'linked') return false;

  try {
    const blob = await fileStorage.retrieveLinkedBlob(newPath);
    const contentHash = await sha256Hex(blob);
    const updatedBooks = libraryService.getBooks().map(b =>
      b.id === bookId ? { ...b, sourcePath: newPath, contentHash, missing: undefined } : b
    );
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
    return true;
  } catch (error) {
    console.error(`Failed to relink book ${bookId}:`, error);
    toast.error('Could not read the selected file');
    return false;
  }
}
