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

class CapacitorFileStorage {
  private readonly BOOKS_DIR = 'books';
  private readonly STORAGE_BUFFER_MB = 10; // Keep 10MB as safety buffer
  
  /**
   * Check if a file exists in storage
   */
  async fileExists(id: string): Promise<boolean> {
    try {
      const filePath = `${this.BOOKS_DIR}/${id}.epub`;
      await Filesystem.stat({
        path: filePath,
        directory: Directory.Documents,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up orphaned files (files in storage but not in metadata)
   * @param validIds - Array of book IDs that have metadata entries
   * @returns Number of files deleted
   */
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
      // Try StorageManager API on web
      if (!Capacitor.isNativePlatform() && 'storage' in navigator && 'estimate' in (navigator as any).storage) {
        const estimate = await (navigator as any).storage.estimate();
        return {
          available: Math.max(0, estimate.quota - estimate.usage),
          total: estimate.quota,
          used: estimate.usage,
        };
      }
      
      // Fallback for platforms without StorageManager
      // Conservative estimate
      return {
        available: 500 * 1024 * 1024, // 500MB
        total: 1024 * 1024 * 1024,    // 1GB
        used: 0,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      // Very conservative fallback
      return {
        available: 50 * 1024 * 1024,  // 50MB
        total: 500 * 1024 * 1024,     // 500MB
        used: 0,
      };
    }
  }

  async checkStorageQuota(fileSize: number): Promise<StorageCheckResult> {
    const info = await this.getStorageInfo();
    
    // Account for base64 overhead (adds ~33%)
    const requiredSpace = Math.ceil(fileSize * 1.33);
    
    // Calculate usable space (total available minus buffer)
    const bufferBytes = this.STORAGE_BUFFER_MB * 1024 * 1024;
    const usableSpace = Math.max(0, info.available - bufferBytes);
    
    const canStore = requiredSpace <= usableSpace;
    const availableMB = Math.floor(usableSpace / 1024 / 1024);
    const requiredMB = Math.ceil(requiredSpace / 1024 / 1024);
    
    return {
      canStore,
      availableMB,
      requiredMB,
      message: canStore 
        ? undefined 
        : `Requires ${requiredMB}MB but only ${availableMB}MB available`,
    };
  }
  
  async storeFile(file: File, id: string): Promise<string> {
    try {
      // Check quota before attempting to store
      const quotaCheck = await this.checkStorageQuota(file.size);
      if (!quotaCheck.canStore) {
        throw new Error(`Insufficient storage: ${quotaCheck.message}`);
      }
      
      // Convert file to base64
      const base64Data = await this.fileToBase64(file);
      
      // Store using Capacitor Filesystem (works on both web and native)
      const filePath = `${this.BOOKS_DIR}/${id}.epub`;
      
      await Filesystem.writeFile({
        path: filePath,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      
      // Return persistent file URI
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
  
  async retrieveFile(id: string, filename: string): Promise<string> {
    try {
      // Retrieve using Capacitor Filesystem (works on both web and native)
      const filePath = `${this.BOOKS_DIR}/${id}.epub`;
      
      // Read file and create blob URL for both web and native
      // This is necessary because foliate-js cannot load file:// URLs due to browser security restrictions
      const fileData = await Filesystem.readFile({
        path: filePath,
        directory: Directory.Documents,
      });
      
      // Convert base64 to blob
      const base64Data = fileData.data as string;
      const blob = this.base64ToBlob(base64Data, 'application/epub+zip');
      const blobUrl = URL.createObjectURL(blob);
      
      return blobUrl;
    } catch (error) {
      console.error('Failed to retrieve file:', error);
      throw error;
    }
  }
  
  async deleteFile(id: string): Promise<void> {
    try {
      // Delete using Capacitor Filesystem (works on both web and native)
      const filePath = `${this.BOOKS_DIR}/${id}.epub`;
      await Filesystem.deleteFile({
        path: filePath,
        directory: Directory.Documents,
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }
  
  async listStoredFiles(): Promise<StoredFile[]> {
    try {
      // List using Capacitor Filesystem (works on both web and native)
      const result = await Filesystem.readdir({
        path: this.BOOKS_DIR,
        directory: Directory.Documents,
      });
      
      const files: StoredFile[] = [];
      for (const file of result.files) {
        if (file.type === 'file' && file.name.endsWith('.epub')) {
          const id = file.name.replace('.epub', '');
          const stat = await Filesystem.stat({
            path: `${this.BOOKS_DIR}/${file.name}`,
            directory: Directory.Documents,
          });
          
          files.push({
            id,
            filename: file.name,
            mimeType: 'application/epub+zip',
            size: stat.size || 0,
            createdAt: stat.ctime ? new Date(stat.ctime).toISOString() : new Date().toISOString(),
          });
        }
      }
      return files;
    } catch (error) {
      // Directory doesn't exist or other error - return empty array
      return [];
    }
  }
  
  // Helper methods
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}

// Export singleton instance
export const fileStorage = new CapacitorFileStorage();
