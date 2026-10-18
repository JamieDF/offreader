import { FolderInput, HardDrive, ListChecks, Tag, Trash2, X } from "lucide-react";

interface SelectionActionBarProps {
  selectedCount: number;
  /** Selected books that are linked: enables the move-into-library action. */
  linkedSelectedCount: number;
  /** All currently visible (filtered) books selected: makes the "All" toggle untick. */
  allVisibleSelected: boolean;
  onToggleSelectAll: () => void;
  onAssignShelf: () => void;
  onEditLabels: () => void;
  onMoveToLibrary: () => void;
  onDelete: () => void;
  onExit: () => void;
}

const actionBtn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40 disabled:pointer-events-none";

export function SelectionActionBar({
  selectedCount,
  linkedSelectedCount,
  allVisibleSelected,
  onToggleSelectAll,
  onAssignShelf,
  onEditLabels,
  onMoveToLibrary,
  onDelete,
  onExit,
}: SelectionActionBarProps) {
  const none = selectedCount === 0;

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full border border-border bg-popover px-2 py-1.5 shadow-xl animate-slide-up"
    >
      <button
        type="button"
        onClick={onToggleSelectAll}
        className={actionBtn}
        title={allVisibleSelected ? 'Deselect all' : 'Select all'}
      >
        <ListChecks className="h-3.5 w-3.5" />
        {allVisibleSelected ? 'None' : 'All'}
      </button>

      <span className="px-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
        {selectedCount} selected
      </span>

      <span className="h-4 w-px bg-border" />

      <button type="button" onClick={onAssignShelf} disabled={none} className={actionBtn}>
        <FolderInput className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Shelf</span>
      </button>
      <button type="button" onClick={onEditLabels} disabled={none} className={actionBtn}>
        <Tag className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Labels</span>
      </button>
      {/* Copies linked books' bytes into OffReader storage: source files
          are untouched. Only meaningful when the selection has linked books. */}
      {linkedSelectedCount > 0 && (
        <button
          type="button"
          onClick={onMoveToLibrary}
          className={actionBtn}
          title="Copy linked files into library storage"
        >
          <HardDrive className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Move into library</span>
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={none}
        className={`${actionBtn} text-destructive hover:bg-destructive/10`}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Delete</span>
      </button>

      <span className="h-4 w-px bg-border" />

      <button
        type="button"
        onClick={onExit}
        className={actionBtn}
        aria-label="Exit selection"
        title="Exit selection (Esc)"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
