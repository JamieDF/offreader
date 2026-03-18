import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBookTracker } from '@/hooks/useBookTracker';
import { storageService } from '@/services/storage';
import { libraryService } from '@/services/LibraryService';

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/LibraryService', () => ({
  libraryService: {
    getBooks: vi.fn().mockReturnValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

const mockGetItem = storageService.getItem as ReturnType<typeof vi.fn>;
const mockGetBooks = libraryService.getBooks as ReturnType<typeof vi.fn>;

function storedDataFor(bookId: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    [bookId]: {
      progress: 50,
      lastReadDate: null,
      isFinished: false,
      bookmarks: [],
      currentChapter: 2,
      ...overrides,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockGetBooks.mockReturnValue([]);
});

// ─── getResumeLabel ────────────────────────────────────────────────────────

describe('getResumeLabel', () => {
  it('returns "Start Reading" when progress is 0', async () => {
    const { result } = renderHook(() => useBookTracker('book-1'));
    await act(async () => {});
    expect(result.current.getResumeLabel()).toBe('Start Reading');
  });

  it('returns "Resume at Chapter N" when reading is in progress', async () => {
    const { result } = renderHook(() => useBookTracker('book-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.updateProgress(40, 3); // currentChapter = 3 → label uses + 1
    });
    expect(result.current.getResumeLabel()).toBe('Resume at Chapter 4');
  });

  it('returns "Read Again" when book is finished', async () => {
    const { result } = renderHook(() => useBookTracker('book-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.markAsFinished(true);
    });
    expect(result.current.getResumeLabel()).toBe('Read Again');
  });

  it('returns "Resume at Chapter 1" for chapter 0 with progress', async () => {
    const { result } = renderHook(() => useBookTracker('book-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.updateProgress(10); // no chapter arg → stays at 0
    });
    expect(result.current.getResumeLabel()).toBe('Resume at Chapter 1');
  });
});

// ─── formatLastRead ────────────────────────────────────────────────────────

describe('formatLastRead', () => {
  it('returns "Never" when the book has never been read', async () => {
    const { result } = renderHook(() => useBookTracker('book-1'));
    await act(async () => {});
    expect(result.current.formatLastRead()).toBe('Never');
  });

  it('returns "Today" after a progress update (sets lastReadDate to now)', async () => {
    const { result } = renderHook(() => useBookTracker('book-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      result.current.updateProgress(20);
    });
    expect(result.current.formatLastRead()).toBe('Today');
  });

  it('returns "Yesterday" for a lastReadDate one day ago', async () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    mockGetItem.mockResolvedValue(storedDataFor('book-1', { lastReadDate: yesterday }));

    const { result } = renderHook(() => useBookTracker('book-1'));
    await act(async () => {});

    expect(result.current.formatLastRead()).toBe('Yesterday');
  });

  it('returns "N days ago" for dates within the past week', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    mockGetItem.mockResolvedValue(storedDataFor('book-1', { lastReadDate: fourDaysAgo }));

    const { result } = renderHook(() => useBookTracker('book-1'));
    await act(async () => {});

    expect(result.current.formatLastRead()).toBe('4 days ago');
  });

  it('returns "N weeks ago" for dates between 7 and 30 days ago', async () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    mockGetItem.mockResolvedValue(storedDataFor('book-1', { lastReadDate: twoWeeksAgo }));

    const { result } = renderHook(() => useBookTracker('book-1'));
    await act(async () => {});

    expect(result.current.formatLastRead()).toBe('2 weeks ago');
  });

  it('returns a localeDateString for dates older than 30 days', async () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    mockGetItem.mockResolvedValue(storedDataFor('book-1', { lastReadDate: oldDate.toISOString() }));

    const { result } = renderHook(() => useBookTracker('book-1'));
    await act(async () => {});

    expect(result.current.formatLastRead()).toBe(oldDate.toLocaleDateString());
  });
});

// ─── formatTimeLeft ────────────────────────────────────────────────────────

describe('formatTimeLeft', () => {
  describe('fallback path (no estimatedReadingTime in library)', () => {
    it('formats hours and minutes', async () => {
      const { result } = renderHook(() => useBookTracker('book-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // updateProgress(50) → estimatedTimeLeft = Math.round(50 * 2.5) = 125 min = 2h 5m
      await act(async () => {
        result.current.updateProgress(50);
      });
      expect(result.current.formatTimeLeft()).toBe('2h 5m left');
    });

    it('formats hours only when minutes are zero', async () => {
      const { result } = renderHook(() => useBookTracker('book-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // updateProgress(76) → estimatedTimeLeft = Math.round(24 * 2.5) = 60 min = 1h
      await act(async () => {
        result.current.updateProgress(76);
      });
      expect(result.current.formatTimeLeft()).toBe('1h left');
    });

    it('formats minutes only when under an hour remains', async () => {
      const { result } = renderHook(() => useBookTracker('book-1'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // updateProgress(82) → estimatedTimeLeft = Math.round(18 * 2.5) = 45 min
      await act(async () => {
        result.current.updateProgress(82);
      });
      expect(result.current.formatTimeLeft()).toBe('45m left');
    });
  });

  describe('primary path (estimatedReadingTime from library)', () => {
    it('calculates remaining time from book estimatedReadingTime', async () => {
      // Book has 4h 30m total = 270 min; at 50% progress → 135 min remaining = 2h 15m
      mockGetBooks.mockReturnValue([{
        id: 'book-lib',
        estimatedReadingTime: '4h 30m',
      }]);

      const { result } = renderHook(() => useBookTracker('book-lib'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        result.current.updateProgress(50);
      });

      expect(result.current.formatTimeLeft()).toBe('2h 15m left');
    });

    it('handles minute-only estimatedReadingTime string', async () => {
      // Book has 40m total; at 50% → 20 min remaining
      mockGetBooks.mockReturnValue([{
        id: 'book-lib',
        estimatedReadingTime: '40m',
      }]);

      const { result } = renderHook(() => useBookTracker('book-lib'));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        result.current.updateProgress(50);
      });

      expect(result.current.formatTimeLeft()).toBe('20m left');
    });
  });
});
