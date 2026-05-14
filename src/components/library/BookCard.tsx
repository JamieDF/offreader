import { Progress } from "@/components/ui/progress";
import { Book } from "@/types/book";
import { BookOpen, FolderInput, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { titleCase } from "@/utils/titleCase";
import { Label, Shelf } from "@/types/book";
import { shelfService } from "@/services/shelfService";
import { labelService } from "@/services/labelService";

interface BookCardProps {
  book: Book;
  onSelect: (book: Book) => void;
  labels?: Label[];
}

export function BookCard({ book, onSelect, labels = [] }: BookCardProps) {
  const [imageError, setImageError] = useState(false);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const showFallback = imageError || !book.coverImage;

  const bookLabels = labels.filter(l => book.labelIds.includes(l.id));
  const visibleLabels = bookLabels.slice(0, 2);
  const overflowCount = bookLabels.length - 2;

  useEffect(() => {
    const updateShelfAndLabels = () => {
      if (book.shelfId) {
        const shelves = shelfService.getShelves();
        setShelf(shelves.find(s => s.id === book.shelfId) || null);
      } else {
        setShelf(null);
      }
    };

    updateShelfAndLabels();

    const unsubShelf = shelfService.subscribe(updateShelfAndLabels);
    const unsubLabel = labelService.subscribe(updateShelfAndLabels);

    return () => {
      unsubShelf();
      unsubLabel();
    };
  }, [book.shelfId]);

  return (
    <button
      onClick={() => onSelect(book)}
      className="group flex flex-col text-left transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg w-full bg-card border border-border overflow-hidden hover:shadow-lg hover:border-primary/30 transition-colors"
    >
      {/* Cover with 2:3 aspect ratio */}
      <div className="relative w-full overflow-hidden bg-muted" style={{ paddingBottom: '150%' }}>
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

        {/* Shelf badge - top left corner */}
        {shelf && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-secondary/90 backdrop-blur-sm text-secondary-foreground text-[9px] font-medium rounded shadow">
            <FolderInput className="h-2.5 w-2.5" />
            <span className="max-w-[60px] truncate">{shelf.name}</span>
          </span>
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
          <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
            Done
          </div>
        )}
      </div>

      {/* Book Info - contained within the border */}
      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
          {titleCase(book.title)}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {book.author}
        </p>

        {/* Labels only (shelf is on cover) */}
        {visibleLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {visibleLabels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: `${label.color}20`, color: label.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                {label.name}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="text-xs text-muted-foreground">+{overflowCount}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}