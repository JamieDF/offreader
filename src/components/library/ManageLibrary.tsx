import { useState, useEffect } from "react";
import { GripVertical, Star, Trash2, Plus, X, Check, FolderInput, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/types/book";
import { Shelf } from "@/types/book";
import { shelfService } from "@/services/shelfService";
import { labelService } from "@/services/labelService";
import { libraryService } from "@/services/LibraryService";
import { saveStoredBooks } from "@/services/bookPersistence";
import { toast } from "@/components/ui/toast";

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
];

export function ManageLibrary() {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfIsDefault, setNewShelfIsDefault] = useState(false);
  const [showNewShelf, setShowNewShelf] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [draggedShelfId, setDraggedShelfId] = useState<string | null>(null);

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

  const handleCreateShelf = async () => {
    if (!newShelfName.trim()) {
      toast.error('Shelf name cannot be empty');
      return;
    }

    try {
      await shelfService.createShelf(newShelfName.trim());
      if (newShelfIsDefault) {
        const newShelf = shelfService.getShelves().find(s => s.name === newShelfName.trim());
        if (newShelf) {
          await shelfService.setDefaultShelf(newShelf.id);
        }
      }
      setNewShelfName('');
      setNewShelfIsDefault(false);
      setShowNewShelf(false);
      toast.success('Shelf created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create shelf');
    }
  };

  const handleUpdateShelf = async (shelfId: string, name: string, isDefault: boolean) => {
    try {
      await shelfService.updateShelf(shelfId, { name, isDefault });
      setEditingShelfId(null);
      toast.success('Shelf updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update shelf');
    }
  };

  const handleDeleteShelf = async (shelfId: string) => {
    if (shelves.length <= 1) {
      toast.error('Cannot delete the last remaining shelf');
      return;
    }

    try {
      await shelfService.deleteShelf(shelfId);
      const books = libraryService.getBooks();
      const updatedBooks = books.map(b =>
        b.shelfId === shelfId ? { ...b, shelfId: null } : b
      );
      libraryService.updateBooks(updatedBooks);
      await saveStoredBooks(updatedBooks);
      toast.success('Shelf deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete shelf');
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Label name cannot be empty');
      return;
    }

    try {
      await labelService.createLabel(newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setNewLabelColor(LABEL_COLORS[0]);
      setShowNewLabel(false);
      toast.success('Label created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create label');
    }
  };

  const handleUpdateLabel = async (labelId: string, name: string, color: string) => {
    try {
      await labelService.updateLabel(labelId, { name, color });
      setEditingLabelId(null);
      toast.success('Label updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update label');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      await labelService.deleteLabel(labelId);
      const books = libraryService.getBooks();
      const updatedBooks = books.map(b => ({
        ...b,
        labelIds: b.labelIds.filter(id => id !== labelId),
      }));
      libraryService.updateBooks(updatedBooks);
      await saveStoredBooks(updatedBooks);
      toast.success('Label deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete label');
    }
  };

  const handleDragStart = (shelfId: string) => {
    setDraggedShelfId(shelfId);
  };

  const handleDragOver = (e: React.DragEvent, targetShelfId: string) => {
    e.preventDefault();
    if (!draggedShelfId || draggedShelfId === targetShelfId) return;

    const dragIdx = shelves.findIndex(s => s.id === draggedShelfId);
    const targetIdx = shelves.findIndex(s => s.id === targetShelfId);

    if (dragIdx === -1 || targetIdx === -1) return;

    const newShelves = [...shelves];
    const [removed] = newShelves.splice(dragIdx, 1);
    newShelves.splice(targetIdx, 0, removed);
    setShelves(newShelves);
  };

  const handleDragEnd = async () => {
    if (!draggedShelfId) return;

    const orderedIds = shelves.map(s => s.id);
    try {
      await shelfService.reorderShelves(orderedIds);
    } catch (error) {
      toast.error('Failed to reorder shelves');
      setShelves(shelfService.getShelves());
    }

    setDraggedShelfId(null);
  };

  return (
    <div className="space-y-6">
      {/* Shelves Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <FolderInput className="h-4 w-4" />
          <span>Shelves</span>
        </div>

        <div className="space-y-2">
          {shelves.map(shelf => (
            <div key={shelf.id}>
              {editingShelfId === shelf.id ? (
                <ShelfEditForm
                  shelf={shelf}
                  onSave={(name, isDefault) => handleUpdateShelf(shelf.id, name, isDefault)}
                  onCancel={() => setEditingShelfId(null)}
                  onDelete={() => handleDeleteShelf(shelf.id)}
                  canDelete={shelves.length > 1}
                />
              ) : (
                <div
                  draggable
                  onDragStart={() => handleDragStart(shelf.id)}
                  onDragOver={(e) => handleDragOver(e, shelf.id)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors cursor-move"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 font-medium">{shelf.name}</span>
                  {shelf.isDefault && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingShelfId(shelf.id)}
                    className="h-8 w-8 p-0"
                  >
                    ✎
                  </Button>
                </div>
              )}
            </div>
          ))}

          {showNewShelf ? (
            <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
              <Input
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                placeholder="Shelf name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateShelf();
                  if (e.key === 'Escape') () => { setShowNewShelf(false); setNewShelfName(''); }
                }}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newShelfIsDefault}
                  onChange={(e) => setNewShelfIsDefault(e.target.checked)}
                  className="rounded border-input"
                />
                Set as default for new books
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateShelf}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowNewShelf(false); setNewShelfName(''); setNewShelfIsDefault(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowNewShelf(true)}
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Shelf
            </Button>
          )}
        </div>
      </div>

      {/* Labels Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Tag className="h-4 w-4" />
          <span>Labels</span>
        </div>

        <div className="space-y-2">
          {labels.map(label => (
            <div key={label.id}>
              {editingLabelId === label.id ? (
                <LabelEditForm
                  label={label}
                  onSave={(name, color) => handleUpdateLabel(label.id, name, color)}
                  onCancel={() => setEditingLabelId(null)}
                  onDelete={() => handleDeleteLabel(label.id)}
                />
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 font-medium">{label.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingLabelId(label.id)}
                    className="h-8 w-8 p-0"
                  >
                    ✎
                  </Button>
                </div>
              )}
            </div>
          ))}

          {showNewLabel ? (
            <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateLabel();
                  if (e.key === 'Escape') () => { setShowNewLabel(false); setNewLabelName(''); }
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color:</span>
                <div className="flex gap-1.5">
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
                <Button size="sm" variant="ghost" onClick={() => { setShowNewLabel(false); setNewLabelName(''); setNewLabelColor(LABEL_COLORS[0]); }}>Cancel</Button>
              </div>
            </div>
          ) : labels.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No labels yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewLabel(true)}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Label
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowNewLabel(true)}
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Label
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ShelfEditFormProps {
  shelf: Shelf;
  onSave: (name: string, isDefault: boolean) => void;
  onCancel: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function ShelfEditForm({ shelf, onSave, onCancel, onDelete, canDelete }: ShelfEditFormProps) {
  const [name, setName] = useState(shelf.name);
  const [isDefault, setIsDefault] = useState(shelf.isDefault);

  return (
    <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(name, isDefault);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-input"
        />
        Set as default for new books
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(name, isDefault)}>Save</Button>
        {canDelete && (
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

interface LabelEditFormProps {
  label: Label;
  onSave: (name: string, color: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function LabelEditForm({ label, onSave, onCancel, onDelete }: LabelEditFormProps) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);

  return (
    <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(name, color);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Color:</span>
        <div className="flex gap-1.5">
          {LABEL_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 ${
                color === c ? 'border-foreground' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(name, color)}>Save</Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}