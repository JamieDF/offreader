import { Book, Bookmark } from '@/types/book';

/**
 * Per-book metadata store: one IndexedDB database, two object stores.
 *
 * - `books`: full Book records keyed by `id`. Replaces the single
 *   `offreader-books` Preferences blob that every mutation rewrote
 *   wholesale (progress ticks included).
 * - `tracking`: per-book reading state (resume CFI, bookmarks, stats)
 *   keyed by book id. Replaces the `book-tracker-data` Preferences map.
 *
 * Available on every platform including the Android WebView, so no
 * platform split is needed.
 */

export interface TrackerEntry {
  progress: number;
  lastReadDate: string | null;
  currentChapter?: number;
  currentChapterLabel?: string;
  currentPage?: number;
  totalPagesInChapter?: number;
  isFinished: boolean;
  /** CFI or href for resume position. */
  currentLocation?: string;
  bookmarks: Bookmark[];
}

const DB_NAME = 'offreader-metadata';
const BOOKS_STORE = 'books';
const TRACKING_STORE = 'tracking';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
        db.createObjectStore(TRACKING_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Run ops across both stores in one transaction: resolves on complete,
 *  so multi-write updates commit atomically or not at all. */
async function txAll(
  mode: IDBTransactionMode,
  stores: string[],
  run: (get: (name: string) => IDBObjectStore) => void,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    run(name => tx.objectStore(name));
  });
}

async function tx<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return req(run(db.transaction(storeName, mode).objectStore(storeName)));
}

export const bookMetaStore = {
  // --- Book records -------------------------------------------------------

  getAllBooks(): Promise<Book[]> {
    return tx(BOOKS_STORE, 'readonly', store => store.getAll());
  },

  /** Upsert a single book: the hot path for progress ticks and edits. */
  putBook(book: Book): Promise<void> {
    return tx(BOOKS_STORE, 'readwrite', store => store.put(book)).then(() => undefined);
  },

  /** Authoritative replace: writes every book and deletes records whose ids
   *  are no longer in the list, atomically. */
  async writeBooks(books: Book[]): Promise<void> {
    const keep = new Set(books.map(b => b.id));
    const existing = (await tx(BOOKS_STORE, 'readonly', s => s.getAllKeys())) as string[];
    const stale = existing.filter(id => !keep.has(id));
    await txAll('readwrite', [BOOKS_STORE], get => {
      const store = get(BOOKS_STORE);
      for (const book of books) store.put(book);
      for (const id of stale) store.delete(id);
    });
  },

  deleteBooks(ids: string[]): Promise<void> {
    return txAll('readwrite', [BOOKS_STORE], get => {
      const store = get(BOOKS_STORE);
      for (const id of ids) store.delete(id);
    });
  },

  // --- Tracking records ---------------------------------------------------

  getTracking(bookId: string): Promise<TrackerEntry | undefined> {
    return tx(TRACKING_STORE, 'readonly', store => store.get(bookId));
  },

  putTracking(bookId: string, entry: TrackerEntry): Promise<void> {
    return tx(TRACKING_STORE, 'readwrite', store => store.put(entry, bookId)).then(() => undefined);
  },

  /** All tracking records as a bookId-keyed map, matching the shape the old
   *  `book-tracker-data` JSON returned. */
  async getAllTracking(): Promise<Record<string, TrackerEntry>> {
    const db = await openDb();
    const tx = db.transaction(TRACKING_STORE, 'readonly');
    const store = tx.objectStore(TRACKING_STORE);
    const [keys, values] = await Promise.all([
      req(store.getAllKeys() as IDBRequest<string[]>),
      req(store.getAll() as IDBRequest<TrackerEntry[]>),
    ]);
    const map: Record<string, TrackerEntry> = {};
    keys.forEach((key, i) => { map[key] = values[i]; });
    return map;
  },

  deleteTracking(ids: string[]): Promise<void> {
    return txAll('readwrite', [TRACKING_STORE], get => {
      const store = get(TRACKING_STORE);
      for (const id of ids) store.delete(id);
    });
  },
};
