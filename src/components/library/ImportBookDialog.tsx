import { useState, useEffect } from "react";
import { X, Plus, FolderInput, Tag, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/types/book";
import { Shelf } from "@/types/book";
import { labelService } from "@/services/labelService";
import { shelfService } from "@/services/shelfService";
import { toast } from "@/components/ui/toast";

interface ImportBookDialogProps {
  isOpen: boolean;
  bookCount: number;
  bookTitle?: string;
  onConfirm: (shelfId: string | null, labelIds: string[]) => void;
  onCancel: () => void;
}

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
];

export function ImportBookDialog({
  isOpen,
  bookCount,
  bookTitle,
  onConfirm,
  onCancel,
}: ImportBookDialogProps) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [showNewShelf, setShowNewShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  useEffect(() => {
    const loadData = () => {
      setShelves(shelfService.getShelves());
      setLabels(labelService.getLabels());
    };

    if (isOpen) {
      loadData();
      setSelectedLabelIds([]);
      setShowNewShelf(false);
      setShowNewLabel(false);
      setNewShelfName('');
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);

      const lastUsedId = shelfService.getLastUsedShelfId();
      if (lastUsedId) {
        setSelectedShelfId(lastUsedId);
      } else {
        const defaultShelf = shelfService.getDefaultShelf();
        setSelectedShelfId(defaultShelf?.id || null);
      }
    }
  }, [isOpen]);

  const handleCreateShelf = async () => {
    if (!newShelfName.trim()) {
      toast.error('Shelf name cannot be empty');
      return;
    }

    try {
      const newShelf = await shelfService.createShelf(newShelfName.trim());
      setShelves(shelfService.getShelves());
      setSelectedShelfId(newShelf.id);
      setShowNewShelf(false);
      setNewShelfName('');
      toast.success('Shelf created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create shelf');
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Label name cannot be empty');
      return;
    }

    try {
      const newLabel = await labelService.createLabel(newLabelName.trim(), newLabelColor);
      setLabels(labelService.getLabels());
      setSelectedLabelIds(prev => [...prev, newLabel.id]);
      setShowNewLabel(false);
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
      toast.success('Label created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create label');
    }
  };

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabelIds(prev =>
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  const handleConfirm = async () => {
    if (selectedShelfId) {
      await shelfService.setLastUsedShelf(selectedShelfId);
    }
    onConfirm(selectedShelfId, selectedLabelIds);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-primary" />
            {bookCount === 1 ? 'Import Book' : `Import ${bookCount} Books`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {bookTitle && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{bookTitle}</span>
              {bookCount > 1 && ` and ${bookCount - 1} more`}
            </p>
          )}

          {/* Shelf Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-muted-foreground" />
              Shelf
            </label>
            
            {showNewShelf ? (
              <div className="flex gap-2">
                <Input
                  value={newShelfName}
                  onChange={(e) => setNewShelfName(e.target.value)}
                  placeholder="Shelf name"
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateShelf();
                    if (e.key === 'Escape') setShowNewShelf(false);
                  }}
                />
                <Button size="sm" onClick={handleCreateShelf}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewShelf(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedShelfId || ''}
                  onChange={(e) => setSelectedShelfId(e.target.value || null)}
                  className="flex-1 px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Unassigned</option>
                  {shelves.map(shelf => (
                    <option key={shelf.id} value={shelf.id}>
                      {shelf.name}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => setShowNewShelf(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Label Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              Labels
            </label>

            {showNewLabel ? (
              <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                <Input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name"
                  className="w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateLabel();
                    if (e.key === 'Escape') setShowNewLabel(false);
                  }}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Color:</span>
                  <div className="flex gap-1">
                    {LABEL_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewLabelColor(color)}
                        className={`w-5 h-5 rounded-full border-2 ${
                          newLabelColor === color ? 'border-foreground' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateLabel}>Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewLabel(false)}>Cancel</Button>
                </div>
              </div>
            ) : labels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {labels.map(label => {
                  const isSelected = selectedLabelIds.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected ? 'text-white' : 'bg-secondary hover:bg-secondary/80'
                      }`}
                      style={isSelected ? { backgroundColor: label.color } : {}}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: isSelected ? 'white' : label.color }}
                      />
                      {label.name}
                    </button>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setShowNewLabel(true)} className="h-8 px-2">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">No labels yet</span>
                <Button variant="outline" size="sm" onClick={() => setShowNewLabel(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}