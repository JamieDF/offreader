import { describe, it, expect, beforeEach, vi } from 'vitest';
import { libraryService } from '@/services/LibraryService';
import { fileStorage } from '@/services/fileStorage';
import { storageService } from '@/services/storage';
import { Book } from '@/types/book';

// Mock the dependencies
vi.mock('@/services/fileStorage');
vi.mock('@/services/storage');

describe('LibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryService.updateBooksSilent([]);
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const inst1 = libraryService;
      const inst2 = libraryService;
      expect(inst1).toBe(inst2);
    });
  });

  describe('updateBooks vs updateBooksSilent', () => {
    it('should notify listeners on updateBooks', () => {
      const listener = vi.fn();
      const unsub = libraryService.subscribe(listener);

      const books: Book[] = [{
        id: '1',
        title: 'Test',
        author: 'Author',
        filePath: '/path',
        progress: 0.5,
        lastReadDate: null
      }];

      libraryService.updateBooks(books);
      expect(listener).toHaveBeenCalled();
      unsub();
    });

    it('should NOT notify listeners on updateBooksSilent', () => {
      const listener = vi.fn();
      const unsub = libraryService.subscribe(listener);

      const books: Book[] = [{
        id: '1',
        title: 'Test',
        author: 'Author',
        filePath: '/path',
        progress: 0.5,
        lastReadDate: null
      }];

      libraryService.updateBooksSilent(books);
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe('Subscription Management', () => {
    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = libraryService.subscribe(listener1);
      const unsub2 = libraryService.subscribe(listener2);

      libraryService.updateBooks([]);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      unsub1();
      unsub2();
    });

    it('should unsubscribe properly', () => {
      const listener = vi.fn();
      const unsub = libraryService.subscribe(listener);

      libraryService.updateBooks([]);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
      libraryService.updateBooks([]);
      expect(listener).toHaveBeenCalledTimes(1); // No additional calls
    });
  });

  describe('Getters', () => {
    it('should return current books', () => {
      const books: Book[] = [{
        id: '1',
        title: 'Test',
        author: 'Author',
        filePath: '/path',
        progress: 0,
        lastReadDate: null
      }];
      libraryService.updateBooks(books);
      expect(libraryService.getBooks()).toEqual(books);
    });
  });
});
