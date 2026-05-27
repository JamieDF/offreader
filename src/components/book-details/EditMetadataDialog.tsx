import { useState, useEffect } from "react";
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
import { Book } from "@/types/book";

interface EditMetadataDialogProps {
  isOpen: boolean;
  book: Book;
  onSave: (updates: { title: string; author: string; description: string }) => void;
  onClose: () => void;
}

export function EditMetadataDialog({
  isOpen,
  book,
  onSave,
  onClose,
}: EditMetadataDialogProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle(book.title);
      setAuthor(book.author);
      setDescription(book.description || "");
      setError("");
    }
  }, [isOpen, book.title, book.author, book.description]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();

    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    if (!trimmedAuthor) {
      setError("Author is required");
      return;
    }

    onSave({
      title: trimmedTitle,
      author: trimmedAuthor,
      description: description.trim(),
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Book Details</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="Book title"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Author</label>
            <Input
              value={author}
              onChange={(e) => { setAuthor(e.target.value); setError(""); }}
              placeholder="Author name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Book description"
              rows={4}
              className="max-h-48 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
