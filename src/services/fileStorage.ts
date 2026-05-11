import { Directory, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

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

const KNOWN_EXTENSIONS = ['.epub', '.pdf', '.mobi'] as const;

class CapacitorFileStorage {
  private readonly BOOKS_DIR = 'books';
  private readonly STORAGE_BUFFER_MB = 10;

  private extForFormat(format?: string): string {
    if (format === 'PDF') return '.pdf';
    if (format === 'MOBI') return '.mobi';
    return '.epub';
  }

  private extForFile(file: File): string {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) return '.pdf';
    if (name.endsWith('.mobi')) return '.mobi';
    return '.epub';
  }

  private mimeTypeForExt(ext: string): string {
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.mobi') return 'application/x-mobipocket-ebook';
    return 'application/epub+zip';
  }

  /** Returns the extension of a stored file, or null if not found under any known extension. */
  private async findStoredExt(id: string): Promise<string | null> {
    for (const ext of KNOWN_EXTENSIONS) {
      try {
        await Filesystem.stat({
          path: `${this.BOOKS_DIR}/${id}${ext}`,
          directory: Directory.Documents,
        });
        return ext;
      } catch {
        // not found with this extension
      }
    }
    return null;
  }

  async fileExists(id: string): Promise<boolean> {
    return (await this.findStoredExt(id)) !== null;
  }

  async cleanupOrphanFiles(validIds: string[]): Promise<number> {
    const validIdSet = new Set(validIds);
    let cleanedCount = 0;
    try {
      const allFiles = await this.listStoredFiles();
      for (const file of allFiles) {
        if (!validIdSet.has(file.id)) {
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
    const requiredSpace = Math.ceil(fileSize * 1.33);
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

  async storeFile(file: File, id: string): Promise<string> {
    try {
      const quotaCheck = await this.checkStorageQuota(file.size);
      if (!quotaCheck.canStore) {
        throw new Error(`Insufficient storage: ${quotaCheck.message}`);
      }

      const ext = this.extForFile(file);
      const base64Data = await this.fileToBase64(file);
      const filePath = `${this.BOOKS_DIR}/${id}${ext}`;

      await Filesystem.writeFile({
        path: filePath,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });

      const result = await Filesystem.getUri({
        path: filePath,
        directory: Directory.Documents,
      });
      return result.uri;
    } catch (error) {
      console.error('Failed to store file:', error);
      throw error;
    }
  }

  async retrieveFile(id: string, format?: string): Promise<string> {
    // Try format-specific extension first, then fall back through all known extensions
    // so books stored before the format-aware fix (all as .epub) still load correctly.
    const preferredExt = this.extForFormat(format);
    const tryOrder = [
      preferredExt,
      ...KNOWN_EXTENSIONS.filter(e => e !== preferredExt),
    ];

    for (const ext of tryOrder) {
      try {
        const filePath = `${this.BOOKS_DIR}/${id}${ext}`;
        const fileData = await Filesystem.readFile({
          path: filePath,
          directory: Directory.Documents,
        });
        const blob = this.base64ToBlob(fileData.data as string, this.mimeTypeForExt(ext));
        return URL.createObjectURL(blob);
      } catch {
        // try next extension
      }
    }

    throw new Error(`File not found for id: ${id}`);
  }

  async deleteFile(id: string): Promise<void> {
    const ext = await this.findStoredExt(id);
    if (!ext) return; // already gone
    try {
      await Filesystem.deleteFile({
        path: `${this.BOOKS_DIR}/${id}${ext}`,
        directory: Directory.Documents,
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async listStoredFiles(): Promise<StoredFile[]> {
    try {
      const result = await Filesystem.readdir({
        path: this.BOOKS_DIR,
        directory: Directory.Documents,
      });

      const files: StoredFile[] = [];
      for (const file of result.files) {
        if (file.type !== 'file') continue;
        const ext = KNOWN_EXTENSIONS.find(e => file.name.endsWith(e));
        if (!ext) continue;

        const id = file.name.slice(0, -ext.length);
        const stat = await Filesystem.stat({
          path: `${this.BOOKS_DIR}/${file.name}`,
          directory: Directory.Documents,
        });
        files.push({
          id,
          filename: file.name,
          mimeType: this.mimeTypeForExt(ext),
          size: stat.size || 0,
          createdAt: stat.ctime ? new Date(stat.ctime).toISOString() : new Date().toISOString(),
        });
      }
      return files;
    } catch {
      return [];
    }
  }

  /**
   * One-time migration: renames books stored under the old `.epub` extension to
   * their correct extension based on the saved format metadata.
   * Safe to call on every startup — skips books that are already correct.
   */
  async migrateExtensions(books: { id: string; format?: string }[]): Promise<void> {
    for (const { id, format } of books) {
      const correctExt = this.extForFormat(format);
      if (correctExt === '.epub') continue; // already using the right name

      const oldPath = `${this.BOOKS_DIR}/${id}.epub`;
      const newPath = `${this.BOOKS_DIR}/${id}${correctExt}`;

      // Check if the old .epub copy actually exists
      try {
        await Filesystem.stat({ path: oldPath, directory: Directory.Documents });
      } catch {
        continue; // not stored as .epub — nothing to migrate
      }

      // Skip if already migrated
      try {
        await Filesystem.stat({ path: newPath, directory: Directory.Documents });
        // Correct extension already exists — clean up stale .epub copy
        await Filesystem.deleteFile({ path: oldPath, directory: Directory.Documents }).catch(() => {});
        continue;
      } catch {
        // correct path doesn't exist yet — proceed
      }

      try {
        const data = await Filesystem.readFile({ path: oldPath, directory: Directory.Documents });
        await Filesystem.writeFile({
          path: newPath,
          data: data.data as string,
          directory: Directory.Documents,
          recursive: true,
        });
        await Filesystem.deleteFile({ path: oldPath, directory: Directory.Documents });
        console.log(`Migrated ${id}.epub → ${id}${correctExt}`);
      } catch (err) {
        console.error(`Failed to migrate ${id}:`, err);
        // Leave old file in place — retrieveFile fallback will still find it
      }
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
