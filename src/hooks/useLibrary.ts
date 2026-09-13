import { useState, useCallback, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/toast";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { fileStorage } from "@/services/fileStorage";
import { calculateReadingMetrics } from "@/utils/readingMetrics";
import { extractBookMetadata } from "@/parsers/bookMetadataParser";
import { PdfMetadata } from "@/parsers/pdfParser";
import { EpubMetadata } from "@/parsers/epubParser";
import { MobiMetadata } from "@/parsers/mobiParser";
import { Azw3Metadata } from "@/parsers/azw3Parser";
import { Fb2Metadata } from "@/parsers/fb2Parser";
import { CbzMetadata } from "@/parsers/cbzParser";
import { getStoredTrackerData, saveStoredBooks, StoredBookData } from "@/services/bookPersistence";

export type SortOption = "recent" | "title" | "author" | "progress";

export type ReadingStatus = 'all' | 'unread' | 'in_progress' | 'read';

export interface LibraryFilters {
  shelfId: string | null;
  labelIds: string[];
  status: ReadingStatus;
}

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [trackerData, setTrackerData] = useState<StoredBookData>({});
  const [filters, setFilters] = useState<LibraryFilters>({
    shelfId: null,
    labelIds: [],
    status: 'all',
  });

  // Load tracker data on mount
  useEffect(() => {
    const loadTrackerData = async () => {
      const data = await getStoredTrackerData();
      setTrackerData(data);
    };
    loadTrackerData();
  }, []);

  // Subscribe to library service changes
  useEffect(() => {
    const updateBooks = () => {
      const libraryBooks = libraryService.getBooks();
      setBooks(libraryBooks);
    };

    const unsubscribe = libraryService.subscribe(updateBooks);
    updateBooks(); // Initial load

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleUpdate = async () => {
      const data = await getStoredTrackerData();
      setTrackerData(data);
    };
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("book-updated", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("book-updated", handleUpdate);
    };
  }, []);

  const sortedAndFilteredBooks = useMemo(() => {
    // First filter by search query
    let result = books.filter(
      (book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Apply shelf filter
    if (filters.shelfId !== null) {
      result = result.filter(book => book.shelfId === filters.shelfId);
    }

    // Apply label filter
    if (filters.labelIds.length > 0) {
      result = result.filter(book =>
        filters.labelIds.every(labelId => book.labelIds.includes(labelId))
      );
    }

    // Apply status filter (derived from progress and isFinished)
    if (filters.status !== 'all') {
      result = result.filter(book => {
        const bookTracker = trackerData[book.id];
        const progress = bookTracker?.progress ?? book.progress ?? 0;
        const isFinished = bookTracker?.isFinished ?? progress >= 100;

        switch (filters.status) {
          case 'unread':
            return !isFinished && progress === 0;
          case 'in_progress':
            return !isFinished && progress > 0;
          case 'read':
            return isFinished;
          default:
            return true;
        }
      });
    }

    // Then sort
    switch (sortBy) {
      case "recent":
        result = [...result].sort((a, b) => {
          const aDate = trackerData[a.id]?.lastReadDate;
          const bDate = trackerData[b.id]?.lastReadDate;
          // Books with no read date go to the end
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate!).getTime() - new Date(aDate!).getTime();
        });
        break;
      case "title":
        result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        result = [...result].sort((a, b) => a.author.localeCompare(b.author));
        break;
      case "progress":
        result = [...result].sort((a, b) => b.progress - a.progress);
        break;
    }

    return result;
  }, [books, searchQuery, sortBy, trackerData, filters]);

  const setFilter = useCallback(<K extends keyof LibraryFilters>(
    key: K,
    value: LibraryFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ shelfId: null, labelIds: [], status: 'all' });
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.shelfId !== null) count++;
    if (filters.labelIds.length > 0) count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

type ImportCallback = ((importedBooks: Book[]) => void) | undefined;

  const importBooks = useCallback(async (onImportComplete?: ImportCallback) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".epub,.mobi,.azw3,.fb2,.pdf,.cbz";
    input.multiple = true;

    input.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files) return;

      const newlyImportedBooks: Book[] = [];

      for (const file of files) {
        try {
          const fileName = file.name.replace(/\.[^/.]+$/, "");

          const bookId = uuidv4();

          const extractedMeta = await extractBookMetadata(file);
          const { title, author, publisher, pubDate, language, identifier, description, subjects, rights, chapters, totalChapters, format, coverImage } = extractedMeta as { title: string; author: string; publisher?: string; pubDate?: string; language?: string; identifier?: string; description?: string; subjects?: string[]; rights?: string; chapters: { label: string; href: string; index: number }[]; totalChapters: number; format: string; coverImage?: string };

          const pdfMeta = format === 'PDF' ? (extractedMeta as PdfMetadata) : null;
          const epubMeta = format === 'EPUB' ? (extractedMeta as EpubMetadata) : null;
          const mobiMeta = format === 'MOBI' ? (extractedMeta as MobiMetadata) : null;
          const azw3Meta = format === 'AZW3' ? (extractedMeta as Azw3Metadata) : null;
          const fb2Meta = format === 'FB2' ? (extractedMeta as Fb2Metadata) : null;
          const cbzMeta = format === 'CBZ' ? (extractedMeta as CbzMetadata) : null;
          const { readingTime: calcReadingTime, pageCount: calcPageCount } = calculateReadingMetrics(file.size);
          const readingTime = pdfMeta?.readingTime ?? epubMeta?.readingTime ?? mobiMeta?.readingTime
            ?? azw3Meta?.readingTime ?? fb2Meta?.readingTime ?? cbzMeta?.readingTime ?? calcReadingTime;
          const pageCount = pdfMeta?.pageCount ?? epubMeta?.pageCount ?? mobiMeta?.pageCount
            ?? azw3Meta?.pageCount ?? fb2Meta?.pageCount ?? cbzMeta?.pageCount ?? calcPageCount;

          const newBook: Book = {
            id: bookId,
            title: title || fileName,
            author: author,
            format: (format as Book['format']) ?? 'EPUB',
            publisher: publisher,
            pubDate: pubDate,
            language: language,
            identifier: identifier,
            description: description || `Imported ${format}: ${fileName}`,
            subjects: subjects,
            rights: rights,
            coverImage: coverImage || '',
            filePath: '',
            progress: 0,
            chapters: chapters,
            totalChapters: totalChapters,
            fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            estimatedReadingTime: readingTime,
            pageCount: pageCount,
            shelfId: null,
            labelIds: [],
          };

          const updatedBooksWithTemp = [...books, newBook];
          libraryService.updateBooks(updatedBooksWithTemp);

          try {
            await saveStoredBooks(updatedBooksWithTemp);
          } catch (metadataError) {
            console.error(`❌ Failed to save metadata:`, metadataError);
            libraryService.updateBooks(books);
            throw new Error(`Failed to save book metadata: ${metadataError}`);
          }

          let fileUrl: string;

          try {
            fileUrl = await fileStorage.storeFile(file, bookId);
          } catch (fileError) {
            console.error(`Failed to store file:`, fileError);

            const cleanedBooks = books.filter(b => b.id !== bookId);
            libraryService.updateBooks(cleanedBooks);
            await saveStoredBooks(cleanedBooks);

            throw new Error(`Failed to store book file: ${fileError}`);
          }

          const finalBook: Book = {
            ...newBook,
            filePath: fileUrl
          };

          const finalBooks = [...books, finalBook];
          libraryService.updateBooks(finalBooks);
          await saveStoredBooks(finalBooks);

          newlyImportedBooks.push(finalBook);

         } catch (error) {
            console.error(`❌ Failed to import ${file.name}:`, error);

            const errorMessage = error instanceof Error ? error.message : String(error);
            let userMessage = `Failed to import "${file.name}"`;

            if (errorMessage.includes('Insufficient storage') || errorMessage.includes('storage') || errorMessage.toLowerCase().includes('quota')) {
              const requiredMB = /(\d+)MB/.exec(errorMessage)?.[1];
              userMessage = `⚠️ Storage full: Need ${requiredMB || 'more'}MB available. Delete some books to free up space.`;
            } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
              userMessage = `❌ Connection failed. Check your internet and try again.`;
            } else if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
              userMessage = `❌ File may be corrupted. Try a different book.`;
            } else if (errorMessage.includes('unsupported') || errorMessage.includes('format')) {
              userMessage = `❌ File format not supported. Only EPUB, MOBI, AZW3, FB2, PDF, and CBZ files are supported.`;
            } else if (errorMessage.includes('metadata')) {
              userMessage = `❌ Could not read book information. The file might be corrupted.`;
            }

            toast.error(userMessage);
          }
      }

      // After all files processed, call the callback if provided
      if (newlyImportedBooks.length > 0) {
        toast.success(`Successfully imported ${newlyImportedBooks.length} book${newlyImportedBooks.length > 1 ? 's' : ''}`);
        onImportComplete?.(newlyImportedBooks);
      }
    };

    input.click();
  }, [books]);

  const addBook = useCallback(async (bookData: Omit<Book, 'id'>) => {
    const newBook: Book = {
      ...bookData,
      id: uuidv4(),
      progress: 0,
      shelfId: bookData.shelfId ?? null,
      labelIds: bookData.labelIds ?? [],
    };
    const updatedBooks = [...books, newBook];
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
    return newBook;
  }, [books]);

  const updateBookShelf = useCallback(async (bookId: string, shelfId: string | null) => {
    const currentBooks = libraryService.getBooks();
    const updatedBooks = currentBooks.map(book =>
      book.id === bookId ? { ...book, shelfId } : book
    );
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []);

  const updateBookLabels = useCallback(async (bookId: string, labelIds: string[]) => {
    const currentBooks = libraryService.getBooks();
    const updatedBooks = currentBooks.map(book =>
      book.id === bookId ? { ...book, labelIds } : book
    );
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []);

  const addLabelToBook = useCallback(async (bookId: string, labelId: string) => {
    const currentBooks = libraryService.getBooks();
    const updatedBooks = currentBooks.map(book => {
      if (book.id !== bookId) return book;
      if (book.labelIds.includes(labelId)) return book;
      return { ...book, labelIds: [...book.labelIds, labelId] };
    });
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []);

  const removeLabelFromBook = useCallback(async (bookId: string, labelId: string) => {
    const currentBooks = libraryService.getBooks();
    const updatedBooks = currentBooks.map(book => {
      if (book.id !== bookId) return book;
      return { ...book, labelIds: book.labelIds.filter(id => id !== labelId) };
    });
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []);

  const updateProgress = useCallback(async (bookId: string, progress: number) => {
    // Only update library service silently - don't notify listeners to prevent loops
    const currentBooks = libraryService.getBooks();
    const updatedBooks = currentBooks.map(book =>
      book.id === bookId
        ? { ...book, progress: Math.min(100, Math.max(0, progress)) }
        : book
    );

    // Update library service silently and save to storage
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []); // Empty deps intentional — prevents re-render loops

  const removeBook = useCallback(async (bookId: string) => {
    try {
      // Delete the file from storage
      await fileStorage.deleteFile(bookId);

      // Remove from library service
      const updatedBooks = books.filter((book) => book.id !== bookId);
      libraryService.updateBooks(updatedBooks);
      await saveStoredBooks(updatedBooks);

      // Clean up tracking data
      const storedData = await storageService.getItem('book-tracker-data');
      if (storedData) {
        const trackerData = JSON.parse(storedData);
        delete trackerData[bookId];
        await storageService.setItem('book-tracker-data', JSON.stringify(trackerData));
      }

      // Clean up any other stored data for this book
      await storageService.removeItem(`offreader-book-${bookId}`);
    } catch (error) {
      console.error('Failed to remove book:', error);
    }
  }, [books]);

  const lastReadBook = useMemo(() => {
    if (searchQuery !== "") return null;

    // Only show books that have actual reading progress (> 0%)
    const booksWithProgress = books.map(book => ({
      ...book,
      lastReadDate: trackerData[book.id]?.lastReadDate ? new Date(trackerData[book.id]!.lastReadDate!) : null,
      progress: trackerData[book.id]?.progress ?? 0
    })).filter(book => book.progress > 0 && book.lastReadDate !== null);

    if (booksWithProgress.length > 0) {
      return booksWithProgress.sort((a, b) =>
        (b.lastReadDate?.getTime() ?? 0) - (a.lastReadDate?.getTime() ?? 0)
      )[0];
    }

    // No books with actual progress - don't show continue reading
    return null;
  }, [books, searchQuery, trackerData]);

  return {
    books: sortedAndFilteredBooks,
    allBooks: books,
    lastReadBook,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    importBooks,
    addBook,
    updateProgress,
    removeBook,
    updateBookShelf,
    updateBookLabels,
    addLabelToBook,
    removeLabelFromBook,
    isEmpty: books.length === 0,
    isLoading: false, // Always false after app initialization
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
  };
}
