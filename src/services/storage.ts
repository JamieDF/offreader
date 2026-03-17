import { Preferences } from '@capacitor/preferences';
import { Directory, Filesystem } from '@capacitor/filesystem';

// Storage interface for consistent API across platforms
interface StorageService {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Unified storage implementation (Capacitor Preferences works on both web and native)
class UnifiedStorage implements StorageService {
  async getItem(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.error('Failed to get from Preferences:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch (error) {
      console.error('Failed to save to Preferences:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.error('Failed to remove from Preferences:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('Failed to clear Preferences:', error);
      throw error;
    }
  }
}

// Export the unified storage service instance
export const storageService = new UnifiedStorage();

// Export types and classes for testing
export type { StorageService };
export { UnifiedStorage };

// File system utilities for book storage
export const fileSystem = {
  // Save a file to device storage
  async saveFile(path: string, data: string): Promise<void> {
    try {
      await Filesystem.writeFile({
        path,
        data,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  },

  // Read a file from device storage
  async readFile(path: string): Promise<string> {
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: Directory.Documents,
      });
      return data as string;
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  },

  // Delete a file from device storage
  async deleteFile(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path,
        directory: Directory.Documents,
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  },

  // Check if a file exists
  async fileExists(path: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path,
        directory: Directory.Documents,
      });
      return true;
    } catch {
      return false;
    }
  },
};

// Migration utilities
export const migrateFromLocalStorage = async (keys: string[]): Promise<void> => {
  for (const key of keys) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        await storageService.setItem(key, value);
        // Remove from localStorage after successful migration
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Failed to migrate key ${key}:`, error);
    }
  }
};

// Extend Window interface for Capacitor
declare global {
  interface Window {
    Capacitor: any;
  }
}
