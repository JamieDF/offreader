import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scanFolder, relinkBookFile, getSyncFolders, enqueuePendingIndex } from '@/services/folderSync';
import { libraryService } from '@/services/LibraryService';
import { fileStorage } from '@/services/fileStorage';
import { sha256Hex } from '@/utils/hash';
import { Book } from '@/types/book';

vi.mock('@/services/bookImport', () => ({
  importFileItems: vi.fn(async () => []),
  toastImportError: vi.fn(),
}));

vi.mock('@/parsers/bookMetadataParser', () => ({
  extractBookMetadata: vi.fn(async () => ({
    title: 'Parsed Title',
    author: 'Parsed Author',
    chapters: [],
    totalChapters: 0,
    format: 'EPUB',
  })),
}));

vi.mock('@/services/fileStorage', () => ({
  fileStorage: {
    retrieveLinkedBlob: vi.fn(),
    bookFileExists: vi.fn(async () => true),
  },
}));

vi.mock('@/services/bookPersistence', () => ({
  saveStoredBooks: vi.fn(async () => {}),
  saveBook: vi.fn(async () => {}),
  deleteBookData: vi.fn(async () => {}),
  deleteBookTracking: vi.fn(async () => {}),
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

/** The index queue drains in the background; wait until no linked book is
 *  left without a contentHash (or until the book count settles). */
const drainIndex = async (assertion: () => void) => {
  await vi.waitFor(assertion, { timeout: 2000 });
};

beforeEach(() => {
  vi.clearAllMocks();
  libraryService.updateBooksSilent([]);
  mockGetItem.mockResolvedValue(null);
  vi.mocked(fileStorage.bookFileExists).mockResolvedValue(true);
});

afterEach(() => {
  delete (window as { offreaderFiles?: unknown }).offreaderFiles;
});

describe('scanFolder', () => {
  it('is a no-op without the desktop file API', async () => {
    expect(await scanFolder('/books')).toEqual({ added: 0, moved: 0, missing: 0 });
  });

  it('creates a stub for unknown files without waiting on file reads, then indexes in the background', async () => {
    const blob = new Blob(['x']);
    const hash = await sha256Hex(blob);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/new.epub')]),
    } as never;
    // Hold the queue's read so the stat-only phase can be asserted.
    let resolveRead!: (b: Blob) => void;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockReturnValue(
      new Promise(r => { resolveRead = r; })
    );

    const result = await scanFolder('/books');

    expect(result.added).toBe(1);
    const stub = libraryService.getBooks()[0];
    expect(stub.source).toBe('linked');
    expect(stub.sourcePath).toBe('/books/new.epub');
    expect(stub.title).toBe('new');
    expect(stub.contentHash).toBeUndefined();

    // The background queue fills in hash + parsed metadata.
    resolveRead(blob);
    await drainIndex(() => {
      expect(libraryService.getBooks()[0].contentHash).toBe(hash);
    });
    const indexed = libraryService.getBooks()[0];
    expect(indexed.title).toBe('Parsed Title');
    expect(indexed.author).toBe('Parsed Author');
  });

  it('skips already-linked paths without reading the file', async () => {
    libraryService.updateBooksSilent([
      makeBook({ source: 'linked', sourcePath: '/books/dune.epub', contentHash: 'h' }),
    ]);
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/dune.epub')]),
    } as never;

    const result = await scanFolder('/books');

    expect(result.added).toBe(0);
    expect(fileStorage.retrieveLinkedBlob).not.toHaveBeenCalled();
  });

  it('repoints a missing linked book when the index queue finds its hash at a new path', async () => {
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

    // Stat pass only: a stub was created and the old record stays missing.
    expect(result.added).toBe(1);
    expect(result.moved).toBe(0);
    expect(libraryService.getBooks()).toHaveLength(2);

    // The queue merges them once the hash lands.
    await drainIndex(() => {
      expect(libraryService.getBooks()).toHaveLength(1);
    });
    const book = libraryService.getBooks()[0];
    expect(book.id).toBe('b1');
    expect(book.sourcePath).toBe('/books/renamed.epub');
    expect(book.missing).toBeUndefined();
  });

  it('drops the stub when the hash matches a managed book, then skips on rescan', async () => {
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
    expect(libraryService.getBooks()).toHaveLength(2);

    await drainIndex(() => {
      expect(libraryService.getBooks()).toHaveLength(1);
    });
    expect(libraryService.getBooks()[0].source).toBe('managed');

    // Rescan: the recorded dup skips the file entirely, no stub, no read.
    vi.mocked(fileStorage.retrieveLinkedBlob).mockClear();
    const rescan = await scanFolder('/books');
    expect(rescan.added).toBe(0);
    expect(libraryService.getBooks()).toHaveLength(1);
    expect(fileStorage.retrieveLinkedBlob).not.toHaveBeenCalled();
  });

  it('re-imports a skipped dup once the matched book is deleted', async () => {
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
    await drainIndex(() => {
      expect(libraryService.getBooks()).toHaveLength(1);
    });

    // Delete the managed book: the marker stops matching, the file imports.
    libraryService.updateBooksSilent([]);
    const rescan = await scanFolder('/books');
    expect(rescan.added).toBe(1);
    expect(libraryService.getBooks()[0].sourcePath).toBe('/books/dup.epub');
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

  it('drops the stub, records the failure, and skips it on rescan', async () => {
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/bad.epub')]),
    } as never;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockRejectedValue(new Error('unreadable'));

    const result = await scanFolder('/books');
    expect(result.added).toBe(1);

    await drainIndex(() => {
      expect(libraryService.getBooks()).toHaveLength(0);
    });
    await drainIndex(() => {
      const failuresJson = mockSetItem.mock.calls
        .find(([key]) => key === 'offreader-sync-failures')?.[1] as string | undefined;
      expect(failuresJson).toContain('/books/bad.epub');
    });

    // Rescan: the unchanged failure skips the file entirely, no stub, no read.
    vi.mocked(fileStorage.retrieveLinkedBlob).mockClear();
    const rescan = await scanFolder('/books');
    expect(rescan.added).toBe(0);
    expect(libraryService.getBooks()).toHaveLength(0);
    expect(fileStorage.retrieveLinkedBlob).not.toHaveBeenCalled();
  });

  it('marks the stub missing when the file vanished before indexing', async () => {
    window.offreaderFiles = {
      scanFolder: vi.fn(async () => [scanEntry('/books/gone.epub')]),
    } as never;
    vi.mocked(fileStorage.retrieveLinkedBlob).mockRejectedValue(new Error('not found'));
    vi.mocked(fileStorage.bookFileExists).mockResolvedValue(false);

    await scanFolder('/books');

    await drainIndex(() => {
      expect(libraryService.getBooks()[0]?.missing).toBe(true);
    });
  });
});

describe('enqueuePendingIndex', () => {
  it('indexes linked books that still lack a contentHash', async () => {
    const blob = new Blob(['resumed']);
    const hash = await sha256Hex(blob);
    libraryService.updateBooksSilent([
      makeBook({ id: 's1', source: 'linked', sourcePath: '/books/stub.epub' }),
      makeBook({ id: 'done', source: 'linked', sourcePath: '/books/done.epub', contentHash: 'h' }),
    ]);
    vi.mocked(fileStorage.retrieveLinkedBlob).mockResolvedValue(blob);

    expect(enqueuePendingIndex()).toBe(1);

    await drainIndex(() => {
      expect(libraryService.getBooks().find(b => b.id === 's1')?.contentHash).toBe(hash);
    });
    expect(libraryService.getBooks().find(b => b.id === 'done')?.contentHash).toBe('h');
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
