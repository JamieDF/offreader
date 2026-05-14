import { useState, useEffect } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { BookOpen } from "lucide-react";
import { Book } from "@/types/book";
import { Label } from "@/types/book";
import { Shelf } from "@/types/book";
import { titleCase } from "@/utils/titleCase";
import { AddLabelDialog } from "./AddLabelDialog";
import { ShelfDialog } from "./ShelfDialog";
import { labelService } from "@/services/labelService";
import { shelfService } from "@/services/shelfService";
import { libraryService } from "@/services/LibraryService";
import { saveStoredBooks } from "@/services/bookPersistence";

interface BookHeroProps {
  book: Book;
}

export function BookHero({ book }: BookHeroProps) {
  const [currentBook, setCurrentBook] = useState(book);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showShelfDialog, setShowShelfDialog] = useState(false);

  useEffect(() => {
    const loadData = () => {
      const books = libraryService.getBooks();
      const updatedBook = books.find(b => b.id === book.id);
      if (updatedBook) {
        setCurrentBook(updatedBook);
        setLabels(labelService.getLabels());
        setShelves(shelfService.getShelves());
      }
    };

    loadData();
    const unsubscribeLabel = labelService.subscribe(loadData);
    const unsubscribeShelf = shelfService.subscribe(loadData);
    const unsubscribeBooks = libraryService.subscribe(loadData);
    return () => {
      unsubscribeLabel();
      unsubscribeShelf();
      unsubscribeBooks();
    };
  }, [book.id]);

  const bookLabels = labels.filter(l => currentBook.labelIds.includes(l.id));
  const currentShelf = shelves.find(s => s.id === currentBook.shelfId);

  const handleShelfChange = async (shelfId: string | null) => {
    const books = libraryService.getBooks();
    const updatedBooks = books.map(b =>
      b.id === currentBook.id ? { ...b, shelfId } : b
    );
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
    libraryService.notifyListeners();
  };

  const handleAddLabel = async (labelId: string) => {
    if (currentBook.labelIds.includes(labelId)) return;

    const books = libraryService.getBooks();
    const updatedBooks = books.map(b =>
      b.id === currentBook.id ? { ...b, labelIds: [...b.labelIds, labelId] } : b
    );
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
    libraryService.notifyListeners();
  };

  const handleRemoveLabel = async (labelId: string) => {
    const books = libraryService.getBooks();
    const updatedBooks = books.map(b =>
      b.id === currentBook.id ? { ...b, labelIds: b.labelIds.filter(id => id !== labelId) } : b
    );
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
    libraryService.notifyListeners();
  };

  return (
    <>
      <div className="flex flex-col items-center px-6 pt-6 pb-4">
        {/* Cover with drop shadow */}
        <div className="relative w-48 md:w-56 rounded-lg overflow-hidden shadow-2xl shadow-foreground/20">
          <div className="relative" style={{ paddingBottom: "150%" }}>
            {currentBook.coverImage ? (
              <img
                src={currentBook.coverImage}
                alt={titleCase(currentBook.title)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-primary/60" />
              </div>
            )}
          </div>
        </div>

        {/* Title and Author */}
        <div className="mt-6 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {titleCase(currentBook.title)}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            by {currentBook.author}
          </p>

          {/* Labels and Shelf Row */}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            {/* Shelf button */}
            <button
              onClick={() => setShowShelfDialog(true)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              {currentShelf?.name || 'No Shelf'}
              <ChevronDown className="h-3 w-3" />
            </button>

            {/* Label pills */}
            {bookLabels.map(label => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: `${label.color}20`, color: label.color }}
              >
                {label.name}
              </span>
            ))}

            {/* Add Label button */}
            <button
              onClick={() => setShowLabelDialog(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
            >
              <Plus className="h-3 w-3" />
              Add Label
            </button>
          </div>
        </div>
      </div>

      <AddLabelDialog
        isOpen={showLabelDialog}
        bookLabelIds={currentBook.labelIds}
        onAddLabel={handleAddLabel}
        onRemoveLabel={handleRemoveLabel}
        onClose={() => setShowLabelDialog(false)}
      />

      <ShelfDialog
        isOpen={showShelfDialog}
        currentShelfId={currentBook.shelfId}
        onSelectShelf={handleShelfChange}
        onClose={() => setShowShelfDialog(false)}
      />
    </>
  );
}