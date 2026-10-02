import { useState, useCallback, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { fileStorage } from "@/services/fileStorage";
import { getStoredTrackerData, saveStoredBooks, StoredBookData } from "@/services/bookPersistence";
import { importFileItems, toastImportError } from "@/services/bookImport";
import { relinkBookFile, moveBooksToLibrary } from "@/services/folderSync";

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
      await importFileItems([...files].map(file => ({ file })), 'managed', onImportComplete);
    };

    input.click();
  }, []);

  /**
   * Electron import: native picker → paths → bytes streamed over
   * offreader-file:// → same pipeline. `mode` decides whether bytes are
   * copied into the store ('managed') or read in place ('linked').
   */
  const importBookPaths = useCallback(async (
    paths: string[],
    mode: 'managed' | 'linked',
    onImportComplete?: ImportCallback,
  ) => {
    const files = window.offreaderFiles;
    if (!files || paths.length === 0) return;

    const items: { file: File; sourcePath: string }[] = [];
    for (const path of paths) {
      try {
        const stat = await files.statFile(path);
        const blob = await fileStorage.retrieveLinkedBlob(path);
        const name = stat?.name ?? path.split(/[\\/]/).pop() ?? 'book';
        items.push({ file: new File([blob], name), sourcePath: path });
      } catch (error) {
        console.error(`Failed to read ${path}:`, error);
        toastImportError(path.split(/[\\/]/).pop() ?? path, error);
      }
    }

    await importFileItems(items, mode, onImportComplete);
  }, []);

  const relinkBook = relinkBookFile;

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
  }, []); // Empty deps intentional: prevents re-render loops

  /** The storage key for a book's file bytes: content hash post-migration,
   *  book id for pre-migration records. Linked books store no bytes, so
   *  they neither produce nor protect a storage key. */
  const storageKey = (book: Book) =>
    book.source === 'linked' ? undefined : (book.contentHash ?? book.id);

  const removeBook = useCallback(async (bookId: string) => {
    try {
      const book = books.find(b => b.id === bookId);
      // Delete the file only if no other book shares its bytes
      const key = book ? storageKey(book) : bookId;
      if (key && !books.some(b => b.id !== bookId && storageKey(b) === key)) {
        await fileStorage.deleteFile(key);
      }

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

  // Bulk operations: each writes the library JSON once, not once per book.

  const assignBooksToShelf = useCallback(async (bookIds: string[], shelfId: string | null) => {
    const idSet = new Set(bookIds);
    const updatedBooks = libraryService.getBooks().map(book =>
      idSet.has(book.id) ? { ...book, shelfId } : book
    );
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []);

  // Applies explicit label changes to every selected book; labels the user
  // didn't touch keep their per-book state.
  const applyLabelChanges = useCallback(async (
    bookIds: string[],
    addLabelIds: Set<string>,
    removeLabelIds: Set<string>
  ) => {
    const idSet = new Set(bookIds);
    const updatedBooks = libraryService.getBooks().map(book => {
      if (!idSet.has(book.id)) return book;
      const labelIds = new Set(book.labelIds);
      addLabelIds.forEach(id => labelIds.add(id));
      removeLabelIds.forEach(id => labelIds.delete(id));
      return { ...book, labelIds: [...labelIds] };
    });
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []);

  const removeBooks = useCallback(async (bookIds: string[]) => {
    const idSet = new Set(bookIds);
    try {
      const allBooks = libraryService.getBooks();
      const updatedBooks = allBooks.filter(book => !idSet.has(book.id));
      // Only delete bytes no surviving managed book still references
      const survivingKeys = new Set(updatedBooks.map(storageKey));
      const keysToDelete = new Set(
        allBooks.filter(b => idSet.has(b.id)).map(storageKey)
      );
      await Promise.allSettled(
        [...keysToDelete]
          .filter((key): key is string => key !== undefined && !survivingKeys.has(key))
          .map(key => fileStorage.deleteFile(key))
      );

      libraryService.updateBooks(updatedBooks);
      await saveStoredBooks(updatedBooks);

      const storedData = await storageService.getItem('book-tracker-data');
      if (storedData) {
        const trackerData = JSON.parse(storedData);
        bookIds.forEach(id => delete trackerData[id]);
        await storageService.setItem('book-tracker-data', JSON.stringify(trackerData));
      }

      await Promise.allSettled(bookIds.map(id => storageService.removeItem(`offreader-book-${id}`)));
    } catch (error) {
      console.error('Failed to remove books:', error);
    }
  }, []);

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
    importBookPaths,
    relinkBook,
    moveBooksToLibrary,
    addBook,
    updateProgress,
    removeBook,
    removeBooks,
    assignBooksToShelf,
    applyLabelChanges,
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
