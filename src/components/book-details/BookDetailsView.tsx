import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookDetailsHeader } from "./BookDetailsHeader";
import { BookHero } from "./BookHero";
import { ReadingStatsCard } from "./ReadingStatsCard";
import { BookMetadata } from "./BookMetadata";
import { BookActions } from "./BookActions";
import { useBookTracker } from "@/hooks/useBookTracker";
import { toast } from "@/components/ui/toast";
import { titleCase } from "@/utils/titleCase";
import { Book } from "@/types/book";

interface BookDetailsViewProps {
  book: Book;
  onRemove: (bookId: string) => void;
}

export function BookDetailsView({ book, onRemove }: BookDetailsViewProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    stats,
    isLoading,
    getBookmarks,
    updateProgress,
    markAsFinished,
    getResumeLabel,
    formatLastRead,
    formatTimeLeft,
    removeBookmark
  } = useBookTracker(book.id);

  const handleBack = () => {
    navigate("/");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: titleCase(book.title),
        text: `Check out "${titleCase(book.title)}" by ${book.author}`,
      });
    } else {
      navigator.clipboard.writeText(`${titleCase(book.title)} by ${book.author}`);
      toast.success("Book info copied to clipboard");
    }
  };

  const handleReadNow = () => {
    // Navigate with book ID instead of file path for reliability
    const baseUrl = `/reader?bookId=${encodeURIComponent(book.id)}`;
    const resumeUrl = stats.currentLocation 
      ? `${baseUrl}&location=${encodeURIComponent(stats.currentLocation)}`
      : baseUrl;
    
    navigate(resumeUrl);
  };

  const handleRemove = async () => {
    setShowDeleteDialog(true);
  };

  const confirmRemove = async () => {
    setIsDeleting(true);
    try {
      await onRemove(book.id);
      toast.success("Book removed from library", {
        duration: 4000,
      });
      // Navigate back to library after successful removal
      navigate("/");
    } catch (error) {
      toast.error("Failed to remove book");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBookmarkSelect = (bookmarkItem: any) => {
    const location = bookmarkItem.location;
    // Use bookId instead of filePath for consistency with reader navigation
    const baseUrl = `/reader?bookId=${encodeURIComponent(book.id)}`;
    const bookmarkUrl = location 
      ? `${baseUrl}&location=${encodeURIComponent(location)}`
      : baseUrl;
    navigate(bookmarkUrl);
  };

  const handleBookmarkDelete = (bookmarkId: string) => {
    removeBookmark(bookmarkId);
  };

  return (
    <div className="flex flex-col h-screen bg-background animate-slide-up overflow-hidden">
      <BookDetailsHeader onBack={handleBack} onShare={handleShare} />
      
      {/* Main scrollable content area - fixed height with overflow */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-4">
        <BookHero book={book} />
        
        <ReadingStatsCard
          book={book}
          stats={stats}
          resumeLabel={getResumeLabel()}
          lastReadFormatted={formatLastRead()}
          timeLeftFormatted={formatTimeLeft()}
          onReadNow={handleReadNow}
        />
        
        <BookMetadata 
          book={book} 
          stats={stats}
          bookmarks={isLoading ? [] : getBookmarks()}
          bookFilePath={book.filePath}
          onBookmarkSelect={handleBookmarkSelect}
          onBookmarkDelete={handleBookmarkDelete}
        />
        
        <BookActions
          isFinished={stats.isFinished}
          onMarkFinished={markAsFinished}
          onRemove={handleRemove}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Book</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove "{titleCase(book.title)}" from your library?
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>The book file</li>
                <li>All reading progress</li>
                <li>All bookmarks</li>
                <li>Reading statistics</li>
              </ul>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRemove}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-900 dark:hover:bg-red-800"
              >
                {isDeleting ? "Removing..." : "Remove Book"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
