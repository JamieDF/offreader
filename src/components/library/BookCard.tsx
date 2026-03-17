import { Progress } from "@/components/ui/progress";
import { Book } from "@/types/book";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { titleCase } from "@/utils/titleCase";

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
}

export function BookCard({ book, onSelect }: BookCardProps) {
  const [imageError, setImageError] = useState(false);
  const showFallback = imageError || !book.coverImage;

  return (
    <button
      onClick={() => onSelect(book)}
      className="group flex flex-col gap-2 text-left transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg w-full"
    >
      {/* Cover with 2:3 aspect ratio using padding trick */}
      <div className="relative w-full overflow-hidden rounded-lg shadow-md bg-muted" style={{ paddingBottom: '150%' }}>
        {showFallback ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 p-4">
            <BookOpen className="w-12 h-12 text-primary/60 mb-2" />
            <span className="text-xs text-primary/80 text-center font-medium line-clamp-3">
              {titleCase(book.title)}
            </span>
          </div>
        ) : (
          <img
            src={book.coverImage}
            alt={`Cover of ${titleCase(book.title)}`}
            className="absolute inset-0 h-full w-full object-cover transition-all duration-300 group-hover:brightness-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        )}
        
        {/* Progress bar at bottom of cover */}
        {book.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm p-1.5">
            <Progress 
              value={book.progress} 
              className="h-1.5 bg-white/30"
            />
          </div>
        )}
        
        {/* Completed badge */}
        {book.progress === 100 && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
            ✓ Done
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="px-1">
        <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
          {titleCase(book.title)}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {book.author}
        </p>
      </div>
    </button>
  );
}
