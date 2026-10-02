import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Book } from "@/types/book";
import { Label } from "@/types/book";
import { useLibrary } from "@/hooks/useLibrary";
import { labelService } from "@/services/labelService";
import { shelfService } from "@/services/shelfService";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { saveStoredBooks } from "@/services/bookPersistence";
import { BookCard } from "./BookCard";
import { LibraryHeader } from "./LibraryHeader";
import { FilterToolbar } from "./FilterToolbar";
import { EmptyState } from "./EmptyState";
import { FloatingActionButton } from "./FloatingActionButton";
import { ResumeHero } from "./ResumeHero";
import { ThemeSettingsDialog } from "./ThemeSettingsDialog";
import { ReadingInsights } from "./ReadingInsights";
import { ManageLibraryDialog } from "./ManageLibraryDialog";
import { PostImportDialog } from "./PostImportDialog";
import { SelectionActionBar } from "./SelectionActionBar";
import { BulkLabelsDialog } from "./BulkLabelsDialog";
import { ImportModeDialog } from "./ImportModeDialog";
import { getImportMode, ImportMode } from "@/utils/importMode";
import { getSyncFolders, scanFolder, syncAllFolders, supportsFolderSync } from "@/services/folderSync";
import { ShelfDialog } from "@/components/book-details/ShelfDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";

interface LibraryViewProps {
  onBookSelect: (book: Book) => void;
}

/**
 * Builds the fake Book used by the onboarding tour's demo steps (3 + 4).
 * Lives in module scope because it has no instance state. The tour applies
 * the user's selected shelf/label to this book for step 4.
 */
function makeDemoBook(): Book {
  return {
    id: 'tour-demo-book',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    coverImage: '',
    filePath: '',
    format: 'EPUB',
    progress: 0,
    description: 'A classic novel of manners.',
    totalChapters: 61,
    pageCount: 432,
    estimatedReadingTime: '11h 30m',
    publisher: 'T. Egerton',
    pubDate: '1813',
    language: 'en',
    shelfId: null,
    labelIds: [],
  };
}

export function LibraryView({ onBookSelect }: LibraryViewProps) {
  const navigate = useNavigate();
  const {
    books,
    lastReadBook,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    importBooks,
    importBookPaths,
    isEmpty,
    filters,
    setFilter,
    clearFilters,
    activeFilterCount,
    removeBooks,
    assignBooksToShelf,
    applyLabelChanges,
    moveBooksToLibrary,
  } = useLibrary();
  const {
    isOpen: tourOpen,
    demoState,
    startDemoImport,
    applyDemoImport,
    endDemo,
  } = useOnboardingTour();

  const [labels, setLabels] = useState<Label[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isManageLibraryOpen, setIsManageLibraryOpen] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedBooks, setImportedBooks] = useState<Book[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkShelfOpen, setBulkShelfOpen] = useState(false);
  const [bulkLabelsOpen, setBulkLabelsOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importModeOpen, setImportModeOpen] = useState(false);
  const [defaultImportMode, setDefaultImportMode] = useState<ImportMode>('linked');

  // Folder sync: re-scan configured folders once the library has loaded.
  // Desktop registers watchers + rescan-on-change; Android rescans SAF trees
  // on open (SAF has no watch primitive). Deferred until init completes , 
  // scanning with an empty library would re-import everything as new.
  useEffect(() => {
    if (!supportsFolderSync()) return;
    const files = window.offreaderFiles;

    const importOpened = async () => {
      const pending = (await files?.takePendingFiles()) ?? [];
      if (pending.length > 0) {
        await importBookPaths(pending, await getImportMode(), onImported);
      }
    };

    let started = false;
    const start = async () => {
      if (started || libraryService.getIsLoading()) return;
      started = true;
      const folders = await getSyncFolders();
      await Promise.all(folders.map(f => files?.watchFolder(f)));
      // "Open with" files queued before the renderer was ready
      await importOpened();
      await syncAllFolders();
    };

    start();
    const unsubInit = libraryService.subscribe(start);
    const unsubChanged = files?.onFolderChanged((dirPath) => {
      scanFolder(dirPath);
    });
    // Files opened while running (second instance / macOS open-file)
    const unsubOpened = files?.onFilesOpened(importOpened);
    return () => {
      unsubInit();
      unsubChanged?.();
      unsubOpened?.();
    };
  }, [importBookPaths]);

  useEffect(() => {
    const loadLabels = () => {
      setLabels(labelService.getLabels());
    };

    loadLabels();
    const unsubscribe = labelService.subscribe(loadLabels);
    return unsubscribe;
  }, []);

  // When the tour demo card step is active, render the fake book alongside
  // (or instead of) real books so the spotlight anchor exists.
  const demoBook = useMemo<Book | null>(() => {
    if (!demoState.bookCardVisible) return null;
    const base = makeDemoBook();
    return {
      ...base,
      shelfId: demoState.selectedShelfId,
      labelIds: demoState.selectedLabelIds,
    };
  }, [demoState.bookCardVisible, demoState.selectedShelfId, demoState.selectedLabelIds]);

  // Treat the library as non-empty while the demo card is on screen so the
  // EmptyState doesn't render behind the spotlight.
  const showEmptyState = isEmpty && !demoState.bookCardVisible;

  // --- Multi-select -----------------------------------------------------------

  const selectedBooks = useMemo(
    () => books.filter((b) => selectedIds.has(b.id)),
    [books, selectedIds],
  );
  const allVisibleSelected = books.length > 0 && selectedBooks.length === books.length;

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleBookSelected = (bookId: string) => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(books.map((b) => b.id)));
    }
  };

  const handleCardSelect = (book: Book, e?: React.MouseEvent) => {
    if (selectionMode) {
      toggleBookSelected(book.id);
      return;
    }
    // Ctrl/Cmd+click enters selection mode without leaving the keyboard
    if (e && (e.ctrlKey || e.metaKey)) {
      toggleBookSelected(book.id);
      return;
    }
    onBookSelect(book);
  };

  useEffect(() => {
    if (!selectionMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitSelectionMode();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(books.map((b) => b.id)));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectionMode, books]);

  const handleBulkShelf = async (shelfId: string | null) => {
    const count = selectedIds.size;
    await assignBooksToShelf([...selectedIds], shelfId);
    toast.success(`Updated shelf for ${count} book${count === 1 ? '' : 's'}`);
  };

  const handleBulkLabels = async (addLabelIds: Set<string>, removeLabelIds: Set<string>) => {
    const count = selectedIds.size;
    await applyLabelChanges([...selectedIds], addLabelIds, removeLabelIds);
    setBulkLabelsOpen(false);
    toast.success(`Updated labels on ${count} book${count === 1 ? '' : 's'}`);
  };

  const handleMoveToLibrary = async () => {
    const moved = await moveBooksToLibrary([...selectedIds]);
    if (moved > 0) {
      toast.success(`Copied ${moved} book${moved === 1 ? '' : 's'} into library storage`);
      exitSelectionMode();
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    setBulkDeleteOpen(false);
    exitSelectionMode();
    await removeBooks([...selectedIds]);
    toast.success(`Deleted ${count} book${count === 1 ? '' : 's'}`);
  };

  const onImported = (books: Book[]) => {
    setImportedBooks(books);
    setShowImportDialog(true);
  };

  const handleRealImport = () => {
    // Desktop uses the native picker so files can be linked in place;
    // the mode dialog defaults to the configured setting.
    if (window.offreaderFiles) {
      getImportMode().then(setDefaultImportMode);
      setImportModeOpen(true);
      return;
    }
    importBooks(onImported);
  };

  const handleImportModeChosen = async (mode: ImportMode) => {
    setImportModeOpen(false);
    const paths = await window.offreaderFiles?.pickBookFiles();
    if (!paths?.length) return;
    await importBookPaths(paths, mode, onImported);
  };

  // FAB / EmptyState click handler. During the tour, route the click into
  // the demo flow instead of opening the OS file picker: driver.js's
  // overlay would otherwise block user gestures anyway.
  const handleImportClick = () => {
    if (tourOpen) {
      startDemoImport();
    } else {
      handleRealImport();
    }
  };

  const handleApplyImportLabels = async (
    shelfId: string | null,
    labelIds: string[],
    metadataUpdates?: { title: string; author: string; description: string },
  ) => {
    if (importedBooks.length === 0) return;

    const allBooks = libraryService.getBooks();
    const updatedBooks = allBooks.map((book) => {
      const isImported = importedBooks.some((b) => b.id === book.id);
      if (isImported) {
        return {
          ...book,
          shelfId,
          labelIds,
          ...(metadataUpdates ? metadataUpdates : {}),
        };
      }
      return book;
    });

    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
    await shelfService.setLastUsedShelf(shelfId);

    setShowImportDialog(false);
    setImportedBooks([]);
    toast.success(`Applied to ${importedBooks.length} book${importedBooks.length > 1 ? 's' : ''}`);
  };

  const handleResume = async (book: Book) => {
    try {
      const trackerDataString = await storageService.getItem('book-tracker-data');

      if (trackerDataString) {
        const allTrackerData = JSON.parse(trackerDataString);
        const bookTrackerData = allTrackerData[book.id];
        const currentLocation = bookTrackerData?.currentLocation;

        const baseUrl = `/reader?bookId=${encodeURIComponent(book.id)}`;
        const resumeUrl = currentLocation
          ? `${baseUrl}&location=${encodeURIComponent(currentLocation)}`
          : baseUrl;

        navigate(resumeUrl);
      } else {
        navigate(`/reader?bookId=${encodeURIComponent(book.id)}`);
      }
    } catch (error) {
      console.error('Failed to get tracker data:', error);
      navigate(`/reader?bookId=${encodeURIComponent(book.id)}`);
    }
  };

  // While the tour is on step 3 (dialog) or step 4 (book card), open the
  // dialog with the fake book and route the confirm to the demo callback
  // instead of persisting anything.
  const showDemoDialog = demoState.dialogOpen;
  const dialogBooks = showDemoDialog ? [makeDemoBook()] : importedBooks;
  const dialogOpen = showImportDialog || showDemoDialog;
  const dialogOnConfirm = showDemoDialog
    ? (shelfId: string | null, labelIds: string[]) => applyDemoImport(shelfId, labelIds)
    : handleApplyImportLabels;
  // Closing the dialog (X button, Escape, or overlay click) clears the
  // import state or ends the tour demo, depending on which opened it.
  const dialogOnClose = () => {
    if (showDemoDialog) {
      endDemo();
    } else {
      setShowImportDialog(false);
      setImportedBooks([]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <LibraryHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInsights={() => setIsInsightsOpen(true)}
        onOpenManageLibrary={() => setIsManageLibraryOpen(true)}
        onAbout={() => navigate('/about')}
        sortBy={sortBy}
        onSortChange={setSortBy}
        mobileMenuOpen={undefined}
        onMobileMenuOpenChange={undefined}
      />

      <FilterToolbar
        filters={filters}
        onFilterChange={setFilter}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        bookCount={books.length + (demoBook ? 1 : 0)}
        selectionMode={selectionMode}
        onToggleSelectionMode={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
      />

      {/* Scrollable Content Area - only this section scrolls */}
      <main className="flex-1 overflow-y-auto overscroll-contain bg-background">
        <div className="max-w-7xl mx-auto w-full">
          {showEmptyState ? (
            <EmptyState onBrowse={handleImportClick} />
          ) : books.length === 0 && !demoBook ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 gap-4">
              <p>No books match your filters</p>
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="p-4 sm:p-6 pb-24 animate-fade-in space-y-8">
              {lastReadBook && searchQuery === "" && (
                <div className="w-full">
                  <ResumeHero book={lastReadBook} onContinue={handleResume} />
                </div>
              )}

              <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight px-1">Your Collection</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                  {books.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onSelect={handleCardSelect}
                      labels={labels}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(book.id)}
                      onToggleSelect={(b) => toggleBookSelected(b.id)}
                    />
                  ))}
                  {demoBook && (
                    <BookCard
                      key={demoBook.id}
                      book={demoBook}
                      onSelect={() => {
                        // During the tour, tapping the demo card is a
                        // no-op. The popover already explains the action.
                      }}
                      labels={labels}
                      dataTourId="demo-book-card"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectionMode ? (
        <SelectionActionBar
          selectedCount={selectedIds.size}
          linkedSelectedCount={selectedBooks.filter(b => b.source === 'linked').length}
          allVisibleSelected={allVisibleSelected}
          onToggleSelectAll={toggleSelectAllVisible}
          onAssignShelf={() => setBulkShelfOpen(true)}
          onEditLabels={() => setBulkLabelsOpen(true)}
          onMoveToLibrary={handleMoveToLibrary}
          onDelete={() => setBulkDeleteOpen(true)}
          onExit={exitSelectionMode}
        />
      ) : (
        <FloatingActionButton onClick={handleImportClick} />
      )}

      <ThemeSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <ReadingInsights
        isOpen={isInsightsOpen}
        onOpenChange={setIsInsightsOpen}
      />

      <ManageLibraryDialog
        isOpen={isManageLibraryOpen}
        onOpenChange={setIsManageLibraryOpen}
      />

      <PostImportDialog
        isOpen={dialogOpen}
        books={dialogBooks}
        onConfirm={dialogOnConfirm}
        onClose={dialogOnClose}
        dataTourMetadataId="import-dialog-metadata"
        dataTourShelfId="import-dialog-shelf"
      />

      <ShelfDialog
        isOpen={bulkShelfOpen}
        // Highlight the shared shelf only when the whole selection agrees;
        // otherwise nothing is highlighted ('' matches no shelf or Unfiled).
        currentShelfId={
          selectedBooks.every((b) => b.shelfId === selectedBooks[0]?.shelfId)
            ? (selectedBooks[0]?.shelfId ?? null)
            : ''
        }
        onSelectShelf={handleBulkShelf}
        onClose={() => setBulkShelfOpen(false)}
      />

      <BulkLabelsDialog
        isOpen={bulkLabelsOpen}
        books={selectedBooks}
        onApply={handleBulkLabels}
        onClose={() => setBulkLabelsOpen(false)}
      />

      <ImportModeDialog
        isOpen={importModeOpen}
        defaultMode={defaultImportMode}
        onChoose={handleImportModeChosen}
        onClose={() => setImportModeOpen(false)}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} book{selectedIds.size === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected books and their reading progress will be permanently removed from your library.
              {selectedBooks.some(b => b.source === 'linked') &&
                ' Books linked to files outside OffReader will only be removed from the library: the files themselves are not deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}