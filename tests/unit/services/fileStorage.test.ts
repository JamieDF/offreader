import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Directory } from '@capacitor/filesystem';
import { fileStorage } from '@/services/fileStorage';
import { sha256Hex } from '@/utils/hash';

const mockStat = vi.fn();
const mockReaddir = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetUri = vi.fn();
const mockGetPlatform = vi.fn();

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS', Data: 'DATA' },
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
  Capacitor: {
    getPlatform: () => mockGetPlatform(),
    isNativePlatform: () => mockGetPlatform() !== 'web',
    convertFileSrc: (uri: string) => `capacitor://localhost/_capacitor_file_${uri}`,
  },
}));

// In-memory blobStore — fake-indexeddb structuredClones stored values, which
// degrades jsdom Blobs to plain objects; the Map keeps the real Blob intact.
// blobStore itself is covered against real IDB in blobStore.test.ts.
const blobMap = new Map<string, Blob>();
vi.mock('@/services/blobStore', () => ({
  blobStore: {
    get: (key: string) => Promise.resolve(blobMap.get(key)),
    has: (key: string) => Promise.resolve(blobMap.has(key)),
    put: (key: string, blob: Blob) => { blobMap.set(key, blob); return Promise.resolve(); },
    delete: (key: string) => { blobMap.delete(key); return Promise.resolve(); },
    keys: () => Promise.resolve([...blobMap.keys()]),
  },
}));

// Stub StorageManager so getStorageInfo() returns predictable values
const mockEstimate = vi.fn();
Object.defineProperty(global, 'navigator', {
  value: { storage: { estimate: mockEstimate } },
  writable: true,
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPlatform.mockReturnValue('web');
  blobMap.clear();
});

describe('CapacitorFileStorage', () => {
  describe('checkStorageQuota', () => {
    it('returns canStore: true when sufficient space is available', async () => {
      // 100 MB available after usage → 90 MB usable after buffer, 10 MB file fits
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

    it('accounts for the 10 MB buffer with no base64 overhead', async () => {
      // 50 MB available, 10 MB buffer → 40 MB usable
      mockEstimate.mockResolvedValue({
        quota: 100 * 1024 * 1024,
        usage: 50 * 1024 * 1024,
      });

      const fitsResult = await fileStorage.checkStorageQuota(40 * 1024 * 1024);
      expect(fitsResult.canStore).toBe(true);

      const failResult = await fileStorage.checkStorageQuota(40 * 1024 * 1024 + 1);
      expect(failResult.canStore).toBe(false);
    });
  });

  describe('web/electron backend (IndexedDB blob store)', () => {
    it('storeFile puts the raw blob under <key>.<ext>', async () => {
      const file = new File(['hello'], 'book.epub', { type: 'application/epub+zip' });
      await fileStorage.storeFile(file, 'abc123');

      const stored = blobMap.get('abc123.epub');
      expect(stored).toBeDefined();
      expect(stored!.size).toBe(5);
      // No Filesystem calls at all on the web path
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('retrieveBlob returns the stored blob', async () => {
      blobMap.set('hash1.pdf', new Blob(['pdf-bytes']));

      const blob = await fileStorage.retrieveBlob('hash1', 'PDF');
      expect(blob.size).toBe(9);
    });

    it('fileExists checks the blob store, then the legacy location', async () => {
      blobMap.set('hash2.epub', new Blob(['x']));
      expect(await fileStorage.fileExists('hash2')).toBe(true);

      // Legacy fallback: uuid-keyed file still in the old location
      mockStat.mockImplementation(({ path }: { path: string }) =>
        path === 'books/legacy-id.epub' ? Promise.resolve({ size: 10 }) : Promise.reject(new Error('nf')));
      expect(await fileStorage.fileExists('legacy-id')).toBe(true);

      mockStat.mockRejectedValue(new Error('nf'));
      expect(await fileStorage.fileExists('missing')).toBe(false);
    });

    it('deleteFile removes from blob store and legacy location', async () => {
      blobMap.set('k1.epub', new Blob(['x']));
      mockStat.mockResolvedValue({ size: 1 }); // legacy copy exists too
      mockDeleteFile.mockResolvedValue(undefined);

      await fileStorage.deleteFile('k1');

      expect(blobMap.has('k1.epub')).toBe(false);
      expect(mockDeleteFile).toHaveBeenCalledWith({
        path: 'books/k1.epub',
        directory: Directory.Documents,
      });
    });

    it('listStoredFiles returns blob-store entries plus legacy files', async () => {
      blobMap.set('h1.epub', new Blob(['xx']));
      mockReaddir.mockResolvedValue({ files: [{ name: 'legacy.cbz', type: 'file' }] });
      mockStat.mockResolvedValue({ size: 5, ctime: 0 });

      const files = await fileStorage.listStoredFiles();
      expect(files.map(f => f.filename).sort()).toEqual(['h1.epub', 'legacy.cbz']);
    });
  });

  describe('native backend (Filesystem, Directory.Data)', () => {
    beforeEach(() => {
      mockGetPlatform.mockReturnValue('android');
    });

    it('storeFile writes the Blob to Directory.Data', async () => {
      mockEstimate.mockResolvedValue({ quota: 1024 * 1024 * 1024, usage: 0 });
      mockWriteFile.mockResolvedValue(undefined);

      const file = new File(['data'], 'book.pdf', { type: 'application/pdf' });
      await fileStorage.storeFile(file, 'hash9');

      expect(mockWriteFile).toHaveBeenCalledWith({
        path: 'books/hash9.pdf',
        data: file,
        directory: Directory.Data,
        recursive: true,
      });
    });

    it('retrieveBlob streams via convertFileSrc instead of base64 readFile', async () => {
      mockStat.mockImplementation(({ directory, path }: { directory: string; path: string }) =>
        directory === Directory.Data && path === 'books/hash10.pdf'
          ? Promise.resolve({ size: 4 })
          : Promise.reject(new Error('nf')));
      mockGetUri.mockResolvedValue({ uri: 'file:///data/books/hash10.pdf' });
      mockFetch.mockResolvedValue({ ok: true, blob: async () => new Blob(['pdf!']) });

      const blob = await fileStorage.retrieveBlob('hash10', 'PDF');

      expect(mockGetUri).toHaveBeenCalledWith({
        path: 'books/hash10.pdf',
        directory: Directory.Data,
      });
      expect(mockFetch).toHaveBeenCalledWith('capacitor://localhost/_capacitor_file_file:///data/books/hash10.pdf');
      expect(blob.size).toBe(4);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('retrieveBlob falls back to the legacy base64 path', async () => {
      mockStat.mockRejectedValue(new Error('nf')); // nothing in Data
      const base64 = btoa('legacy-bytes');
      mockReadFile.mockImplementation(({ path }: { path: string }) =>
        path === 'books/old-uuid.epub'
          ? Promise.resolve({ data: base64 })
          : Promise.reject(new Error('nf')));

      const blob = await fileStorage.retrieveBlob('old-uuid');
      expect(blob.size).toBe(12);
    });
  });

  describe('migrateLegacyFiles', () => {
    it('moves uuid-keyed files to hash keys and sets contentHash', async () => {
      const contents = 'epub-bytes';
      const base64 = btoa(contents);
      const hash = await sha256Hex(new Blob([contents]));

      mockStat.mockImplementation(({ path }: { path: string }) =>
        path === 'books/book-1.epub' ? Promise.resolve({ size: contents.length }) : Promise.reject(new Error('nf')));
      mockReadFile.mockResolvedValue({ data: base64 });
      mockDeleteFile.mockResolvedValue(undefined);

      const book = { id: 'book-1', format: 'EPUB' } as never;
      const changed = await fileStorage.migrateLegacyFiles([book]);

      expect(changed).toBe(true);
      expect((book as { contentHash?: string }).contentHash).toBe(hash);
      expect(blobMap.has(`${hash}.epub`)).toBe(true);
      expect(mockDeleteFile).toHaveBeenCalledWith({
        path: 'books/book-1.epub',
        directory: Directory.Documents,
      });
    });

    it('skips books that already have contentHash or no file', async () => {
      const done = { id: 'a', contentHash: 'h' } as never;
      const missing = { id: 'b' } as never;
      mockStat.mockRejectedValue(new Error('nf'));

      const changed = await fileStorage.migrateLegacyFiles([done, missing]);

      expect(changed).toBe(false);
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOrphanFiles', () => {
    it('deletes files not in validKeys and returns count', async () => {
      blobMap.set('orphan.epub', new Blob(['x']));
      blobMap.set('valid.epub', new Blob(['x']));
      mockReaddir.mockResolvedValue({ files: [] });

      const count = await fileStorage.cleanupOrphanFiles(['valid']);

      expect(count).toBe(1);
      expect(blobMap.has('valid.epub')).toBe(true);
      expect(blobMap.has('orphan.epub')).toBe(false);
    });
  });
});
