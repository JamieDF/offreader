import { Book } from "@/types/book";
import { fileStorage } from "./fileStorage";
import { storageService } from "./storage";
import { saveStoredBooks } from "./bookPersistence";

class LibraryService {
  private static instance: LibraryService;
  private books: Book[] = [];
  private isLoading: boolean = true;
  private error: string | null = null;
  private listeners: Set<() => void> = new Set();
  
  // Singleton pattern for global state
  static getInstance(): LibraryService {
    if (!LibraryService.instance) {
      LibraryService.instance = new LibraryService();
    }
    return LibraryService.instance;
  }
  
  // Load books once on app start
  async initialize(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      this.notifyListeners();

      // Load from Capacitor storage
      await fileStorage.listStoredFiles();

      const storedBooksData = await storageService.getItem('offreader-books');
      const storedBooks: Book[] = storedBooksData ? JSON.parse(storedBooksData) : [];

      // Rehydrate file URLs and verify files exist
      const validBooks = await Promise.all(
        storedBooks.map(async (book) => {
          try {
            // Check if file actually exists
            const exists = await fileStorage.fileExists(book.id);
            if (!exists) {
              console.warn(`File missing for book ${book.id} (${book.title}), skipping`);
              return null;
            }

            // Keep book content out of the native bridge until the user opens it.
            // The reader retrieves the file on demand, so creating startup blob
            // URLs would read every stored book into memory unnecessarily.
            return { ...book, filePath: '' };
          } catch (error) {
            console.error(`Failed to retrieve file for book ${book.id}:`, error);
            return null;
          }
        })
      );

      const loadedBooks = validBooks.filter((book): book is Book => book !== null);

      // Migrate any books stored under the old .epub extension to their correct format extension
      await fileStorage.migrateExtensions(loadedBooks.map(b => ({ id: b.id, format: b.format })));

      // Clean up orphaned files (files with no metadata)
      const validBookIds = loadedBooks.map(b => b.id);
      await fileStorage.cleanupOrphanFiles(validBookIds);

      this.books = loadedBooks;
      
      // Migrate any books that don't have shelfId/labelIds
      const migratedBooks = this.migrateBooks(loadedBooks);
      
      this.isLoading = false;
      this.notifyListeners();
    } catch (error) {
      console.error('LibraryService initialization failed:', error);
      this.error = 'Failed to load library';
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  private migrateBooks(books: Book[]): Book[] {
    let hasMigration = false;
    const migrated = books.map(book => {
      if (book.shelfId === undefined || book.labelIds === undefined) {
        hasMigration = true;
        return {
          ...book,
          shelfId: null,
          labelIds: [],
        };
      }
      return book;
    });

    if (hasMigration) {
      // Save migrated books
      this.updateBooksSilent(migrated);
      saveStoredBooks(migrated).catch(err => {
        console.error('Failed to save migrated books:', err);
      });
    }

    return migrated;
  }
  
  // Update books (for imports)
  updateBooks(newBooks: Book[]): void {
    this.books = newBooks;
    this.notifyListeners();
  }
  
  // Update books silently (for progress updates - no notification)
  updateBooksSilent(newBooks: Book[]): void {
    this.books = newBooks;
    // Don't notify listeners to prevent loops
  }
  
  // Getters
  getBooks(): Book[] { return this.books; }
  getIsLoading(): boolean { return this.isLoading; }
  getError(): string | null { return this.error; }
  
  // Subscribe to changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const libraryService = LibraryService.getInstance();
