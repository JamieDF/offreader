import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onBrowse: () => void;
}

export function EmptyState({ onBrowse }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center m-6">
        <BookOpen className="w-10 h-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Your Library is Empty
      </h2>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Start building your collection by importing your first book.
      </p>
      <Button onClick={onBrowse} size="lg" data-tour="empty-state-import">
        Browse Files
      </Button>
    </div>
  );
}
