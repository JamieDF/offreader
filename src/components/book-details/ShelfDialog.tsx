import { useState, useEffect } from "react";
import { Plus, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shelf } from "@/types/book";
import { shelfService } from "@/services/shelfService";
import { toast } from "@/components/ui/toast";

interface ShelfDialogProps {
  isOpen: boolean;
  currentShelfId: string | null;
  onSelectShelf: (shelfId: string | null) => void;
  onClose: () => void;
}

export function ShelfDialog({
  isOpen,
  currentShelfId,
  onSelectShelf,
  onClose,
}: ShelfDialogProps) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [showNewShelf, setShowNewShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfIsDefault, setNewShelfIsDefault] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShelves(shelfService.getShelves());
      setShowNewShelf(false);
      setNewShelfName('');
      setNewShelfIsDefault(false);
    }
  }, [isOpen]);

  const handleCreateShelf = async () => {
    if (!newShelfName.trim()) {
      toast.error('Shelf name cannot be empty');
      return;
    }

    try {
      const newShelf = await shelfService.createShelf(newShelfName.trim());
      if (newShelfIsDefault) {
        await shelfService.setDefaultShelf(newShelf.id);
      }
      setShelves(shelfService.getShelves());
      onSelectShelf(newShelf.id);
      setShowNewShelf(false);
      setNewShelfName('');
      setNewShelfIsDefault(false);
      toast.success('Shelf created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create shelf');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Shelf</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Current shelf selection */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Available Shelves</p>
            <div className="space-y-1">
              <button
                onClick={() => { onSelectShelf(null); onClose(); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  currentShelfId === null
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                Unassigned
              </button>
              {shelves.map(shelf => (
                <button
                  key={shelf.id}
                  onClick={() => { onSelectShelf(shelf.id); onClose(); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                    currentShelfId === shelf.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span>{shelf.name}</span>
                  {shelf.isDefault && <span className="text-xs opacity-60">Default</span>}
                </button>
              ))}
            </div>
          </div>

          {/* New shelf form */}
          {showNewShelf ? (
            <div className="space-y-3 p-3 bg-muted/50 rounded-md">
              <Input
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                placeholder="Shelf name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateShelf();
                  if (e.key === 'Escape') setShowNewShelf(false);
                }}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newShelfIsDefault}
                  onChange={(e) => setNewShelfIsDefault(e.target.checked)}
                  className="rounded border-input"
                />
                Set as default
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateShelf}>
                  <Check className="h-4 w-4 mr-1" />
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewShelf(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewShelf(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              New Shelf
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}