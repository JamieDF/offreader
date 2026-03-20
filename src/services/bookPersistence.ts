/**
 * Persistence helpers for book library and tracker data.
 */

import { Book } from '@/types/book';
import { storageService } from '@/services/storage';

const TRACKER_STORAGE_KEY = 'book-tracker-data';

export interface StoredBookData {
  [bookId: string]: {
    progress: number;
    lastReadDate: string | null;
    currentChapter: number;
    isFinished: boolean;
  };
}

export async function getStoredTrackerData(): Promise<StoredBookData> {
  try {
    const data = await storageService.getItem(TRACKER_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export const saveStoredBooks = async (books: Book[]): Promise<void> => {
  try {
    await storageService.setItem('offreader-books', JSON.stringify(books));
  } catch (error) {
    console.error('Failed to save books:', error);
  }
};
