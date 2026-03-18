import { useState, useEffect, useCallback, useRef } from "react";
import { storageService } from "@/services/storage";

export interface ReadingSession {
  id: string;
  bookId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  durationMs: number;
  startLocation?: string; // CFI
  endLocation?: string; // CFI
  startProgress: number; // 0-100
  endProgress: number; // 0-100
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalDurationMs: number;
  sessions: number; // Count of sessions
  booksRead: string[]; // Array of unique bookIds
}

export interface ReadingStats {
  sessions: ReadingSession[];
  dailyStats: Record<string, DailyStats>;
  totalReadingTimeMs: number;
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string | null;
}

const STORAGE_KEY = "tome-reader-reading-stats";

const DEFAULT_STATS: ReadingStats = {
  sessions: [],
  dailyStats: {},
  totalReadingTimeMs: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastReadDate: null,
};

// Write queue to prevent race conditions from concurrent addSession() calls
// Ensures sessions are written serially to storage
class SessionWriteQueue {
  private queue: ReadingSession[] = [];
  private isProcessing = false;
  private onWrite?: (stats: ReadingStats) => void;

  setOnWrite(callback: (stats: ReadingStats) => void) {
    this.onWrite = callback;
  }

  async enqueue(session: ReadingSession): Promise<void> {
    this.queue.push(session);
    await this.process();
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    try {
      while (this.queue.length > 0) {
        const session = this.queue.shift();
        if (!session) break;
        await this.writeSession(session);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async writeSession(session: ReadingSession): Promise<void> {
    // Read latest state
    const stored = await storageService.getItem(STORAGE_KEY);
    const prevStats: ReadingStats = stored ? { ...DEFAULT_STATS, ...JSON.parse(stored) } : DEFAULT_STATS;

    // Skip if duplicate
    if (prevStats.sessions.some(s => s.id === session.id)) {
      return;
    }

    // Calculate new state
    const newSessions = [...prevStats.sessions, session];
    const dateStr = session.startTime.split('T')[0];
    const prevDaily = prevStats.dailyStats[dateStr] || {
      date: dateStr,
      totalDurationMs: 0,
      sessions: 0,
      booksRead: [],
    };

    const newBooksRead = new Set(prevDaily.booksRead);
    newBooksRead.add(session.bookId);

    const newDailyStats = {
      ...prevStats.dailyStats,
      [dateStr]: {
        date: dateStr,
        totalDurationMs: prevDaily.totalDurationMs + session.durationMs,
        sessions: prevDaily.sessions + 1,
        booksRead: Array.from(newBooksRead),
      }
    };

    const newTotalReadingTimeMs = prevStats.totalReadingTimeMs + session.durationMs;
    const newLastReadDate = session.endTime > (prevStats.lastReadDate || "") ? session.endTime : prevStats.lastReadDate;

    // Calculate streaks
    const today = new Date().toISOString().split('T')[0];
    let currentStreak = 0;
    const checkDate = new Date(today);

    if (!newDailyStats[today]) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (newDailyStats[checkDate.toISOString().split('T')[0]]) {
        while (newDailyStats[checkDate.toISOString().split('T')[0]]) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    } else {
      while (newDailyStats[checkDate.toISOString().split('T')[0]]) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    const longestStreak = Math.max(prevStats.longestStreak, currentStreak);

    const newStats = {
      ...prevStats,
      sessions: newSessions,
      dailyStats: newDailyStats,
      totalReadingTimeMs: newTotalReadingTimeMs,
      lastReadDate: newLastReadDate,
      currentStreak,
      longestStreak
    };

    // Save to storage
    await storageService.setItem(STORAGE_KEY, JSON.stringify(newStats));

    // Notify
    if (this.onWrite) {
      this.onWrite(newStats);
    }
    window.dispatchEvent(new Event("reading-stats-updated"));
  }
}

const sessionWriteQueue = new SessionWriteQueue();

export function useReadingStats() {
  const [stats, setStats] = useState<ReadingStats>(DEFAULT_STATS);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  const loadStats = useCallback(async () => {
    try {
      const stored = await storageService.getItem(STORAGE_KEY);
      if (stored && isMountedRef.current) {
        const parsed = JSON.parse(stored);
        setStats({ ...DEFAULT_STATS, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load reading stats:", error);
    } finally {
      if (isMountedRef.current) {
        setIsLoaded(true);
      }
    }
  }, []);

  // Initialize write queue callback on mount
  useEffect(() => {
    sessionWriteQueue.setOnWrite((newStats) => {
      if (isMountedRef.current) {
        setStats(newStats);
      }
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load stats on mount and listen for updates
  useEffect(() => {
    isMountedRef.current = true;
    loadStats();

    const handleUpdate = () => {
      loadStats();
    };

    window.addEventListener("reading-stats-updated", handleUpdate);
    return () => {
      window.removeEventListener("reading-stats-updated", handleUpdate);
      isMountedRef.current = false;
    };
  }, [loadStats]);

  // Use write queue to prevent race conditions
  const addSession = useCallback(async (session: ReadingSession) => {
    try {
      await sessionWriteQueue.enqueue(session);
    } catch (e) {
      console.error("Failed to add reading session:", e);
    }
  }, []);

  return {
    stats,
    isLoaded,
    addSession
  };
}
