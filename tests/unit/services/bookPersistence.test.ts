import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredBooks,
  getStoredTrackerData,
  migrateLegacyMetadata,
  saveBook,
  saveStoredBooks,
  deleteBookTracking,
} from '@/services/bookPersistence';
import { bookMetaStore } from '@/services/bookMetaStore';
import { storageService } from '@/services/storage';
import { Book } from '@/types/book';

const mockGetItem = vi.fn().mockResolvedValue(null);
const mockRemoveItem = vi.fn().mockResolvedValue(undefined);

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));

const makeBook = (id: string, overrides: Partial<Book> = {}): Book => ({
  id,
  title: `Book ${id}`,
  author: 'Author',
  coverImage: '',
  filePath: '',
  progress: 0,
  shelfId: null,
  labelIds: [],
  ...overrides,
});

beforeEach(async () => {
  vi.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  await bookMetaStore.writeBooks([]);
  const all = await bookMetaStore.getAllTracking();
  await bookMetaStore.deleteTracking(Object.keys(all));
});

describe('bookPersistence', () => {
  it('saveBook upserts a single record', async () => {
    await saveStoredBooks([makeBook('a'), makeBook('b')]);
    await saveBook(makeBook('a', { progress: 61 }));
    const books = await getStoredBooks();
    expect(books.find(b => b.id === 'a')?.progress).toBe(61);
    expect(books).toHaveLength(2);
  });

  it('saveStoredBooks is an authoritative replace', async () => {
    await saveStoredBooks([makeBook('a'), makeBook('b')]);
    await saveStoredBooks([makeBook('b')]);
    expect((await getStoredBooks()).map(b => b.id)).toEqual(['b']);
  });

  it('getStoredTrackerData returns the tracking map', async () => {
    await bookMetaStore.putTracking('a', {
      progress: 33, lastReadDate: '2026-01-01', isFinished: false, bookmarks: [],
    });
    const data = await getStoredTrackerData();
    expect(data['a'].progress).toBe(33);
  });

  it('deleteBookTracking drops tracker records only', async () => {
    await saveStoredBooks([makeBook('a')]);
    await bookMetaStore.putTracking('a', {
      progress: 1, lastReadDate: null, isFinished: false, bookmarks: [],
    });
    await deleteBookTracking(['a']);
    expect(await bookMetaStore.getTracking('a')).toBeUndefined();
    expect(await getStoredBooks()).toHaveLength(1);
  });
});

describe('migrateLegacyMetadata', () => {
  it('moves the legacy books blob into the per-book store and removes the key', async () => {
    mockGetItem.mockImplementation(async (key: string) =>
      key === 'offreader-books' ? JSON.stringify([makeBook('legacy-1', { progress: 88 })]) : null);

    await migrateLegacyMetadata();

    expect((await getStoredBooks())[0]).toMatchObject({ id: 'legacy-1', progress: 88 });
    expect(mockRemoveItem).toHaveBeenCalledWith('offreader-books');
  });

  it('moves the legacy tracker map into per-book tracking records', async () => {
    mockGetItem.mockImplementation(async (key: string) =>
      key === 'book-tracker-data'
        ? JSON.stringify({ 'b1': { progress: 44, lastReadDate: null, isFinished: false, bookmarks: [] } })
        : null);

    await migrateLegacyMetadata();

    expect((await getStoredTrackerData())['b1'].progress).toBe(44);
    expect(mockRemoveItem).toHaveBeenCalledWith('book-tracker-data');
  });

  it('merges legacy books with existing store records instead of wiping', async () => {
    await saveBook(makeBook('new-1'));
    mockGetItem.mockImplementation(async (key: string) =>
      key === 'offreader-books' ? JSON.stringify([makeBook('legacy-1')]) : null);

    await migrateLegacyMetadata();

    const ids = (await getStoredBooks()).map(b => b.id).sort();
    expect(ids).toEqual(['legacy-1', 'new-1']);
  });

  it('is a no-op when no legacy keys exist', async () => {
    await migrateLegacyMetadata();
    expect(await getStoredBooks()).toHaveLength(0);
  });
});
