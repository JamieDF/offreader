import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scanFolder, relinkBookFile, getSyncFolders } from '@/services/folderSync';
import { libraryService } from '@/services/LibraryService';
import { fileStorage } from '@/services/fileStorage';
import { importFileItems } from '@/services/bookImport';
import { sha256Hex } from '@/utils/hash';
import { Book } from '@/types/book';

vi.mock('@/services/bookImport', () => ({
  importFileItems: vi.fn(async () => []),
}));

vi.mock('@/services/fileStorage', () => ({
  fileStorage: { retrieveLinkedBlob: vi.fn() },
}));

vi.mock('@/services/bookPersistence', () => ({
  saveStoredBooks: vi.fn(async () => {}),
}));

const mockGetItem = vi.fn();
const mockSetItem = vi.fn();
vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: 'b1',
  title: 'T',
  author: 'A',
  coverImage: '',
  filePath: '',
  progress: 0,
  shelfId: null,
  labelIds: [],
  ...overrides,
});

const scanEntry = (path: string) => ({ path, name: path.split('/').pop()!, size: 10, mtimeMs: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  libraryService.updateBooksSilent([]);
  mockGetItem.mockResolvedValue(null);
});

afterEach(() => {
  delete (window as { offreaderFiles?: unknown }).offreaderFiles;
});

describe('scanFolder', () => {
  it('is a no-op without the desktop file API', async () => {
    expect(await scanFolder('/books')).toEqual({ added: 0, moved: 0, missing: 0 });
  });

  it('imports unknown files as linked books with precomputed hashes', async () => {
    const blob = new Blob(['x']);
    const hash = await sha256Hex(blob);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/new.epub')]),
    } as never;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockResolvedValue(blob);

    const result = await scanFolder('/books');

    expect(importFileItems).toHaveBeenCalledWith(
      [expect.objectContaining({ sourcePath: '/books/new.epub', contentHash: hash })],
      'linked',
    );
    expect(result.added).toBe(0); // importFileItems mocked to return []
  });

  it('skips already-linked paths without reading the file', async () => {
    libraryService.updateBooksSilent([
      makeBook({ source: 'linked', sourcePath: '/books/dune.epub', contentHash: 'h' }),
    ]);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/dune.epub')]),
    } as never;

    await scanFolder('/books');

    expect(fileStorage.retrieveLinkedBlob).not.toHaveBeenCalled();
    expect(importFileItems).not.toHaveBeenCalled();
  });

  it('repoints a linked book when its content is found at a new path', async () => {
    const blob = new Blob(['same-bytes']);
    const hash = await sha256Hex(blob);
    libraryService.updateBooksSilent([
      makeBook({ id: 'b1', source: 'linked', sourcePath: '/books/old-name.epub', contentHash: hash, missing: true }),
    ]);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/renamed.epub')]),
    } as never;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockResolvedValue(blob);

    const result = await scanFolder('/books');

    expect(result.moved).toBe(1);
    expect(importFileItems).not.toHaveBeenCalled();
    const book = libraryService.getBooks()[0];
    expect(book.sourcePath).toBe('/books/renamed.epub');
    expect(book.missing).toBeUndefined();
  });

  it('does not repoint when the hash matches a managed book', async () => {
    const blob = new Blob(['managed-bytes']);
    const hash = await sha256Hex(blob);
    libraryService.updateBooksSilent([
      makeBook({ id: 'm1', source: 'managed', contentHash: hash }),
    ]);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/dup.epub')]),
    } as never;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockResolvedValue(blob);

    await scanFolder('/books');

    expect(importFileItems).not.toHaveBeenCalled();
    expect(libraryService.getBooks()[0].source).toBe('managed');
  });

  it('flags linked books under the folder whose files vanished', async () => {
    libraryService.updateBooksSilent([
      makeBook({ id: 'b1', source: 'linked', sourcePath: '/books/deleted.epub' }),
      makeBook({ id: 'b2', source: 'linked', sourcePath: '/elsewhere/kept.epub' }),
    ]);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => []),
    } as never;

    const result = await scanFolder('/books');

    expect(result.missing).toBe(1);
    const [gone, kept] = libraryService.getBooks();
    expect(gone.missing).toBe(true);
    expect(kept.missing).toBeUndefined();
  });

  it('clears missing when the file comes back', async () => {
    libraryService.updateBooksSilent([
      makeBook({ id: 'b1', source: 'linked', sourcePath: '/books/back.epub', missing: true }),
    ]);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/back.epub')]),
    } as never;

    const result = await scanFolder('/books');

    expect(result.missing).toBe(0);
    expect(libraryService.getBooks()[0].missing).toBeUndefined();
  });
});

describe('relinkBookFile', () => {
  it('repoints sourcePath and refreshes contentHash', async () => {
    const blob = new Blob(['new-location']);
    const hash = await sha256Hex(blob);
    libraryService.updateBooksSilent([
      makeBook({ id: 'b1', source: 'linked', sourcePath: '/books/gone.epub', contentHash: 'old', missing: true }),
    ]);
    window.offreaderFiles = { registerPath: vi.fn() } as never;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockResolvedValue(blob);

    expect(await relinkBookFile('b1', '/books/found.epub')).toBe(true);

    const book = libraryService.getBooks()[0];
    expect(book.sourcePath).toBe('/books/found.epub');
    expect(book.contentHash).toBe(hash);
    expect(book.missing).toBeUndefined();
  });

  it('refuses to relink managed books', async () => {
    libraryService.updateBooksSilent([makeBook({ id: 'm', source: 'managed' })]);
    window.offreaderFiles = {} as never;
    expect(await relinkBookFile('m', '/x.epub')).toBe(false);
  });
});

describe('getSyncFolders', () => {
  it('parses the stored list and tolerates junk', async () => {
    mockGetItem.mockResolvedValueOnce('["/a","/b"]');
    expect(await getSyncFolders()).toEqual(['/a', '/b']);
    mockGetItem.mockResolvedValueOnce('not json');
    expect(await getSyncFolders()).toEqual([]);
  });
});
