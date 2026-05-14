import { Badge } from "@/components/ui/badge";
import { Book } from "@/types/book";
import { Label } from "@/types/book";

interface LabelPillsProps {
  labels: Label[];
  maxVisible?: number;
}

export function LabelPills({ labels, maxVisible = 2 }: LabelPillsProps) {
  if (labels.length === 0) return null;

  const visible = labels.slice(0, maxVisible);
  const overflow = labels.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {visible.map((label) => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: label.color }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          <span className="line-clamp-1">{label.name}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-xs text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}

interface ShelfDotProps {
  hasShelf: boolean;
}

export function ShelfDot({ hasShelf }: ShelfDotProps) {
  if (!hasShelf) return null;

  return (
    <span
      className="absolute top-2 left-2 w-3 h-3 rounded-full bg-muted-foreground/40"
      title="On shelf"
    />
  );
}

interface BookCardExtrasProps {
  book: Book;
  labels: Label[];
}

export function BookCardExtras({ book, labels }: BookCardExtrasProps) {
  const bookLabels = labels.filter(l => book.labelIds.includes(l.id));

  return (
    <div className="px-1">
      <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
        {book.title}
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
        {book.author}
      </p>
      {bookLabels.length > 0 && (
        <LabelPills labels={bookLabels} maxVisible={2} />
      )}
    </div>
  );
}