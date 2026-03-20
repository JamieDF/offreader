import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadingStats } from '@/hooks/useReadingStats';
import type { ReadingSession } from '@/hooks/useReadingStats';
import { storageService } from '@/services/storage';

vi.mock('@/services/storage', () => ({
  storageService: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockGetItem = storageService.getItem as ReturnType<typeof vi.fn>;
const mockSetItem = storageService.setItem as ReturnType<typeof vi.fn>;

function makeSession(overrides: Partial<ReadingSession> = {}): ReadingSession {
  const today = new Date().toISOString();
  return {
    id: 'session-1',
    bookId: 'book-1',
    startTime: today,
    endTime: today,
    durationMs: 10 * 60 * 1000, // 10 minutes
    startProgress: 0,
    endProgress: 10,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe('useReadingStats', () => {
  it('initialises with default empty stats', async () => {
    const { result } = renderHook(() => useReadingStats());

    await act(async () => {
      // wait for initial load
    });

    expect(result.current.stats.sessions).toHaveLength(0);
    expect(result.current.stats.totalReadingTimeMs).toBe(0);
    expect(result.current.stats.currentStreak).toBe(0);
    expect(result.current.isLoaded).toBe(true);
  });

  it('writes session to storage via setItem', async () => {
    const { result } = renderHook(() => useReadingStats());

    await act(async () => {
      await result.current.addSession(makeSession());
    });

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    const [key, json] = mockSetItem.mock.calls[0];
    expect(key).toBe('offreader-reading-stats');
    const saved = JSON.parse(json);
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0].id).toBe('session-1');
  });

  it('accumulates totalReadingTimeMs correctly across two sessions', async () => {
    const { result } = renderHook(() => useReadingStats());

    const session1 = makeSession({ id: 's1', durationMs: 5 * 60 * 1000 });
    const session2 = makeSession({ id: 's2', durationMs: 10 * 60 * 1000 });

    await act(async () => {
      await result.current.addSession(session1);
    });

    // Feed session1's stored state back so session2 accumulates on top of it
    const storedAfterSession1 = mockSetItem.mock.calls[0][1];
    mockGetItem.mockResolvedValueOnce(storedAfterSession1);

    await act(async () => {
      await result.current.addSession(session2);
    });

    expect(result.current.stats.totalReadingTimeMs).toBe(15 * 60 * 1000);
  });

  it('skips duplicate sessions (same id)', async () => {
    const session = makeSession({ id: 'dup-1' });

    const { result } = renderHook(() => useReadingStats());

    await act(async () => {
      await result.current.addSession(session);
    });

    // Feed stored state back so the second enqueue sees the session already exists
    const storedJson = mockSetItem.mock.calls[0][1];
    mockGetItem.mockResolvedValueOnce(storedJson);

    await act(async () => {
      await result.current.addSession(session); // duplicate
    });

    // setItem should only have been called once (duplicate skipped)
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it('accumulates daily stats for two sessions on the same day', async () => {
    const todayIso = new Date().toISOString();
    const session1 = makeSession({ id: 's1', startTime: todayIso, endTime: todayIso, durationMs: 5 * 60 * 1000 });
    const session2 = makeSession({ id: 's2', startTime: todayIso, endTime: todayIso, durationMs: 7 * 60 * 1000 });

    const { result } = renderHook(() => useReadingStats());

    await act(async () => {
      await result.current.addSession(session1);
    });

    // Feed stored state back for second write
    const afterFirst = mockSetItem.mock.calls[0][1];
    mockGetItem.mockResolvedValueOnce(afterFirst);

    await act(async () => {
      await result.current.addSession(session2);
    });

    const today = todayIso.split('T')[0];
    const daily = result.current.stats.dailyStats[today];
    expect(daily).toBeDefined();
    expect(daily.sessions).toBe(2);
    expect(daily.totalDurationMs).toBe(12 * 60 * 1000);
  });

  it('sets currentStreak to 1 after a session today', async () => {
    const { result } = renderHook(() => useReadingStats());

    await act(async () => {
      await result.current.addSession(makeSession());
    });

    expect(result.current.stats.currentStreak).toBe(1);
  });

  describe('streak calculation edge cases', () => {
    function dateStr(daysAgo: number): string {
      return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
    }

    function storedStateWithDays(daysAgo: number[], longestStreak?: number): string {
      const dailyStats: Record<string, object> = {};
      for (const d of daysAgo) {
        const date = dateStr(d);
        dailyStats[date] = { date, totalDurationMs: 30 * 60 * 1000, sessions: 1, booksRead: ['book-1'] };
      }
      return JSON.stringify({
        sessions: [],
        dailyStats,
        totalReadingTimeMs: 0,
        currentStreak: daysAgo.length,
        longestStreak: longestStreak ?? daysAgo.length,
        lastReadDate: null,
      });
    }

    /** Returns mocks that behave like real storage: setItem updates what getItem returns. */
    function useRealStorageMock(initialValue: string | null = null) {
      let stored = initialValue;
      mockGetItem.mockImplementation(() => Promise.resolve(stored));
      mockSetItem.mockImplementation((_key: string, value: string) => {
        stored = value;
        return Promise.resolve();
      });
    }

    it('extends an existing consecutive streak when adding a session today', async () => {
      useRealStorageMock(storedStateWithDays([1, 2]));

      const { result } = renderHook(() => useReadingStats());
      await act(async () => {
        await result.current.addSession(makeSession({ id: 'today-1' }));
      });

      expect(result.current.stats.currentStreak).toBe(3);
    });

    it('resets streak to 1 when there is a gap (no session yesterday)', async () => {
      useRealStorageMock(storedStateWithDays([2]));

      const { result } = renderHook(() => useReadingStats());
      await act(async () => {
        await result.current.addSession(makeSession({ id: 'today-2' }));
      });

      expect(result.current.stats.currentStreak).toBe(1);
    });

    it('updates longestStreak when current streak exceeds it', async () => {
      // 4 consecutive prior days, longestStreak artificially set to 3
      useRealStorageMock(storedStateWithDays([1, 2, 3, 4], 3));

      const { result } = renderHook(() => useReadingStats());
      await act(async () => {
        await result.current.addSession(makeSession({ id: 'today-3' }));
      });

      expect(result.current.stats.currentStreak).toBe(5);
      expect(result.current.stats.longestStreak).toBe(5);
    });

    it('does not increment streak for a second session on the same day', async () => {
      useRealStorageMock(null);

      const { result } = renderHook(() => useReadingStats());

      await act(async () => {
        await result.current.addSession(makeSession({ id: 'a1' }));
      });
      await act(async () => {
        await result.current.addSession(makeSession({ id: 'a2' }));
      });

      expect(result.current.stats.currentStreak).toBe(1);
    });
  });
});
