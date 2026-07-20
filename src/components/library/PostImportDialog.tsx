import { useState, useEffect } from "react";
import { Plus, BookOpen, Tag, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Book, Label } from "@/types/book";
import { Shelf } from "@/types/book";
import { labelService } from "@/services/labelService";
import { shelfService } from "@/services/shelfService";
import { toast } from "@/components/ui/toast";
import { LABEL_COLORS } from "@/constants/labels";

interface PostImportDialogProps {
  isOpen: boolean;
  books: Book[];
  onConfirm: (
    shelfId: string | null,
    labelIds: string[],
    metadataUpdates?: { title: string; author: string; description: string }
  ) => void;
  /** Selector for the Title/Author/Description wrapper (used by the
   *  onboarding tour to anchor on the metadata fields). */
  dataTourMetadataId?: string;
  /** Selector for the Shelf + Labels wrapper (used by the onboarding
   *  tour to anchor on the shelf/labels section). */
  dataTourShelfId?: string;
}

export function PostImportDialog({
  isOpen,
  books,
  onConfirm,
  dataTourMetadataId,
  dataTourShelfId,
}: PostImportDialogProps) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [showNewShelf, setShowNewShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);

  const isSingleBook = books.length === 1;
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');

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
      setValidationError('');

      if (books.length === 1) {
        setTitle(books[0].title);
        setAuthor(books[0].author);
        setDescription(books[0].description || '');
      }

      const lastUsedId = shelfService.getLastUsedShelfId();
      if (lastUsedId) {
        setSelectedShelfId(lastUsedId);
      } else {
        const defaultShelf = shelfService.getDefaultShelf();
        setSelectedShelfId(defaultShelf?.id || null);
      }
    }
  }, [isOpen, books]);

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

  const handleConfirm = () => {
    if (isSingleBook) {
      const trimmedTitle = title.trim();
      const trimmedAuthor = author.trim();
      if (!trimmedTitle || !trimmedAuthor) {
        setValidationError('Title and author are required');
        return;
      }
      onConfirm(selectedShelfId, selectedLabelIds, {
        title: trimmedTitle,
        author: trimmedAuthor,
        description: description.trim(),
      });
    } else {
      onConfirm(selectedShelfId, selectedLabelIds);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {isSingleBook ? 'Book Added' : `${books.length} Books Added`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSingleBook ? (
            <>
              <div className="space-y-3" data-tour={dataTourMetadataId}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setValidationError(''); }}
                    placeholder="Book title"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Author</label>
                  <Input
                    value={author}
                    onChange={(e) => { setAuthor(e.target.value); setValidationError(''); }}
                    placeholder="Author name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="max-h-32 resize-none"
                    placeholder="Book description"
                  />
                </div>
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              {books.map(book => (
                <p key={book.id} className="text-sm text-foreground">{book.title}</p>
              ))}
            </div>
          )}

          <div data-tour={dataTourShelfId} className="space-y-2">
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                Shelf
              </label>

              {showNewShelf ? (
                <div className="flex gap-2 mt-1.5">
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
                <div className="flex gap-2 mt-1.5">
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

            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Labels
              </label>

              {showNewLabel ? (
                <div className="space-y-2 p-3 bg-muted/50 rounded-md mt-1.5">
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
                            newLabelColor ? 'border-foreground' : 'border-transparent'
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
                <div className="flex flex-wrap gap-2 mt-1.5">
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
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm text-muted-foreground">No labels yet</span>
                  <Button variant="outline" size="sm" onClick={() => setShowNewLabel(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
