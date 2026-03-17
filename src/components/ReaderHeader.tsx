import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreVertical, List, Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";

interface ReaderHeaderProps {
  bookTitle: string;
  onBack?: () => void;
  onOpenSettings?: () => void;
  onOpenToc?: () => void;
  onOpenBookmarks?: () => void;
}

const ReaderHeader = ({ bookTitle, onBack, onOpenSettings, onOpenToc, onOpenBookmarks }: ReaderHeaderProps) => {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll long titles
  useEffect(() => {
    const titleElement = titleRef.current;
    if (!titleElement) return;

    const text = titleElement.textContent || "";
    if (text.length <= 30) return; // Only scroll if title is longer than 30 characters

    let scrollPosition = 0;
    const scrollSpeed = 30; // pixels per second (slower)
    let animationId: number;
    let isPaused = false;
    let shouldPauseAtStart = true;

    const scroll = () => {
      if (!titleElement || isPaused) return;
      
      // Pause at the start
      if (shouldPauseAtStart && scrollPosition === 0) {
        isPaused = true;
        shouldPauseAtStart = false; // Don't pause again until next loop
        setTimeout(() => {
          isPaused = false;
          animationId = requestAnimationFrame(scroll);
        }, 3000); // 3 second pause at start
        return;
      }
      
      scrollPosition += scrollSpeed / 60; // 60fps
      
      // Pause at the end
      if (scrollPosition >= titleElement.scrollWidth - titleElement.clientWidth) {
        scrollPosition = titleElement.scrollWidth - titleElement.clientWidth;
        isPaused = true;
        setTimeout(() => {
          isPaused = false;
          scrollPosition = 0; // Reset to start instantly
          titleElement.scrollLeft = 0; // Also update the element immediately
          shouldPauseAtStart = true; // Allow pause at start again
          animationId = requestAnimationFrame(scroll);
        }, 2000); // 2 second pause at end
        return;
      }
      
      titleElement.scrollLeft = scrollPosition;
      animationId = requestAnimationFrame(scroll);
    };

    // Start scrolling immediately
    scroll();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [bookTitle]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/");
    }
  };

  return (
    <header className="px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm shrink-0 flex items-center justify-between transition-all duration-300 absolute top-0 left-0 right-0 z-20">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        className="shrink-0"
        aria-label="Back to library"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <div className="flex items-center justify-center min-w-0 flex-1">
        <div 
          ref={titleRef}
          className="text-sm font-medium text-card-foreground text-center overflow-hidden whitespace-nowrap"
          style={{ maxWidth: '60%' }}
        >
          {bookTitle || "EPUB Reader"}
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenToc}
          className="shrink-0"
          aria-label="Table of Contents"
        >
          <List className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenBookmarks}
          className="shrink-0"
          aria-label="Bookmarks"
        >
          <Bookmark className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="shrink-0"
          aria-label="Settings"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default ReaderHeader;
