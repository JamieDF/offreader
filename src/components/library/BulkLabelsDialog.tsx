import { useState, useEffect } from "react";
import { Plus, Check, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Book, Label } from "@/types/book";
import { labelService } from "@/services/labelService";
import { toast } from "@/components/ui/toast";
import { LABEL_COLORS } from "@/constants/labels";

interface BulkLabelsDialogProps {
  isOpen: boolean;
  /** The currently selected books — used to compute each label's tri-state. */
  books: Book[];
  /** Called with the labels to add to, and remove from, every selected book. */
  onApply: (addLabelIds: Set<string>, removeLabelIds: Set<string>) => void;
  onClose: () => void;
}

export function BulkLabelsDialog({ isOpen, books, onApply, onClose }: BulkLabelsDialogProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  useEffect(() => {
    if (isOpen) {
      setLabels(labelService.getLabels());
      setChanges(new Map());
      setShowNewLabel(false);
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
    }
  }, [isOpen]);

  const countWith = (labelId: string) =>
    books.filter(b => b.labelIds.includes(labelId)).length;

  // 'all' | 'none' | 'some' after applying pending changes
  const effectiveState = (labelId: string): 'all' | 'none' | 'some' => {
    const change = changes.get(labelId);
    if (change !== undefined) return change ? 'all' : 'none';
    const count = countWith(labelId);
    if (count === 0) return 'none';
    if (count === books.length) return 'all';
    return 'some';
  };

  const toggleLabel = (labelId: string) => {
    setChanges(prev => {
      const next = new Map(prev);
      const effective = effectiveState(labelId);
      const newValue = effective !== 'all';
      // If toggling back to the original state, drop the pending change
      const originallyAll = countWith(labelId) === books.length;
      if (newValue === originallyAll) {
        next.delete(labelId);
      } else {
        next.set(labelId, newValue);
      }
      return next;
    });
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Label name cannot be empty');
      return;
    }
    try {
      const newLabel = await labelService.createLabel(newLabelName.trim(), newLabelColor);
      setLabels(labelService.getLabels());
      // A label created from this dialog applies to the whole selection
      setChanges(prev => new Map(prev).set(newLabel.id, true));
      setShowNewLabel(false);
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create label');
    }
  };

  const handleApply = () => {
    const addLabelIds = new Set<string>();
    const removeLabelIds = new Set<string>();
    changes.forEach((value, labelId) => {
      (value ? addLabelIds : removeLabelIds).add(labelId);
    });
    onApply(addLabelIds, removeLabelIds);
  };

  const effectiveCount = (labelId: string) => {
    const change = changes.get(labelId);
    if (change === true) return books.length;
    if (change === false) return 0;
    return countWith(labelId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Labels for {books.length} book{books.length === 1 ? '' : 's'}</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {labels.length > 0 && (
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {labels.map(label => {
                const state = effectiveState(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted flex items-center gap-2.5"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border-2 shrink-0 ${
                        state === 'all'
                          ? 'border-primary bg-primary text-primary-foreground'
                          : state === 'some'
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-muted-foreground/50 text-transparent'
                      }`}
                    >
                      {state === 'all' && <Check className="h-3 w-3" strokeWidth={3} />}
                      {state === 'some' && <Minus className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 min-w-0 truncate">{label.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {effectiveCount(label.id)}/{books.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {labels.length === 0 && !showNewLabel && (
            <p className="text-sm text-muted-foreground text-center py-2">No labels yet. Create one below.</p>
          )}

          {showNewLabel ? (
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name"
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
                <Button size="sm" onClick={handleCreateLabel}>
                  <Check className="h-4 w-4 mr-1" />
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewLabel(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewLabel(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Label
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply} disabled={changes.size === 0}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
