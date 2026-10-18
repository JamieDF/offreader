/**
 * Minimal IndexedDB-backed binary store for book files on web/Electron.
 *
 * Books are stored as raw Blobs keyed by `<contentHash>.<ext>`: no base64,
 * no Capacitor bridge. `get` returns the stored Blob directly so the reader
 * can wrap it in a File without any decode pass.
 *
 * (The Capacitor Filesystem web shim also uses IndexedDB, but persists base64
 * strings: this store exists to keep bytes as bytes.)
 */

const DB_NAME = 'offreader-files';
const STORE = 'books';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // If the DB fails to open, don't poison the cache: next call retries.
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

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return req(run(db.transaction(STORE, mode).objectStore(STORE)));
}

export const blobStore = {
  get(key: string): Promise<Blob | undefined> {
    return tx('readonly', store => store.get(key));
  },

  /** Existence check that doesn't materialize the blob value. */
  has(key: string): Promise<boolean> {
    return tx('readonly', store => store.getKey(key)).then(k => k !== undefined);
  },

  put(key: string, blob: Blob): Promise<void> {
    return tx('readwrite', store => store.put(blob, key)).then(() => undefined);
  },

  delete(key: string): Promise<void> {
    return tx('readwrite', store => store.delete(key)).then(() => undefined);
  },

  keys(): Promise<IDBValidKey[]> {
    return tx('readonly', store => store.getAllKeys());
  },
};
