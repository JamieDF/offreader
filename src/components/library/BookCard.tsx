import { Progress } from "@/components/ui/progress";
import { Book } from "@/types/book";
import { BookOpen, Check, FileWarning, FolderInput } from "lucide-react";
import { useState, useEffect } from "react";
import { titleCase } from "@/utils/titleCase";
import { Label, Shelf } from "@/types/book";
import { shelfService } from "@/services/shelfService";
import { labelService } from "@/services/labelService";

interface BookCardProps {
  book: Book;
  onSelect: (book: Book, e: React.MouseEvent) => void;
  labels?: Label[];
  /** When set, applied to the root element as data-tour for the
   *  onboarding tour to anchor on. */
  dataTourId?: string;
  /** Bulk-selection mode: card clicks toggle selection instead of opening. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (book: Book) => void;
}

export function BookCard({ book, onSelect, labels = [], dataTourId, selectionMode = false, selected = false, onToggleSelect }: BookCardProps) {
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
    <div className="relative group">
      <button
        onClick={(e) => onSelect(book, e)}
        data-tour={dataTourId}
        className={`flex flex-col text-left transition-transform duration-200 ${selectionMode ? '' : 'hover:scale-[1.02]'} active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg w-full bg-card border overflow-hidden hover:shadow-lg transition-colors ${
          selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/30'
        }`}
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

          {/* Missing-source badge: a linked book whose file can't be read.
              Takes the corner over "Done" since it needs attention. */}
          {book.missing && !selectionMode && (
            <div className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
              <FileWarning className="h-3 w-3" />
              Missing
            </div>
          )}

          {/* Completed badge: hidden while selecting (checkbox takes the corner) */}
          {book.progress === 100 && !book.missing && !selectionMode && (
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

      {/* Selection checkbox: outside the card button so it's not nested
          interactive content. Always visible in selection mode; on hover
          otherwise as an entry affordance on desktop. Not rendered when the
          card isn't selectable (e.g. the tour demo card). */}
      {onToggleSelect && (
        <button
          type="button"
          aria-label={selected ? `Deselect ${book.title}` : `Select ${book.title}`}
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(book);
          }}
          className={`absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-opacity ${
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/50 bg-background/80 text-transparent backdrop-blur-sm hover:border-primary'
          } ${
            selectionMode || selected
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
