import { describe, it, expect } from 'vitest';
import {
  getIntensityLevel,
  formatDuration,
  generateHeatmapData,
  calculateEstimatedWPM,
} from '@/utils/statsCalculator';
import type { ReadingSession, DailyStats } from '@/hooks/useReadingStats';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe('getIntensityLevel', () => {
  it('returns 0 for zero duration', () => {
    expect(getIntensityLevel(0)).toBe(0);
  });

  it('returns 1 for > 0 and < 15 minutes', () => {
    expect(getIntensityLevel(1 * MIN)).toBe(1);
    expect(getIntensityLevel(14 * MIN + 59999)).toBe(1);
  });

  it('returns 2 for >= 15 minutes and < 30 minutes', () => {
    expect(getIntensityLevel(15 * MIN)).toBe(2);
    expect(getIntensityLevel(29 * MIN + 59999)).toBe(2);
  });

  it('returns 3 for >= 30 minutes and < 60 minutes', () => {
    expect(getIntensityLevel(30 * MIN)).toBe(3);
    expect(getIntensityLevel(59 * MIN + 59999)).toBe(3);
  });

  it('returns 4 for >= 60 minutes', () => {
    expect(getIntensityLevel(60 * MIN)).toBe(4);
    expect(getIntensityLevel(120 * MIN)).toBe(4);
  });
});

describe('formatDuration', () => {
  it('returns "0m" for zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats minutes only', () => {
    expect(formatDuration(30 * MIN)).toBe('30m');
    expect(formatDuration(1 * MIN)).toBe('1m');
  });

  it('formats hours only (no leftover minutes)', () => {
    expect(formatDuration(2 * HOUR)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(1 * HOUR + 30 * MIN)).toBe('1h 30m');
    expect(formatDuration(2 * HOUR + 5 * MIN)).toBe('2h 5m');
  });

  it('truncates partial minutes', () => {
    // 90,500 ms = 1 minute + 30.5 seconds → should show "1m"
    expect(formatDuration(MIN + 30500)).toBe('1m');
  });
});

describe('generateHeatmapData', () => {
  it('generates the correct number of days', () => {
    const { days } = generateHeatmapData({}, 7);
    expect(days).toHaveLength(7);
  });

  it('uses 365 days by default', () => {
    const { days } = generateHeatmapData({});
    expect(days).toHaveLength(365);
  });

  it('returns level 0 and duration 0 for dates with no stats', () => {
    const { days } = generateHeatmapData({}, 3);
    days.forEach(day => {
      expect(day.level).toBe(0);
      expect(day.durationMs).toBe(0);
    });
  });

  it('maps duration to correct intensity level from dailyStats', () => {
    const today = new Date().toISOString().split('T')[0];
    const dailyStats: Record<string, DailyStats> = {
      [today]: {
        date: today,
        totalDurationMs: 20 * MIN, // level 2
        sessions: 1,
        booksRead: ['book-1'],
      },
    };

    const { days } = generateHeatmapData(dailyStats, 1);
    expect(days[0].level).toBe(2);
    expect(days[0].durationMs).toBe(20 * MIN);
    expect(days[0].booksRead).toBe(1);
  });

  it('tracks maxDurationMs correctly', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const dailyStats: Record<string, DailyStats> = {
      [today]: { date: today, totalDurationMs: 30 * MIN, sessions: 1, booksRead: [] },
      [yesterday]: { date: yesterday, totalDurationMs: 90 * MIN, sessions: 2, booksRead: [] },
    };

    const { maxDurationMs } = generateHeatmapData(dailyStats, 2);
    expect(maxDurationMs).toBe(90 * MIN);
  });
});

describe('calculateEstimatedWPM', () => {
  const baseSession: ReadingSession = {
    id: 's1',
    bookId: 'b1',
    startTime: '2024-01-01T10:00:00Z',
    endTime: '2024-01-01T10:10:00Z',
    durationMs: 10 * MIN,
    startProgress: 0,
    endProgress: 10,
  };

  it('returns null when no file size provided', () => {
    expect(calculateEstimatedWPM(baseSession, undefined)).toBeNull();
  });

  it('returns null when duration < 60 seconds', () => {
    const shortSession = { ...baseSession, durationMs: 30000 };
    expect(calculateEstimatedWPM(shortSession, '1 MB')).toBeNull();
  });

  it('returns null when no progress made', () => {
    const noProgress = { ...baseSession, startProgress: 10, endProgress: 10 };
    expect(calculateEstimatedWPM(noProgress, '1 MB')).toBeNull();
  });

  it('parses MB file sizes correctly and returns valid WPM', () => {
    // 1 MB file, 10% progress in 10 minutes
    // estimatedTotalWords = 1MB/6 ≈ 174762, wordsRead ≈ 17476, WPM ≈ 1748 (too high → null)
    // Use a small book: 0.5 MB, 1% progress in 10 min → ~873 words in 10 min → 87 WPM
    const session = { ...baseSession, startProgress: 0, endProgress: 1, durationMs: 10 * MIN };
    const result = calculateEstimatedWPM(session, '0.5 MB');
    // 0.5MB = 524288 bytes / 6 = 87381 words * 0.01 = 874 words / 10 min = 87 WPM
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(50);
    expect(result).toBeLessThanOrEqual(1000);
  });

  it('parses KB file sizes correctly', () => {
    // 512 KB = 524288 bytes, 5% progress in 10 min
    // words = 524288/6 * 0.05 = 4369, WPM = 437
    const session = { ...baseSession, startProgress: 0, endProgress: 5, durationMs: 10 * MIN };
    const result = calculateEstimatedWPM(session, '512 KB');
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(50);
    expect(result).toBeLessThanOrEqual(1000);
  });

  it('returns null for unrealistically high WPM', () => {
    // 10 MB, 50% progress in 1 minute → enormous WPM
    const session = { ...baseSession, startProgress: 0, endProgress: 50, durationMs: 1 * MIN };
    expect(calculateEstimatedWPM(session, '10 MB')).toBeNull();
  });

  it('returns null for unrealistically low WPM', () => {
    // 1 KB file, 0.001% progress in 60 minutes → < 50 WPM
    const session = { ...baseSession, startProgress: 0, endProgress: 0.001, durationMs: 60 * MIN };
    expect(calculateEstimatedWPM(session, '1 KB')).toBeNull();
  });
});
