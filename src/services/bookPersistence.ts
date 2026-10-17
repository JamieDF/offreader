/**
 * Persistence helpers for book library and tracker data.
 *
 * Book and tracking records live in the per-book IndexedDB store
 * (bookMetaStore): each mutation writes a single small record instead of
 * re-serializing the whole library. Legacy whole-library Preferences blobs
 * (`offreader-books`, `book-tracker-data`) are migrated on first load.
 */

import { Book } from '@/types/book';
import { storageService } from '@/services/storage';
import { bookMetaStore, TrackerEntry } from '@/services/bookMetaStore';

const TRACKER_STORAGE_KEY = 'book-tracker-data';
const BOOKS_STORAGE_KEY = 'offreader-books';

export interface StoredBookData {
  [bookId: string]: TrackerEntry;
}

/**
 * One-time migration: copies the legacy Preferences blobs into the per-book
 * store, then removes the legacy keys. Merges rather than replaces so a
 * partially-migrated library can't lose records. Safe to run every startup.
 */
export async function migrateLegacyMetadata(): Promise<void> {
  const legacyBooks = await storageService.getItem(BOOKS_STORAGE_KEY);
  if (legacyBooks) {
    try {
      const books = JSON.parse(legacyBooks) as Book[];
      if (Array.isArray(books)) {
        for (const book of books) await bookMetaStore.putBook(book);
      }
    } catch (error) {
      console.error('Failed to migrate book metadata:', error);
    }
    await storageService.removeItem(BOOKS_STORAGE_KEY);
  }

  const legacyTracker = await storageService.getItem(TRACKER_STORAGE_KEY);
  if (legacyTracker) {
    try {
      const map = JSON.parse(legacyTracker) as Record<string, TrackerEntry>;
      for (const [bookId, entry] of Object.entries(map)) {
        await bookMetaStore.putTracking(bookId, entry);
      }
    } catch (error) {
      console.error('Failed to migrate tracker data:', error);
    }
    await storageService.removeItem(TRACKER_STORAGE_KEY);
  }
}

export async function getStoredBooks(): Promise<Book[]> {
  return bookMetaStore.getAllBooks();
}

/** Upsert one book record: the hot path for progress ticks and single-book
 *  edits (relink, chapter refresh, metadata edits). */
export async function saveBook(book: Book): Promise<void> {
  try {
    await bookMetaStore.putBook(book);
  } catch (error) {
    console.error('Failed to save book:', error);
  }
}

/** Authoritative replace: the given array IS the library. Records absent
 *  from it are deleted. Bulk ops (import, delete, sync) use this. */
export const saveStoredBooks = async (books: Book[]): Promise<void> => {
  try {
    await bookMetaStore.writeBooks(books);
  } catch (error) {
    console.error('Failed to save books:', error);
  }
};

export async function getStoredTrackerData(): Promise<StoredBookData> {
  try {
    return await bookMetaStore.getAllTracking();
  } catch {
    return {};
  }
}

/** Remove a book's metadata and tracking records together. File bytes are
 *  the caller's concern (shared-hash refcounting lives there). */
export async function deleteBookData(bookIds: string[]): Promise<void> {
  await Promise.all([
    bookMetaStore.deleteBooks(bookIds),
    bookMetaStore.deleteTracking(bookIds),
  ]);
}

/** Drop tracking records only: used when the book list itself is written
 *  through saveStoredBooks. */
export async function deleteBookTracking(bookIds: string[]): Promise<void> {
  await bookMetaStore.deleteTracking(bookIds);
}
