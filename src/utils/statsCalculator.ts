import { ReadingSession, DailyStats } from "@/hooks/useReadingStats";

// Map intensity levels 0-4
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  level: ActivityLevel;
  durationMs: number;
  booksRead: number;
}

export interface HeatmapData {
  days: HeatmapDay[];
  maxDurationMs: number;
}

// Thresholds in milliseconds
const THRESHOLDS = {
  LEVEL_1: 1 * 60 * 1000,       // > 0 minutes
  LEVEL_2: 15 * 60 * 1000,      // > 15 minutes
  LEVEL_3: 30 * 60 * 1000,      // > 30 minutes
  LEVEL_4: 60 * 60 * 1000,      // > 60 minutes
};

export const getIntensityLevel = (durationMs: number): ActivityLevel => {
  if (durationMs >= THRESHOLDS.LEVEL_4) return 4;
  if (durationMs >= THRESHOLDS.LEVEL_3) return 3;
  if (durationMs >= THRESHOLDS.LEVEL_2) return 2;
  if (durationMs >= THRESHOLDS.LEVEL_1) return 1;
  return 0;
};

export const generateHeatmapData = (
  dailyStats: Record<string, DailyStats>, 
  daysToGenerate = 365
): HeatmapData => {
  const days: HeatmapDay[] = [];
  let maxDurationMs = 0;

  // Generate array of past N days
  for (let i = daysToGenerate - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const stats = dailyStats[dateStr];
    const durationMs = stats ? stats.totalDurationMs : 0;
    
    if (durationMs > maxDurationMs) {
      maxDurationMs = durationMs;
    }

    days.push({
      date: dateStr,
      level: getIntensityLevel(durationMs),
      durationMs,
      booksRead: stats ? stats.booksRead.length : 0,
    });
  }

  return { days, maxDurationMs };
};

export const formatDuration = (ms: number): string => {
  if (ms === 0) return "0m";
  
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

// Calculate WPM (Words Per Minute) 
// Note: This is an estimation based on standard reading metrics (275 words per page, 6 bytes per word)
export const calculateEstimatedWPM = (
  session: ReadingSession, 
  bookFileSizeStr?: string
): number | null => {
  if (!bookFileSizeStr || session.durationMs < 60000 || session.endProgress <= session.startProgress) {
    return null;
  }

  try {
    // Parse file size (e.g. "1.5 MB" -> bytes)
    const match = bookFileSizeStr.match(/([\d.]+)\s*(MB|KB|B)/i);
    if (!match) return null;
    
    const size = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    let bytes = size;
    if (unit === 'MB') bytes = size * 1024 * 1024;
    else if (unit === 'KB') bytes = size * 1024;

    // Estimate total words in book (roughly 6 bytes per word in EPUB text)
    const estimatedTotalWords = Math.floor(bytes / 6);
    
    // Calculate words read in this session
    const progressDelta = (session.endProgress - session.startProgress) / 100;
    const wordsRead = Math.floor(estimatedTotalWords * progressDelta);
    
    // Calculate WPM
    const durationMinutes = session.durationMs / (1000 * 60);
    const wpm = Math.round(wordsRead / durationMinutes);
    
    // Sanity check bounds (average human reads 200-300 wpm)
    if (wpm < 50 || wpm > 1000) return null;
    
    return wpm;
  } catch (e) {
    return null;
  }
};
