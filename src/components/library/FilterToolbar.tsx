import { useState, useEffect, useRef } from "react";
import { X, FolderInput, Tag, BookOpen } from "lucide-react";
import { Label } from "@/types/book";
import { Shelf } from "@/types/book";
import { LibraryFilters, ReadingStatus } from "@/hooks/useLibrary";
import { labelService } from "@/services/labelService";
import { shelfService } from "@/services/shelfService";

interface FilterToolbarProps {
  filters: LibraryFilters;
  onFilterChange: <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
  bookCount: number;
}

const statusOptions: { value: ReadingStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'in_progress', label: 'Reading' },
  { value: 'read', label: 'Read' },
];

type PopupType = 'status' | 'shelf' | 'labels' | null;

function StatusPopup({
  currentStatus,
  onSelect,
  onClose,
}: {
  currentStatus: ReadingStatus;
  onSelect: (status: ReadingStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-lg shadow-lg py-1.5 min-w-[140px] max-h-[60vh] overflow-y-auto z-50">
      {statusOptions.map(option => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            currentStatus === option.value
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 p-1 hover:bg-muted rounded"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ShelfPopup({
  shelves,
  currentShelfId,
  onSelect,
  onClose,
}: {
  shelves: Shelf[];
  currentShelfId: string | null;
  onSelect: (shelfId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-lg shadow-lg py-1.5 min-w-[160px] max-h-[60vh] overflow-y-auto z-50">
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
          currentShelfId === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
        }`}
      >
        All Shelves
      </button>
      {shelves.map(shelf => (
        <button
          key={shelf.id}
          onClick={() => onSelect(shelf.id)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            currentShelfId === shelf.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          }`}
        >
          {shelf.name}
        </button>
      ))}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 p-1 hover:bg-muted rounded"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function LabelsPopup({
  labels,
  currentLabelIds,
  onToggle,
  onClose,
}: {
  labels: Label[];
  currentLabelIds: string[];
  onToggle: (labelId: string) => void;
  onClose: () => void;
}) {
  if (labels.length === 0) {
    return (
      <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-lg shadow-lg py-3 px-3 min-w-[160px] z-50">
        <p className="text-xs text-muted-foreground text-center">No labels yet</p>
        <button
          onClick={onClose}
          className="absolute top-1 right-1 p-1 hover:bg-muted rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-lg shadow-lg py-1.5 min-w-[180px] max-h-[60vh] overflow-y-auto z-50">
      {labels.map(label => {
        const isSelected = currentLabelIds.includes(label.id);
        return (
          <button
            key={label.id}
            onClick={() => onToggle(label.id)}
            className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${
              isSelected ? 'bg-muted' : 'hover:bg-muted'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: label.color }}
            />
            <span className="flex-1 min-w-0 truncate">{label.name}</span>
            {isSelected && (
              <span className="text-xs" style={{ color: label.color }}>
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 p-1 hover:bg-muted rounded"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function FilterToolbar({
  filters,
  onFilterChange,
  onClearFilters,
  activeFilterCount,
  bookCount,
}: FilterToolbarProps) {
  const [openPopup, setOpenPopup] = useState<PopupType>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  useEffect(() => {
    const loadData = () => {
      setShelves(shelfService.getShelves());
      setLabels(labelService.getLabels());
    };

    loadData();
    const unsubscribeShelf = shelfService.subscribe(loadData);
    const unsubscribeLabel = labelService.subscribe(loadData);
    return () => {
      unsubscribeShelf();
      unsubscribeLabel();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setOpenPopup(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedShelf = shelves.find(s => s.id === filters.shelfId);
  const selectedStatus = statusOptions.find(s => s.value === filters.status);
  const selectedLabels = labels.filter(l => filters.labelIds.includes(l.id));

  return (
    <div ref={toolbarRef} className="sticky top-14 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => setOpenPopup(openPopup === 'status' ? null : 'status')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filters.status !== 'all'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <BookOpen className="h-3 w-3" />
              {selectedStatus?.label}
            </button>
            {openPopup === 'status' && (
              <StatusPopup
                currentStatus={filters.status}
                onSelect={(status) => {
                  onFilterChange('status', status);
                  setOpenPopup(null);
                }}
                onClose={() => setOpenPopup(null)}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenPopup(openPopup === 'shelf' ? null : 'shelf')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filters.shelfId !== null
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <FolderInput className="h-3 w-3" />
              {selectedShelf?.name || 'Shelf'}
            </button>
            {openPopup === 'shelf' && (
              <ShelfPopup
                shelves={shelves}
                currentShelfId={filters.shelfId}
                onSelect={(shelfId) => {
                  onFilterChange('shelfId', shelfId);
                  setOpenPopup(null);
                }}
                onClose={() => setOpenPopup(null)}
              />
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenPopup(openPopup === 'labels' ? null : 'labels')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filters.labelIds.length > 0
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Tag className="h-3 w-3" />
              {filters.labelIds.length > 0 ? `${filters.labelIds.length} Labels` : 'Labels'}
            </button>
            {openPopup === 'labels' && (
              <LabelsPopup
                labels={labels}
                currentLabelIds={filters.labelIds}
                onToggle={(labelId) => {
                  if (filters.labelIds.includes(labelId)) {
                    onFilterChange('labelIds', filters.labelIds.filter(id => id !== labelId));
                  } else {
                    onFilterChange('labelIds', [...filters.labelIds, labelId]);
                  }
                }}
                onClose={() => setOpenPopup(null)}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">
            <span className="font-medium text-foreground">{bookCount}</span> books
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={onClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}