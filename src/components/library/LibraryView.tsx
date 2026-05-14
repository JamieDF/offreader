import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Book } from "@/types/book";
import { Label } from "@/types/book";
import { useLibrary } from "@/hooks/useLibrary";
import { labelService } from "@/services/labelService";
import { shelfService } from "@/services/shelfService";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { saveStoredBooks } from "@/services/bookPersistence";
import { BookCard } from "./BookCard";
import { LibraryHeader } from "./LibraryHeader";
import { FilterToolbar } from "./FilterToolbar";
import { EmptyState } from "./EmptyState";
import { FloatingActionButton } from "./FloatingActionButton";
import { ResumeHero } from "./ResumeHero";
import { ThemeSettingsDialog } from "./ThemeSettingsDialog";
import { ReadingInsights } from "./ReadingInsights";
import { ManageLibraryDialog } from "./ManageLibraryDialog";
import { ImportBookDialog } from "./ImportBookDialog";
import { toast } from "@/components/ui/toast";

interface LibraryViewProps {
  onBookSelect: (book: Book) => void;
}

export function LibraryView({ onBookSelect }: LibraryViewProps) {
  const navigate = useNavigate();
  const {
    books,
    lastReadBook,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    importBooks,
    isEmpty,
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
  } = useLibrary();

  const [labels, setLabels] = useState<Label[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isManageLibraryOpen, setIsManageLibraryOpen] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedBooks, setImportedBooks] = useState<Book[]>([]);

  useEffect(() => {
    const loadLabels = () => {
      setLabels(labelService.getLabels());
    };

    loadLabels();
    const unsubscribe = labelService.subscribe(loadLabels);
    return unsubscribe;
  }, []);

  const handleApplyImportLabels = async (shelfId: string | null, labelIds: string[]) => {
    if (importedBooks.length === 0) {
      setShowImportDialog(false);
      return;
    }

    const books = libraryService.getBooks();
    const updatedBooks = books.map(book => {
      const isImported = importedBooks.some(b => b.id === book.id);
      if (isImported) {
        return { ...book, shelfId, labelIds };
      }
      return book;
    });

    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
    await shelfService.setLastUsedShelf(shelfId);

    setShowImportDialog(false);
    setImportedBooks([]);
    toast.success(`Applied to ${importedBooks.length} book${importedBooks.length > 1 ? 's' : ''}`);
  };
    const handleResume = async (book: Book) => {
    try {
      const trackerDataString = await storageService.getItem('book-tracker-data');
      
      if (trackerDataString) {
        const allTrackerData = JSON.parse(trackerDataString);
        const bookTrackerData = allTrackerData[book.id];
        const currentLocation = bookTrackerData?.currentLocation;
        
        // Navigate with book ID and location if available
        const baseUrl = `/reader?bookId=${encodeURIComponent(book.id)}`;
        const resumeUrl = currentLocation 
          ? `${baseUrl}&location=${encodeURIComponent(currentLocation)}`
          : baseUrl;
        
        navigate(resumeUrl);
      } else {
        // No saved location, navigate without location
        navigate(`/reader?bookId=${encodeURIComponent(book.id)}`);
      }
    } catch (error) {
      console.error('Failed to get tracker data:', error);
      navigate(`/reader?bookId=${encodeURIComponent(book.id)}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <LibraryHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInsights={() => setIsInsightsOpen(true)}
        onOpenManageLibrary={() => setIsManageLibraryOpen(true)}
        onAbout={() => navigate('/about')}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      <FilterToolbar
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        bookCount={books.length}
      />

      {/* Scrollable Content Area - only this section scrolls */}
      <main className="flex-1 overflow-y-auto overscroll-contain bg-background">
        <div className="max-w-7xl mx-auto w-full">
          {isEmpty ? (
            <EmptyState onBrowse={() => importBooks((books) => { setImportedBooks(books); setShowImportDialog(true); })} />
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 gap-4">
              <p>No books match your filters</p>
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="p-4 sm:p-6 pb-24 animate-fade-in space-y-8">
              {lastReadBook && searchQuery === "" && (
                <div className="w-full">
                  <ResumeHero book={lastReadBook} onContinue={handleResume} />
                </div>
              )}
              
              <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight px-1">Your Collection</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                  {books.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onSelect={onBookSelect}
                      labels={labels}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <FloatingActionButton onClick={() => importBooks((books) => { setImportedBooks(books); setShowImportDialog(true); })} />
      
      <ThemeSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <ReadingInsights
        isOpen={isInsightsOpen}
        onOpenChange={setIsInsightsOpen}
      />

      <ManageLibraryDialog
        isOpen={isManageLibraryOpen}
        onOpenChange={setIsManageLibraryOpen}
      />

      <ImportBookDialog
        isOpen={showImportDialog}
        bookCount={importedBooks.length}
        bookTitle={importedBooks.length === 1 ? importedBooks[0].title : undefined}
        onConfirm={handleApplyImportLabels}
        onCancel={() => {
          setShowImportDialog(false);
          setImportedBooks([]);
        }}
      />
    </div>
  );
}
