import { Directory, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { blobStore } from './blobStore';
import { safFiles } from './safFiles';
import { sha256Hex } from '@/utils/hash';
import { Book } from '@/types/book';

export interface StoredFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface StorageInfo {
  available: number;
  total: number;
  used: number;
}

export interface StorageCheckResult {
  canStore: boolean;
  availableMB: number;
  requiredMB: number;
  message?: string;
}

const KNOWN_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.azw3', '.fb2', '.cbz'] as const;

/**
 * Book-file storage.
 *
 * Two backends, one interface:
 * - **Native (Android/iOS)**: real binary files at `Data/books/<key>.<ext>`.
 *   Reads stream through `Capacitor.convertFileSrc`: no base64 round-trip.
 *   `Directory.Data` is app-private, so stored books don't appear as anonymous
 *   files in the user's file manager (the old `Directory.Documents` behavior).
 * - **Web/Electron**: raw Blobs in the `offreader-files` IndexedDB store , 
 *   no base64, no persistence-format inflation.
 *
 * Keys are content hashes (`book.contentHash`) for new books. Books imported
 * before this store existed keep UUID-keyed files in the legacy location
 * (`Directory.Documents` on native / the Capacitor-FS web shim's IndexedDB);
 * `migrateLegacyFiles` moves them to the new store and sets `contentHash`,
 * and every read path falls back to the legacy location for stragglers.
 */
class CapacitorFileStorage {
  private readonly BOOKS_DIR = 'books';
  private readonly STORAGE_BUFFER_MB = 10;

  /** Filesystem-backend only on real native platforms: on Electron the
   *  Capacitor Filesystem plugin has no native implementation and silently
   *  falls back to its web (IndexedDB, base64) shim, so Electron uses
   *  blobStore alongside web. */
  private usesNativeFs(): boolean {
    const platform = Capacitor.getPlatform();
    return platform === 'android' || platform === 'ios';
  }

  private extForFormat(format?: string): string {
    if (format === 'PDF') return '.pdf';
    if (format === 'MOBI') return '.mobi';
    if (format === 'AZW3') return '.azw3';
    if (format === 'FB2') return '.fb2';
    if (format === 'CBZ') return '.cbz';
    return '.epub';
  }

  private extForFile(file: File): string {
    const name = file.name.toLowerCase();
    for (const ext of KNOWN_EXTENSIONS) {
      if (name.endsWith(ext)) return ext;
    }
    return '.epub';
  }

  private mimeTypeForExt(ext: string): string {
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.mobi') return 'application/x-mobipocket-ebook';
    if (ext === '.azw3') return 'application/vnd.amazon.ebook';
    if (ext === '.fb2') return 'application/x-fictionbook+xml';
    if (ext === '.cbz') return 'application/vnd.comicbook+zip';
    return 'application/epub+zip';
  }

  /** Extensions to try, preferred (from format) first. */
  private extOrder(format?: string): string[] {
    const preferred = this.extForFormat(format);
    return [preferred, ...KNOWN_EXTENSIONS.filter(e => e !== preferred)];
  }

  /** First extension under which `key` exists in `directory`, or null. */
  private async findExtIn(directory: Directory, key: string, format?: string): Promise<string | null> {
    for (const ext of this.extOrder(format)) {
      try {
        await Filesystem.stat({
          path: `${this.BOOKS_DIR}/${key}${ext}`,
          directory,
        });
        return ext;
      } catch {
        // not found with this extension
      }
    }
    return null;
  }

  /**
   * Store book bytes under `key` (a content hash for new imports).
   * `ext` overrides filename sniffing: migrations pass it explicitly since
   * Blobs reconstructed from base64 have no name.
   */
  async storeFile(file: File | Blob, key: string, ext?: string): Promise<void> {
    try {
      const quotaCheck = await this.checkStorageQuota(file.size);
      if (!quotaCheck.canStore) {
        throw new Error(`Insufficient storage: ${quotaCheck.message}`);
      }

      const fileExt = ext ?? (file instanceof File ? this.extForFile(file) : '.epub');
      await this.putFileBlob(file, key, fileExt);
    } catch (error) {
      console.error('Failed to store file:', error);
      throw error;
    }
  }

  /** The actual write: no quota check (migration reuses it for bytes already
   *  counted against storage). */
  private async putFileBlob(blob: Blob, key: string, ext: string): Promise<void> {
    if (this.usesNativeFs()) {
      await Filesystem.writeFile({
        path: `${this.BOOKS_DIR}/${key}${ext}`,
        data: blob,
        directory: Directory.Data,
        recursive: true,
      });
    } else {
      await blobStore.put(`${key}${ext}`, blob);
    }
  }

  /**
   * The book's bytes as a Blob. Checks the new store first, then the legacy
   * location, so pre-migration files remain readable.
   */
  async retrieveBlob(key: string, format?: string): Promise<Blob> {
    if (this.usesNativeFs()) {
      const ext = await this.findExtIn(Directory.Data, key, format);
      if (ext) {
        // Streams from disk via the WebView's file handler: the file never
        // crosses the JS↔native bridge as base64.
        const { uri } = await Filesystem.getUri({
          path: `${this.BOOKS_DIR}/${key}${ext}`,
          directory: Directory.Data,
        });
        const response = await fetch(Capacitor.convertFileSrc(uri));
        if (response.ok) return response.blob();
      }
    } else {
      for (const ext of this.extOrder(format)) {
        const blob = await blobStore.get(`${key}${ext}`).catch(() => undefined);
        if (blob) return blob;
      }
    }

    // Legacy store: UUID-keyed base64 via Capacitor Filesystem.
    for (const ext of this.extOrder(format)) {
      try {
        const fileData = await Filesystem.readFile({
          path: `${this.BOOKS_DIR}/${key}${ext}`,
          directory: Directory.Documents,
        });
        return this.base64ToBlob(fileData.data as string, this.mimeTypeForExt(ext));
      } catch {
        // try next extension
      }
    }

    throw new Error(`File not found for key: ${key}`);
  }

  /** URL that streams a whitelisted local path to the renderer (Electron). */
  linkedFileUrl(sourcePath: string): string {
    return `offreader-file://file/?p=${encodeURIComponent(sourcePath)}`;
  }

  /**
   * A linked book's bytes, streamed straight from its source path over the
   * offreader-file:// scheme: never copied into app storage. Registers the
   * path first so the main-process allowlist lets the fetch through.
   * On Android, `sourcePath` is a SAF content:// URI: the plugin copies the
   * bytes into app cache (skipped when the cache is fresh) and the result
   * streams back through convertFileSrc.
   */
  async retrieveLinkedBlob(sourcePath: string): Promise<Blob> {
    if (Capacitor.getPlatform() === 'android') {
      const { path } = await safFiles.resolveToCache({ uri: sourcePath });
      const response = await fetch(Capacitor.convertFileSrc(`file://${path}`));
      if (!response.ok) {
        throw new Error(`Linked file is not available: ${sourcePath}`);
      }
      return response.blob();
    }

    const files = window.offreaderFiles;
    if (!files) throw new Error('Linked books are only supported in the desktop app');
    await files.registerPath(sourcePath);
    const response = await fetch(this.linkedFileUrl(sourcePath));
    if (!response.ok) {
      throw new Error(`Linked file is not available: ${sourcePath}`);
    }
    return response.blob();
  }

  /**
   * The book's bytes as a Blob, resolving through whichever backend owns them:
   * linked books stream from `sourcePath`, stored books come from the
   * content-addressed store (with the legacy fallback).
   */
  async retrieveBookBlob(
    book: Pick<Book, 'id' | 'format' | 'contentHash' | 'source' | 'sourcePath'>,
  ): Promise<Blob> {
    if (book.source === 'linked' && book.sourcePath) {
      return this.retrieveLinkedBlob(book.sourcePath);
    }
    return this.retrieveBlob(book.contentHash ?? book.id, book.format);
  }

  /**
   * True if the book's bytes are reachable: for linked books that's the
   * source path still existing on disk, for stored books the store key.
   */
  async bookFileExists(
    book: Pick<Book, 'id' | 'contentHash' | 'source' | 'sourcePath'>,
  ): Promise<boolean> {
    if (book.source === 'linked' && book.sourcePath) {
      if (Capacitor.getPlatform() === 'android') {
        try {
          const { exists } = await safFiles.fileExists({ uri: book.sourcePath });
          return exists;
        } catch {
          return false;
        }
      }
      return window.offreaderFiles?.fileExists(book.sourcePath) ?? false;
    }
    return this.fileExists(book.contentHash ?? book.id);
  }

  /** True if `key` exists in either the new store or the legacy location. */
  async fileExists(key: string): Promise<boolean> {
    if (this.usesNativeFs()) {
      if (await this.findExtIn(Directory.Data, key) !== null) return true;
    } else {
      for (const ext of KNOWN_EXTENSIONS) {
        if (await blobStore.has(`${key}${ext}`).catch(() => false)) return true;
      }
    }
    return (await this.findExtIn(Directory.Documents, key)) !== null;
  }

  /** Delete `key` from both the new store and the legacy location. */
  async deleteFile(key: string): Promise<void> {
    if (this.usesNativeFs()) {
      const ext = await this.findExtIn(Directory.Data, key);
      if (ext) {
        await Filesystem.deleteFile({
          path: `${this.BOOKS_DIR}/${key}${ext}`,
          directory: Directory.Data,
        }).catch(() => {});
      }
    } else {
      for (const ext of KNOWN_EXTENSIONS) {
        await blobStore.delete(`${key}${ext}`).catch(() => {});
      }
    }

    const legacyExt = await this.findExtIn(Directory.Documents, key);
    if (legacyExt) {
      await Filesystem.deleteFile({
        path: `${this.BOOKS_DIR}/${key}${legacyExt}`,
        directory: Directory.Documents,
      }).catch(() => {});
    }
  }

  /** All files in both stores: keys (without extension) in `id`. */
  async listStoredFiles(): Promise<StoredFile[]> {
    const files: StoredFile[] = [];

    if (this.usesNativeFs()) {
      files.push(...await this.listNativeFiles(Directory.Data));
    } else {
      for (const key of await blobStore.keys().catch(() => [])) {
        const name = String(key);
        const ext = KNOWN_EXTENSIONS.find(e => name.endsWith(e));
        if (!ext) continue;
        const blob = await blobStore.get(name).catch(() => undefined);
        files.push({
          id: name.slice(0, -ext.length),
          filename: name,
          mimeType: this.mimeTypeForExt(ext),
          size: blob?.size ?? 0,
          createdAt: '',
        });
      }
    }

    // Legacy location: same entry may appear in both during a partial
    // migration; dedupe by filename.
    const seen = new Set(files.map(f => f.filename));
    for (const file of await this.listNativeFiles(Directory.Documents)) {
      if (!seen.has(file.filename)) files.push(file);
    }

    return files;
  }

  private async listNativeFiles(directory: Directory): Promise<StoredFile[]> {
    try {
      const result = await Filesystem.readdir({
        path: this.BOOKS_DIR,
        directory,
      });

      const files: StoredFile[] = [];
      for (const file of result.files) {
        if (file.type !== 'file') continue;
        const ext = KNOWN_EXTENSIONS.find(e => file.name.endsWith(e));
        if (!ext) continue;

        const stat = await Filesystem.stat({
          path: `${this.BOOKS_DIR}/${file.name}`,
          directory,
        }).catch(() => ({ size: 0, ctime: 0 }));
        files.push({
          id: file.name.slice(0, -ext.length),
          filename: file.name,
          mimeType: this.mimeTypeForExt(ext),
          size: stat.size || 0,
          createdAt: stat.ctime ? new Date(stat.ctime).toISOString() : '',
        });
      }
      return files;
    } catch {
      return [];
    }
  }

  async cleanupOrphanFiles(validKeys: string[]): Promise<number> {
    const validKeySet = new Set(validKeys);
    let cleanedCount = 0;
    try {
      const allFiles = await this.listStoredFiles();
      for (const file of allFiles) {
        if (!validKeySet.has(file.id)) {
          console.warn(`Deleting orphaned file: ${file.id} (${file.filename})`);
          try {
            await this.deleteFile(file.id);
            cleanedCount++;
          } catch (error) {
            console.error(`Failed to delete orphan ${file.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup orphans:', error);
    }
    return cleanedCount;
  }

  /**
   * Moves books stored in the legacy location (UUID-keyed base64 via
   * Capacitor Filesystem in `Directory.Documents` / its web shim) into the
   * new content-addressed store. Sets `book.contentHash` in place; the caller
   * persists the updated records. Returns true if any book was migrated.
   *
   * Safe to run every startup: books with `contentHash` are skipped, and a
   * per-book failure leaves the legacy file in place where the read path's
   * fallback still finds it.
   */
  async migrateLegacyFiles(books: Book[]): Promise<boolean> {
    let changed = false;
    for (const book of books) {
      if (book.contentHash) continue;

      const legacyExt = await this.findExtIn(Directory.Documents, book.id);
      if (!legacyExt) continue;

      try {
        const { data } = await Filesystem.readFile({
          path: `${this.BOOKS_DIR}/${book.id}${legacyExt}`,
          directory: Directory.Documents,
        });
        const blob = this.base64ToBlob(data as string, this.mimeTypeForExt(legacyExt));
        const hash = await sha256Hex(blob);
        // Store under the format-correct extension: this subsumes the old
        // migrateExtensions pass (everything used to be saved as .epub).
        const ext = this.extForFormat(book.format);
        await this.putFileBlob(blob, hash, ext);
        book.contentHash = hash;
        changed = true;
        await Filesystem.deleteFile({
          path: `${this.BOOKS_DIR}/${book.id}${legacyExt}`,
          directory: Directory.Documents,
        }).catch(() => {});
      } catch (error) {
        console.error(`Failed to migrate file for book ${book.id}:`, error);
        // Leave legacy file in place: retrieveBlob's fallback still finds it.
      }
    }
    return changed;
  }

  async getStorageInfo(): Promise<StorageInfo> {
    try {
      if (!Capacitor.isNativePlatform() && 'storage' in navigator && 'estimate' in (navigator.storage as StorageManager)) {
        const estimate = await (navigator.storage as StorageManager).estimate();
        const quota = estimate.quota ?? 1024 * 1024 * 1024;
        const usage = estimate.usage ?? 0;
        return {
          available: Math.max(0, quota - usage),
          total: quota,
          used: usage,
        };
      }
      return { available: 500 * 1024 * 1024, total: 1024 * 1024 * 1024, used: 0 };
    } catch {
      return { available: 50 * 1024 * 1024, total: 500 * 1024 * 1024, used: 0 };
    }
  }

  async checkStorageQuota(fileSize: number): Promise<StorageCheckResult> {
    const info = await this.getStorageInfo();
    const requiredSpace = fileSize;
    const bufferBytes = this.STORAGE_BUFFER_MB * 1024 * 1024;
    const usableSpace = Math.max(0, info.available - bufferBytes);
    const canStore = requiredSpace <= usableSpace;
    const availableMB = Math.floor(usableSpace / 1024 / 1024);
    const requiredMB = Math.ceil(requiredSpace / 1024 / 1024);
    return {
      canStore,
      availableMB,
      requiredMB,
      message: canStore ? undefined : `Requires ${requiredMB}MB but only ${availableMB}MB available`,
    };
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteArray], { type: mimeType });
  }
}

export const fileStorage = new CapacitorFileStorage();
