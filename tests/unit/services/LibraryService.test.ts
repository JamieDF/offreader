import { describe, it, expect, beforeEach, vi } from 'vitest';
import { libraryService } from '@/services/LibraryService';
import { Book } from '@/types/book';
import { fileStorage } from '@/services/fileStorage';
import { storageService } from '@/services/storage';

// Mock the dependencies
vi.mock('@/services/fileStorage');
vi.mock('@/services/storage');

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: '1',
  title: 'Test',
  author: 'Author',
  coverImage: '',
  filePath: '/path',
  progress: 0,
  ...overrides,
});

describe('LibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    libraryService.updateBooksSilent([]);
  });

  describe('updateBooks vs updateBooksSilent', () => {
    it('should notify listeners on updateBooks', () => {
      const listener = vi.fn();
      const unsub = libraryService.subscribe(listener);

      libraryService.updateBooks([makeBook({ progress: 0.5 })]);
      expect(listener).toHaveBeenCalled();
      unsub();
    });

    it('should NOT notify listeners on updateBooksSilent', () => {
      const listener = vi.fn();
      const unsub = libraryService.subscribe(listener);

      libraryService.updateBooksSilent([makeBook({ progress: 0.5 })]);
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
      const books: Book[] = [makeBook()];
      libraryService.updateBooks(books);
      expect(libraryService.getBooks()).toEqual(books);
    });

    describe('Initialization', () => {
      it('does not read full book files while rehydrating the library', async () => {
        const book = makeBook({ id: 'book-1', filePath: '/old-url' });
        vi.mocked(storageService.getItem).mockResolvedValueOnce(JSON.stringify([book]));
        vi.mocked(fileStorage.fileExists).mockResolvedValueOnce(true);

        await libraryService.initialize();

        expect(fileStorage.retrieveFile).not.toHaveBeenCalled();
        expect(libraryService.getBooks()[0]).toMatchObject({
          id: book.id,
          filePath: '',
        });
      });
    });
  });
});
