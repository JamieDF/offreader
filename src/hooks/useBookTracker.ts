import { useState, useCallback, useEffect } from "react";
import { storageService } from "@/services/storage";
import { libraryService } from "@/services/LibraryService";

export interface Bookmark {
  id: string;
  location: string; // CFI or href
  chapterTitle: string;
  position: number; // 0-100 progress within book
  createdAt: string; // ISO timestamp
  note?: string; // Optional user note
}

export interface BookStats {
  progress: number; // 0-100
  lastReadDate: Date | null;
  totalChapters?: number;
  currentChapter?: number;
  currentPage?: number; // Page within current chapter (1-based)
  totalPagesInChapter?: number; // Total pages in current chapter
  estimatedTimeLeft?: number; // in minutes
  fileSize?: string;
  format?: string;
  isFinished: boolean;
  currentLocation?: string; // CFI or href for resume position
  bookmarks: Bookmark[];
}

// Mock storage for book tracking data
const STORAGE_KEY = "book-tracker-data";

interface StoredBookData {
  [bookId: string]: {
    progress: number;
    lastReadDate: string | null;
    currentChapter?: number;
    currentPage?: number;
    totalPagesInChapter?: number;
    isFinished: boolean;
    currentLocation?: string; // CFI or href for resume position
    bookmarks: Bookmark[];
    totalChapters?: number;
    fileSize?: string;
    format?: string;
  };
}

async function getStoredData(): Promise<StoredBookData> {
  try {
    const data = await storageService.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function saveStoredData(data: StoredBookData) {
  await storageService.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useBookTracker(bookId: string, initialProgress?: number) {
  const [stats, setStats] = useState<BookStats>(() => {
    const progress = initialProgress ?? 0;
    return {
      progress,
      lastReadDate: null,
      totalChapters: 0,
      currentChapter: 0,
      estimatedTimeLeft: 0,
      fileSize: "Unknown",
      format: "EPUB",
      isFinished: progress >= 100,
      currentLocation: undefined,
      bookmarks: [],
    };
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // Load stored data and book info on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        // Load stored tracking data
        const stored = await getStoredData();
        const bookTrackingData = stored[bookId];
        
        // Load book data from library service
        const libraryBooks = libraryService.getBooks();
        const currentBook = libraryBooks.find(book => book.id === bookId);
        
        if (bookTrackingData) {
          const progress = bookTrackingData.progress ?? initialProgress ?? 0;
          setStats({
            progress,
            lastReadDate: bookTrackingData.lastReadDate ? new Date(bookTrackingData.lastReadDate) : null,
            totalChapters: currentBook?.totalChapters || 0,
            currentChapter: bookTrackingData.currentChapter || 0,
            currentPage: bookTrackingData.currentPage,
            totalPagesInChapter: bookTrackingData.totalPagesInChapter,
            estimatedTimeLeft: progress > 0 ? Math.round((100 - progress) * 2.5) : 0,
            fileSize: currentBook?.fileSize || "Unknown",
            format: currentBook?.description?.includes('MOBI') ? 'MOBI' : 'EPUB',
            isFinished: bookTrackingData.isFinished ?? progress >= 100,
            currentLocation: bookTrackingData.currentLocation,
            bookmarks: bookTrackingData.bookmarks || [],
          });
        } else {
          // No stored data, use initial values with book info if available
          setStats({
            progress: initialProgress || 0,
            lastReadDate: null,
            totalChapters: currentBook?.totalChapters || 0,
            currentChapter: 0,
            estimatedTimeLeft: 0,
            fileSize: currentBook?.fileSize || "Unknown",
            format: currentBook?.description?.includes('MOBI') ? 'MOBI' : 'EPUB',
            isFinished: (initialProgress || 0) >= 100,
            currentLocation: undefined,
            bookmarks: [],
          });
        }
      } catch (error) {
        console.error('Failed to load stored data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadStoredData();
  }, [bookId, initialProgress]);

  // Update stored data when stats change
  useEffect(() => {
    const saveData = async () => {
      try {
        const storedData = await getStoredData();
        storedData[bookId] = {
          progress: stats.progress,
          lastReadDate: stats.lastReadDate?.toISOString() ?? null,
          currentChapter: stats.currentChapter,
          currentPage: stats.currentPage,
          totalPagesInChapter: stats.totalPagesInChapter,
          isFinished: stats.isFinished,
          currentLocation: stats.currentLocation,
          bookmarks: stats.bookmarks,
        };
        await saveStoredData(storedData);
        window.dispatchEvent(new Event("book-updated"));
      } catch (error) {
        console.error('Failed to save data:', error);
      }
    };

    saveData();
  }, [bookId, stats]);

  const updateProgress = useCallback((progress: number, chapter?: number, page?: number, totalPages?: number) => {
    setStats((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      currentChapter: chapter ?? prev.currentChapter,
      currentPage: page ?? prev.currentPage,
      totalPagesInChapter: totalPages ?? prev.totalPagesInChapter,
      lastReadDate: new Date(),
      estimatedTimeLeft: Math.round((100 - progress) * 2.5),
      isFinished: progress >= 100,
    }));
  }, []);

  const updateLocation = useCallback((location: string) => {
    setStats((prev) => ({
      ...prev,
      currentLocation: location,
      lastReadDate: new Date(),
    }));
  }, []);

  const addBookmark = useCallback((location: string, chapterTitle: string, position: number, note?: string) => {
    const newBookmark: Bookmark = {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      location,
      chapterTitle,
      position,
      createdAt: new Date().toISOString(),
      note,
    };

    setStats((prev) => ({
      ...prev,
      bookmarks: [...prev.bookmarks, newBookmark].sort((a, b) => a.position - b.position),
    }));
  }, []);

  const removeBookmark = useCallback((bookmarkId: string) => {
    setStats((prev) => ({
      ...prev,
      bookmarks: prev.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
    }));
  }, []);

  const getBookmarks = useCallback(() => {
    return stats.bookmarks;
  }, [stats.bookmarks]);

  const markAsFinished = useCallback((finished: boolean) => {
    setStats((prev) => ({
      ...prev,
      isFinished: finished,
      progress: finished ? 100 : prev.progress,
    }));
  }, []);

  const getResumeLabel = useCallback(() => {
    if (stats.progress === 0) {
      return "Start Reading";
    }
    if (stats.isFinished) {
      return "Read Again";
    }
    return `Resume at Chapter ${(stats.currentChapter ?? 0) + 1}`;
  }, [stats.progress, stats.currentChapter, stats.isFinished]);

  const formatLastRead = useCallback(() => {
    if (!stats.lastReadDate) return "Never";
    
    const now = new Date();
    const diff = now.getTime() - stats.lastReadDate.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return stats.lastReadDate.toLocaleDateString();
  }, [stats.lastReadDate]);

  const formatTimeLeft = useCallback(() => {
    // Get the book to access estimatedReadingTime
    const libraryBooks = libraryService.getBooks();
    const currentBook = libraryBooks.find(book => book.id === bookId);
    
    if (currentBook?.estimatedReadingTime && stats.progress > 0 && stats.progress < 100) {
      // Parse the estimated reading time (e.g., "4h 30m" or "45m")
      const timeStr = currentBook.estimatedReadingTime;
      const hoursMatch = timeStr.match(/(\d+)h/);
      const minutesMatch = timeStr.match(/(\d+)m/);
      
      const totalMinutes = (hoursMatch ? parseInt(hoursMatch[1]) * 60 : 0) + (minutesMatch ? parseInt(minutesMatch[1]) : 0);
      const remainingMinutes = Math.round(totalMinutes * (100 - stats.progress) / 100);
      
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;
      
      if (hours === 0) return `${minutes}m left`;
      if (minutes === 0) return `${hours}h left`;
      return `${hours}h ${minutes}m left`;
    }
    
    // Fallback to old calculation
    const hours = Math.floor((stats.estimatedTimeLeft ?? 0) / 60);
    const minutes = (stats.estimatedTimeLeft ?? 0) % 60;
    
    if (hours === 0) return `${minutes}m left`;
    if (minutes === 0) return `${hours}h left`;
    return `${hours}h ${minutes}m left`;
  }, [stats.estimatedTimeLeft, stats.progress, bookId]);

  return {
    stats,
    isLoading,
    updateProgress,
    updateLocation,
    addBookmark,
    removeBookmark,
    getBookmarks,
    markAsFinished,
    getResumeLabel,
    formatLastRead,
    formatTimeLeft,
  };
}
