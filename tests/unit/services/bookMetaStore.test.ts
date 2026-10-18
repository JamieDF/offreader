import { describe, it, expect, beforeEach } from 'vitest';
import { bookMetaStore, TrackerEntry } from '@/services/bookMetaStore';
import { Book } from '@/types/book';

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

const makeEntry = (overrides: Partial<TrackerEntry> = {}): TrackerEntry => ({
  progress: 0,
  lastReadDate: null,
  isFinished: false,
  bookmarks: [],
  ...overrides,
});

beforeEach(async () => {
  await bookMetaStore.writeBooks([]);
  const all = await bookMetaStore.getAllTracking();
  await bookMetaStore.deleteTracking(Object.keys(all));
});

describe('bookMetaStore books', () => {
  it('round-trips a book record', async () => {
    await bookMetaStore.putBook(makeBook('b1', { progress: 42 }));
    const books = await bookMetaStore.getAllBooks();
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({ id: 'b1', progress: 42 });
  });

  it('putBook upserts a single record without touching others', async () => {
    await bookMetaStore.writeBooks([makeBook('a'), makeBook('b')]);
    await bookMetaStore.putBook(makeBook('a', { progress: 99 }));
    const books = await bookMetaStore.getAllBooks();
    expect(books.find(b => b.id === 'a')?.progress).toBe(99);
    expect(books.find(b => b.id === 'b')?.progress).toBe(0);
  });

  it('writeBooks deletes records absent from the list', async () => {
    await bookMetaStore.writeBooks([makeBook('a'), makeBook('b'), makeBook('c')]);
    await bookMetaStore.writeBooks([makeBook('a'), makeBook('c')]);
    const books = await bookMetaStore.getAllBooks();
    expect(books.map(b => b.id).sort()).toEqual(['a', 'c']);
  });

  it('deleteBooks removes only the given ids', async () => {
    await bookMetaStore.writeBooks([makeBook('a'), makeBook('b')]);
    await bookMetaStore.deleteBooks(['a']);
    const books = await bookMetaStore.getAllBooks();
    expect(books.map(b => b.id)).toEqual(['b']);
  });
});

describe('bookMetaStore tracking', () => {
  it('round-trips a tracking entry by book id', async () => {
    await bookMetaStore.putTracking('b1', makeEntry({ progress: 55, currentLocation: 'epubcfi(/6/4)' }));
    const entry = await bookMetaStore.getTracking('b1');
    expect(entry).toMatchObject({ progress: 55, currentLocation: 'epubcfi(/6/4)' });
  });

  it('getTracking returns undefined for unknown ids', async () => {
    expect(await bookMetaStore.getTracking('nope')).toBeUndefined();
  });

  it('getAllTracking returns a bookId-keyed map', async () => {
    await bookMetaStore.putTracking('a', makeEntry({ progress: 10 }));
    await bookMetaStore.putTracking('b', makeEntry({ progress: 20 }));
    const all = await bookMetaStore.getAllTracking();
    expect(all['a'].progress).toBe(10);
    expect(all['b'].progress).toBe(20);
  });

  it('deleteTracking removes only the given ids', async () => {
    await bookMetaStore.putTracking('a', makeEntry());
    await bookMetaStore.putTracking('b', makeEntry());
    await bookMetaStore.deleteTracking(['a']);
    expect(await bookMetaStore.getTracking('a')).toBeUndefined();
    expect(await bookMetaStore.getTracking('b')).toBeDefined();
  });

  it('book and tracking records are independent', async () => {
    await bookMetaStore.writeBooks([makeBook('a')]);
    await bookMetaStore.putTracking('a', makeEntry({ progress: 77 }));
    await bookMetaStore.writeBooks([makeBook('a', { progress: 80 })]);
    expect((await bookMetaStore.getTracking('a'))?.progress).toBe(77);
  });
});
