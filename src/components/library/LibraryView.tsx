import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Book } from "@/types/book";
import { useLibrary } from "@/hooks/useLibrary";
import { storageService } from "@/services/storage";
import { BookCard } from "./BookCard";
import { LibraryHeader } from "./LibraryHeader";
import { EmptyState } from "./EmptyState";
import { FloatingActionButton } from "./FloatingActionButton";
import { ResumeHero } from "./ResumeHero";
import { ThemeSettingsDialog } from "./ThemeSettingsDialog";
import { ReadingInsights } from "./ReadingInsights";

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
  } = useLibrary();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const handleResume = async (book: Book) => {
    // Get the current location from storage (useBookTracker uses book-tracker-data key)
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
        isDarkMode={document.documentElement.classList.contains("dark")}
        onToggleDarkMode={() => setIsSettingsOpen(true)}
        onOpenInsights={() => setIsInsightsOpen(true)}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Scrollable Content Area - only this section scrolls */}
      <main className="flex-1 overflow-y-auto overscroll-contain bg-background">
        <div className="max-w-7xl mx-auto w-full">
          {isEmpty ? (
            <EmptyState onBrowse={importBooks} />
          ) : books.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground p-12">
              No books match your search
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
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <FloatingActionButton onClick={importBooks} />
      
      <ThemeSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <ReadingInsights
        isOpen={isInsightsOpen}
        onOpenChange={setIsInsightsOpen}
      />
    </div>
  );
}
