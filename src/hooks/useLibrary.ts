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
import { getStoredTrackerData, saveStoredBooks, StoredBookData } from "@/services/bookPersistence";

export type SortOption = "recent" | "title" | "author" | "progress";

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [trackerData, setTrackerData] = useState<StoredBookData>({});

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
    // First filter
    let result = books.filter(
      (book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
  }, [books, searchQuery, sortBy, trackerData]);

  const importBooks = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".epub,.mobi,.pdf";
    input.multiple = true;

    input.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files) return;

      for (const file of files) {
        try {
          const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

          // Generate unique ID for the book
          const bookId = uuidv4();

          // Extract metadata from book
          const extractedMeta = await extractBookMetadata(file);
          const { title, author, publisher, pubDate, language, identifier, description, subjects, rights, chapters, totalChapters, format, coverImage } = extractedMeta as { title: string; author: string; publisher?: string; pubDate?: string; language?: string; identifier?: string; description?: string; subjects?: string[]; rights?: string; chapters: { label: string; href: string; index: number }[]; totalChapters: number; format: string; coverImage?: string };

          // Each format computes its own reading time from actual text content
          const pdfMeta = format === 'PDF' ? (extractedMeta as PdfMetadata) : null;
          const epubMeta = format === 'EPUB' ? (extractedMeta as EpubMetadata) : null;
          const mobiMeta = format === 'MOBI' ? (extractedMeta as MobiMetadata) : null;
          const { readingTime: calcReadingTime, pageCount: calcPageCount } = calculateReadingMetrics(file.size);
          const readingTime = pdfMeta?.readingTime ?? epubMeta?.readingTime ?? mobiMeta?.readingTime ?? calcReadingTime;
          const pageCount = pdfMeta?.pageCount ?? epubMeta?.pageCount ?? mobiMeta?.pageCount ?? calcPageCount;

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
          };

          // Save metadata with temporary filePath
          const updatedBooksWithTemp = [...books, newBook];
          libraryService.updateBooks(updatedBooksWithTemp);

          try {
            await saveStoredBooks(updatedBooksWithTemp);
          } catch (metadataError) {
            console.error(`❌ Failed to save metadata:`, metadataError);
            // Revert library state since metadata save failed
            libraryService.updateBooks(books);
            throw new Error(`Failed to save book metadata: ${metadataError}`);
          }

          // FIX #2: Now store the actual file
          let fileUrl: string;

          try {
            fileUrl = await fileStorage.storeFile(file, bookId);
          } catch (fileError) {
            console.error(`Failed to store file:`, fileError);

            // FIX #2: Clean up metadata entry on file storage failure
            // Remove the book we just added to metadata
            const cleanedBooks = books.filter(b => b.id !== bookId);
            libraryService.updateBooks(cleanedBooks);
            await saveStoredBooks(cleanedBooks);

            throw new Error(`Failed to store book file: ${fileError}`);
          }

          // FIX #2: Update book with actual file path and save metadata again
          const finalBook: Book = {
            ...newBook,
            filePath: fileUrl
          };

          const finalBooks = [...books, finalBook];
          libraryService.updateBooks(finalBooks);
          await saveStoredBooks(finalBooks);

          toast.success(`Successfully imported "${title}"`);

         } catch (error) {
           console.error(`❌ Failed to import ${file.name}:`, error);

           // Provide helpful, specific error messages
           const errorMessage = error instanceof Error ? error.message : String(error);
           let userMessage = `Failed to import "${file.name}"`;

           // Check for specific error types and provide guidance
           if (errorMessage.includes('Insufficient storage') || errorMessage.includes('storage') || errorMessage.toLowerCase().includes('quota')) {
             const requiredMB = /(\d+)MB/.exec(errorMessage)?.[1];
             userMessage = `⚠️ Storage full: Need ${requiredMB || 'more'}MB available. Delete some books to free up space.`;
           } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
             userMessage = `❌ Connection failed. Check your internet and try again.`;
           } else if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
             userMessage = `❌ File may be corrupted. Try a different book.`;
           } else if (errorMessage.includes('unsupported') || errorMessage.includes('format')) {
             userMessage = `❌ File format not supported. Only EPUB, MOBI, and PDF files are supported.`;
           } else if (errorMessage.includes('metadata')) {
             userMessage = `❌ Could not read book information. The file might be corrupted.`;
           }

           toast.error(userMessage);
         }
      }
    };

    // Trigger file picker
    input.click();
  }, [books]);

  const addBook = useCallback(async (bookData: Omit<Book, 'id'>) => {
    const newBook: Book = {
      ...bookData,
      id: uuidv4(),
      progress: 0,
    };
    const updatedBooks = [...books, newBook];
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
    return newBook;
  }, [books]);

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
    isEmpty: books.length === 0,
    isLoading: false, // Always false after app initialization
  };
}
