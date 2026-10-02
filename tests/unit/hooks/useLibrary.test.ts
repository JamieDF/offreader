import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibrary } from '@/hooks/useLibrary';
import { libraryService } from '@/services/LibraryService';
import { storageService } from '@/services/storage';
import { fileStorage } from '@/services/fileStorage';
import { saveStoredBooks } from '@/services/bookPersistence';
import { Book } from '@/types/book';

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/LibraryService', () => ({
  libraryService: {
    getBooks: vi.fn().mockReturnValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    updateBooks: vi.fn(),
    updateBooksSilent: vi.fn(),
  },
}));

vi.mock('@/services/fileStorage', () => ({
  fileStorage: {
    storeFile: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    retrieveFile: vi.fn(),
  },
}));

vi.mock('@/services/bookPersistence', () => ({
  getStoredTrackerData: vi.fn().mockResolvedValue({}),
  saveStoredBooks: vi.fn().mockResolvedValue(undefined),
}));

// Imported at module level by useLibrary but only exercised by importBooks.
vi.mock('@/parsers/bookMetadataParser', () => ({
  extractBookMetadata: vi.fn(),
}));

const mockGetBooks = libraryService.getBooks as ReturnType<typeof vi.fn>;
const mockUpdateBooks = libraryService.updateBooks as ReturnType<typeof vi.fn>;
const mockSaveStoredBooks = saveStoredBooks as ReturnType<typeof vi.fn>;
const mockDeleteFile = fileStorage.deleteFile as ReturnType<typeof vi.fn>;
const mockGetItem = storageService.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = storageService.setItem as ReturnType<typeof vi.fn>;
const mockRemoveItem = storageService.removeItem as ReturnType<typeof vi.fn>;

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: '1',
  title: 'Test',
  author: 'Author',
  coverImage: '',
  filePath: '/path',
  progress: 0,
  shelfId: null,
  labelIds: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
});

describe('useLibrary bulk operations', () => {
  describe('assignBooksToShelf', () => {
    it('assigns the shelf to selected books only and persists once', async () => {
      const books = [
        makeBook({ id: 'a' }),
        makeBook({ id: 'b', shelfId: 'old-shelf' }),
        makeBook({ id: 'c', shelfId: 'keep-me' }),
      ];
      mockGetBooks.mockReturnValue(books);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.assignBooksToShelf(['a', 'b'], 'shelf-1');
      });

      const written = mockUpdateBooks.mock.calls[0][0] as Book[];
      expect(written.find(b => b.id === 'a')!.shelfId).toBe('shelf-1');
      expect(written.find(b => b.id === 'b')!.shelfId).toBe('shelf-1');
      expect(written.find(b => b.id === 'c')!.shelfId).toBe('keep-me');
      expect(mockSaveStoredBooks).toHaveBeenCalledTimes(1);
      expect(mockSaveStoredBooks).toHaveBeenCalledWith(written);
    });

    it('supports unassigning by passing null', async () => {
      mockGetBooks.mockReturnValue([makeBook({ id: 'a', shelfId: 'shelf-1' })]);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.assignBooksToShelf(['a'], null);
      });

      expect((mockUpdateBooks.mock.calls[0][0] as Book[])[0].shelfId).toBeNull();
    });
  });

  describe('applyLabelChanges', () => {
    it('adds and removes labels per book while preserving untouched labels', async () => {
      const books = [
        makeBook({ id: 'a', labelIds: ['shared', 'a-only'] }),
        makeBook({ id: 'b', labelIds: ['shared', 'b-only'] }),
        makeBook({ id: 'c', labelIds: ['shared'] }),
      ];
      mockGetBooks.mockReturnValue(books);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.applyLabelChanges(
          ['a', 'b'],
          new Set(['new-label']),
          new Set(['shared']),
        );
      });

      const written = mockUpdateBooks.mock.calls[0][0] as Book[];
      expect(written.find(b => b.id === 'a')!.labelIds.sort()).toEqual(['a-only', 'new-label']);
      expect(written.find(b => b.id === 'b')!.labelIds.sort()).toEqual(['b-only', 'new-label']);
      // 'c' not selected — untouched
      expect(written.find(b => b.id === 'c')!.labelIds).toEqual(['shared']);
      expect(mockSaveStoredBooks).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate a label a book already has', async () => {
      mockGetBooks.mockReturnValue([makeBook({ id: 'a', labelIds: ['existing'] })]);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.applyLabelChanges(['a'], new Set(['existing']), new Set());
      });

      expect((mockUpdateBooks.mock.calls[0][0] as Book[])[0].labelIds).toEqual(['existing']);
    });
  });

  describe('removeBooks', () => {
    it('deletes files, removes books, and cleans tracker + per-book storage', async () => {
      const books = [makeBook({ id: 'a' }), makeBook({ id: 'b' }), makeBook({ id: 'c' })];
      mockGetBooks.mockReturnValue(books);
      mockGetItem.mockResolvedValue(JSON.stringify({
        a: { progress: 50 },
        b: { progress: 10 },
        c: { progress: 80 },
      }));

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.removeBooks(['a', 'b']);
      });

      expect(mockDeleteFile).toHaveBeenCalledTimes(2);
      expect(mockDeleteFile).toHaveBeenCalledWith('a');
      expect(mockDeleteFile).toHaveBeenCalledWith('b');

      const written = mockUpdateBooks.mock.calls[0][0] as Book[];
      expect(written.map(b => b.id)).toEqual(['c']);
      expect(mockSaveStoredBooks).toHaveBeenCalledTimes(1);

      const trackerWrite = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(trackerWrite).toEqual({ c: { progress: 80 } });

      expect(mockRemoveItem).toHaveBeenCalledWith('offreader-book-a');
      expect(mockRemoveItem).toHaveBeenCalledWith('offreader-book-b');
      expect(mockRemoveItem).not.toHaveBeenCalledWith('offreader-book-c');
    });

    it('still updates the library when tracker data does not exist', async () => {
      mockGetBooks.mockReturnValue([makeBook({ id: 'a' }), makeBook({ id: 'b' })]);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.removeBooks(['a']);
      });

      expect((mockUpdateBooks.mock.calls[0][0] as Book[]).map(b => b.id)).toEqual(['b']);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it('does not delete bytes a surviving managed book still shares', async () => {
      mockGetBooks.mockReturnValue([
        makeBook({ id: 'm1', contentHash: 'H' }),
        makeBook({ id: 'm2', contentHash: 'H' }),
      ]);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.removeBooks(['m1']);
      });

      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it('does not let a surviving linked book protect managed bytes', async () => {
      mockGetBooks.mockReturnValue([
        makeBook({ id: 'm', contentHash: 'H' }),
        makeBook({ id: 'l', contentHash: 'H', source: 'linked', sourcePath: '/x.epub' }),
      ]);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.removeBooks(['m']);
      });

      // The linked survivor has no stored bytes — the managed blob is orphaned
      // and must be deleted rather than kept under the shared hash key.
      expect(mockDeleteFile).toHaveBeenCalledWith('H');
    });

    it('never deletes bytes when removing a linked book', async () => {
      mockGetBooks.mockReturnValue([
        makeBook({ id: 'l', contentHash: 'H', source: 'linked', sourcePath: '/x.epub' }),
      ]);

      const { result } = renderHook(() => useLibrary());
      await act(async () => {
        await result.current.removeBooks(['l']);
      });

      expect(mockDeleteFile).not.toHaveBeenCalled();
    });
  });
});
