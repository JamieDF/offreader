import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Directory } from '@capacitor/filesystem';
import { fileStorage } from '@/services/fileStorage';

const mockStat = vi.fn();
const mockReaddir = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetUri = vi.fn();

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Filesystem: {
    stat: (...args: unknown[]) => mockStat(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
    getUri: (...args: unknown[]) => mockGetUri(...args),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

// Stub StorageManager so getStorageInfo() returns predictable values
const mockEstimate = vi.fn();
Object.defineProperty(global, 'navigator', {
  value: { storage: { estimate: mockEstimate } },
  writable: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CapacitorFileStorage', () => {
  describe('checkStorageQuota', () => {
    it('returns canStore: true when sufficient space is available', async () => {
      // 100 MB available after usage → 90 MB usable after buffer, 10 MB file * 1.33 = 14 MB needed
      mockEstimate.mockResolvedValue({
        quota: 200 * 1024 * 1024,
        usage: 100 * 1024 * 1024,
      });

      const result = await fileStorage.checkStorageQuota(10 * 1024 * 1024);

      expect(result.canStore).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('returns canStore: false with message when space is insufficient', async () => {
      // 5 MB available, 10 MB buffer → 0 MB usable; any file fails
      mockEstimate.mockResolvedValue({
        quota: 20 * 1024 * 1024,
        usage: 15 * 1024 * 1024,
      });

      const result = await fileStorage.checkStorageQuota(1 * 1024 * 1024);

      expect(result.canStore).toBe(false);
      expect(result.message).toMatch(/Requires \d+MB but only \d+MB available/);
    });

    it('accounts for base64 overhead (~1.33x) and 10 MB buffer', async () => {
      // 50 MB available, 10 MB buffer → 40 MB usable
      mockEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,
        usage: 50 * 1024 * 1024,
      });

      // ceil(30.08 MB * 1.33) = 40 MB → exactly at limit → canStore true
      const fitsBytes = Math.floor((40 * 1024 * 1024) / 1.33);
      const fitsResult = await fileStorage.checkStorageQuota(fitsBytes);
      expect(fitsResult.canStore).toBe(true);

      // One byte over the 40 MB usable after base64 expansion → canStore false
      const tooLargeBytes = Math.ceil((40 * 1024 * 1024) / 1.33) + 1;
      const failResult = await fileStorage.checkStorageQuota(tooLargeBytes);
      expect(failResult.canStore).toBe(false);
    });
  });

  describe('fileExists', () => {
    it('returns true when stat succeeds', async () => {
      mockStat.mockResolvedValue({ size: 1000 });

      const exists = await fileStorage.fileExists('book-abc');
      expect(exists).toBe(true);
      expect(mockStat).toHaveBeenCalledWith({
        path: 'books/book-abc.epub',
        directory: Directory.Documents,
      });
    });

    it('returns false when stat throws', async () => {
      mockStat.mockRejectedValue(new Error('File not found'));

      const exists = await fileStorage.fileExists('missing-book');
      expect(exists).toBe(false);
    });
  });

  describe('listStoredFiles', () => {
    it('returns files with supported book extensions', async () => {
      mockReaddir.mockResolvedValue({
        files: [
          { name: 'book1.epub', type: 'file' },
          { name: 'readme.txt', type: 'file' },
          { name: 'book2.epub', type: 'file' },
          { name: 'book3.azw3', type: 'file' },
          { name: 'book4.fb2', type: 'file' },
          { name: 'book5.cbz', type: 'file' },
          { name: 'subdir', type: 'directory' },
        ],
      });
      mockStat.mockResolvedValue({ size: 500, ctime: Date.now() });

      const files = await fileStorage.listStoredFiles();

      expect(files).toHaveLength(5);
      expect(files.map(f => f.filename)).toEqual([
        'book1.epub',
        'book2.epub',
        'book3.azw3',
        'book4.fb2',
        'book5.cbz',
      ]);
      expect(files.map(f => f.id)).toEqual(['book1', 'book2', 'book3', 'book4', 'book5']);
    });

    it('returns empty array when directory does not exist', async () => {
      mockReaddir.mockRejectedValue(new Error('Directory not found'));

      const files = await fileStorage.listStoredFiles();
      expect(files).toEqual([]);
    });
  });

  describe('cleanupOrphanFiles', () => {
    it('deletes files not in validIds and returns count', async () => {
      mockReaddir.mockResolvedValue({
        files: [
          { name: 'orphan.epub', type: 'file' },
          { name: 'valid.epub', type: 'file' },
        ],
      });
      mockStat.mockResolvedValue({ size: 100, ctime: Date.now() });
      mockDeleteFile.mockResolvedValue(undefined);

      const count = await fileStorage.cleanupOrphanFiles(['valid']);

      expect(count).toBe(1);
      expect(mockDeleteFile).toHaveBeenCalledTimes(1);
      expect(mockDeleteFile).toHaveBeenCalledWith({
        path: 'books/orphan.epub',
        directory: Directory.Documents,
      });
    });

    it('does not delete files that are in validIds', async () => {
      mockReaddir.mockResolvedValue({
        files: [{ name: 'keep.epub', type: 'file' }],
      });
      mockStat.mockResolvedValue({ size: 100, ctime: Date.now() });

      const count = await fileStorage.cleanupOrphanFiles(['keep']);

      expect(count).toBe(0);
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });
  });
});
