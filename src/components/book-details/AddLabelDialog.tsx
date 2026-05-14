import { useState, useEffect } from "react";
import { Plus, X, Check } from "lucide-react";
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
import { labelService } from "@/services/labelService";
import { toast } from "@/components/ui/toast";

interface AddLabelDialogProps {
  isOpen: boolean;
  bookLabelIds: string[];
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onClose: () => void;
}

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
];

export function AddLabelDialog({
  isOpen,
  bookLabelIds,
  onAddLabel,
  onRemoveLabel,
  onClose,
}: AddLabelDialogProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  useEffect(() => {
    if (isOpen) {
      setLabels(labelService.getLabels());
      setShowNewLabel(false);
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
    }
  }, [isOpen]);

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Label name cannot be empty');
      return;
    }

    try {
      const newLabel = await labelService.createLabel(newLabelName.trim(), newLabelColor);
      setLabels(labelService.getLabels());
      onAddLabel(newLabel.id);
      setShowNewLabel(false);
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
      toast.success('Label created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create label');
    }
  };

  const bookLabels = labels.filter(l => bookLabelIds.includes(l.id));
  const availableLabels = labels.filter(l => !bookLabelIds.includes(l.id));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Labels</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {bookLabels.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Labels</p>
              <div className="flex flex-wrap gap-2">
                {bookLabels.map(label => (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${label.color}20`, color: label.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                    <button onClick={() => onRemoveLabel(label.id)} className="ml-0.5 hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {availableLabels.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Add Labels</p>
              <div className="flex flex-wrap gap-2">
                {availableLabels.map(label => (
                  <button
                    key={label.id}
                    onClick={() => onAddLabel(label.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary hover:bg-secondary/80"
                  >
                    <Plus className="h-3 w-3" />
                    {label.name}
                  </button>
                ))}
              </div>
            </div>
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

          {labels.length === 0 && !showNewLabel && (
            <p className="text-sm text-muted-foreground text-center py-2">No labels yet. Create one above.</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}