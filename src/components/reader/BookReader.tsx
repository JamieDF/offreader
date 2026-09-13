import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import 'foliate-js/view.js';
import { Overlayer } from 'foliate-js/overlayer.js';
import { fileStorage } from '@/services/fileStorage';
import { storageService } from '@/services/storage';
import { libraryService } from '@/services/LibraryService';
import { saveStoredBooks } from '@/services/bookPersistence';
import { titleCase } from '@/utils/titleCase';
import { buildReaderStylesheet } from '@/utils/readerStyles';
import ReaderOverlay, { ReaderOverlayHandle, LocationInfo } from './ReaderOverlay';
import { PdfZoom } from './PdfZoomToolbar';
import { searchService, TocMapping } from '@/services/searchService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chapter, Book, SearchResult } from '@/types/book';
import { useBookTracker, Bookmark } from '@/hooks/useBookTracker';
import { useReaderSettings } from '@/hooks/useReaderSettings';
import { useReadingStats } from '@/hooks/useReadingStats';
import { useReadingSession } from '@/hooks/useReadingSession';

interface BookReaderProps {
  bookId: string;
  book: Book;
  updateLibraryProgress: (bookId: string, progress: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTocItems(toc: any[], depth = 0, counter = { n: 0 }, isComic = false): Chapter[] {
  const result: Chapter[] = [];
  for (const item of toc) {
    const index = counter.n++;
    result.push({
      label: isComic ? `Page ${index + 1}` : (item.label || item.title || `Chapter ${index + 1}`),
      href: item.href || '',
      cfi: item.cfi || '',
      index,
      depth,
    });
    if (Array.isArray(item.subitems) && item.subitems.length > 0) {
      result.push(...mapTocItems(item.subitems, depth + 1, counter, isComic));
    }
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveLocation(detail: any): string | null {
  if (detail.cfi) return detail.cfi;
  if (detail.location?.cfi) return detail.location.cfi;
  if (detail.location?.href) return detail.location.href;
  return null;
}

function showSingleTapHint() {
  const hint = document.createElement('div');
  hint.textContent = 'Tap to toggle menu';
  hint.style.cssText = `
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8); color: white;
    padding: 12px 20px; border-radius: 8px;
    font-size: 14px; z-index: 1000;
    pointer-events: none; opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(hint);
  setTimeout(() => hint.style.opacity = '1', 100);
  setTimeout(() => {
    hint.style.opacity = '0';
    setTimeout(() => document.body.removeChild(hint), 300);
  }, 2000);
}

const BookReader = ({ bookId: propBookId, book, updateLibraryProgress }: BookReaderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayerRef = useRef<any>(null);
  const overlayRef = useRef<ReaderOverlayHandle>(null);
  const rendererPagesRef = useRef({ currentPage: 1, totalPages: 1 });
  const navigationInProgressRef = useRef(false);
  const isInitializedRef = useRef(false);
  const chaptersRef = useRef<Chapter[]>([]);

  const currentSectionIndexRef = useRef(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfZoom, setPdfZoom] = useState<PdfZoom>('fit-page');
  const [pdfRotation, setPdfRotation] = useState(0);
  const [bookTitle, setBookTitle] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lastKnownLocation, setLastKnownLocation] = useState('');
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    current: 1, total: 1, currentChapter: 1, totalChapters: 1,
    fraction: 0, currentPage: 1, totalPagesInChapter: 1,
  });
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const { addSession } = useReadingStats();
  const { updateProgress, updateLocation, addBookmark, removeBookmark, getBookmarks } = useBookTracker(propBookId);
  const { settings, isLoaded } = useReaderSettings();

  const extensionForFormat = (format?: Book['format']): string => {
    switch (format) {
      case 'PDF': return '.pdf';
      case 'MOBI': return '.mobi';
      case 'AZW3': return '.azw3';
      case 'FB2': return '.fb2';
      case 'CBZ': return '.cbz';
      default: return '.epub';
    }
  };

  // Stable ref for settings — lets initReader use current settings without being a dep
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Stable ref for updateLibraryProgress — prop may change identity on parent re-renders
  const updateLibraryProgressRef = useRef(updateLibraryProgress);
  useEffect(() => { updateLibraryProgressRef.current = updateLibraryProgress; }, [updateLibraryProgress]);

  const { commitSession } = useReadingSession({
    bookId: propBookId,
    addSession,
    currentProgress: locationInfo.fraction,
    currentLocation: lastKnownLocation,
  });

  const handleAddBookmark = useCallback(() => {
    if (!viewRef.current || !propBookId) return;
    const chapterTitle = locationInfo.currentChapterLabel || `Chapter ${locationInfo.currentChapter}`;
    const currentLocation = lastKnownLocation
      || viewRef.current.location?.cfi
      || viewRef.current.location?.href
      || '';

    if (currentLocation) {
      addBookmark(currentLocation, chapterTitle, locationInfo.fraction);
      toast.success(`Bookmark saved in "${chapterTitle}"`);
    } else {
      toast.error('Could not save bookmark. Please try navigating to a different page first.');
    }
  }, [propBookId, chapters, locationInfo, addBookmark, lastKnownLocation]);

  const handleBookmarkSelect = useCallback(async (bookmark: Bookmark) => {
    try {
      await viewRef.current?.goTo(bookmark.location);
    } catch (err) {
      console.error('Failed to navigate to bookmark:', err);
    }
  }, []);

  const handleBookmarkDelete = useCallback((bookmarkId: string) => {
    removeBookmark(bookmarkId);
    toast.success('Bookmark deleted');
  }, [removeBookmark]);

  const handleChapterSelect = useCallback(async (chapter: Chapter) => {
    try {
      const location = chapter.cfi || chapter.href;
      if (location) await viewRef.current?.goTo(location);
    } catch (err) {
      console.error('Failed to navigate to chapter:', err);
    }
  }, []);

  const handlePrev = async () => {
    if (navigationInProgressRef.current) return;
    navigationInProgressRef.current = true;
    try { await viewRef.current?.prev(); } catch (err) { console.error('Failed to go to previous page:', err); }
    finally { navigationInProgressRef.current = false; }
  };

  const handleNext = async () => {
    if (navigationInProgressRef.current) return;
    navigationInProgressRef.current = true;
    try { await viewRef.current?.next(); } catch (err) { console.error('Failed to go to next page:', err); }
    finally { navigationInProgressRef.current = false; }
  };

  const handleRotationChange = useCallback((rotation: number) => {
    setPdfRotation(rotation);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewRef.current?.book as any)?.setRotation(rotation);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewRef.current?.renderer as any)?.reload?.();
  }, []);

  const handleZoomChange = useCallback((zoom: PdfZoom) => {
    setPdfZoom(zoom);
    if (viewRef.current?.renderer) {
      viewRef.current.renderer.setAttribute('zoom', String(zoom));
    }
  }, []);

  const handleBack = useCallback(() => {
    commitSession();
    navigate('/');
  }, [navigate, commitSession]);

  const initReader = useCallback(async () => {
    if (isInitializedRef.current || !containerRef.current || !isLoaded) return;

    try {
      if (!book || book.id !== propBookId) {
        setError(`Book with ID ${propBookId} not found`);
        setIsLoading(false);
        return;
      }

      setBookTitle(titleCase(book.title));
      containerRef.current.innerHTML = '';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view = document.createElement('foliate-view') as any;
      viewRef.current = view;
      view.style.cssText = 'width:100%;height:100%;display:block;';
      containerRef.current.appendChild(view);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view.addEventListener('relocate', (event: any) => {
        const detail = event.detail;
        const flatChapters = chaptersRef.current;
        const totalChapters = flatChapters.length || 1;
        let currentChapterIndex = 0;

        const comicRendererIndex = book.format === 'CBZ'
          ? view.renderer?.index
          : undefined;
        if (typeof comicRendererIndex === 'number') {
          currentChapterIndex = comicRendererIndex;
        } else if (detail.tocItem?.label) {
          const idx = flatChapters.findIndex(c => c.label === detail.tocItem.label);
          if (idx !== -1) currentChapterIndex = idx;
        }

        const progressPercentage = Math.round((detail.fraction || 0) * 100);
        const comicPage = book.format === 'CBZ'
          ? currentChapterIndex + 1
          : rendererPagesRef.current.currentPage;
        const comicTotalPages = book.format === 'CBZ'
          ? Math.max(1, flatChapters.length)
          : rendererPagesRef.current.totalPages;
        const currentChapterLabel = book.format === 'CBZ'
          ? `Page ${comicPage}`
          : detail.tocItem?.label ?? undefined;

        setLocationInfo({
          current: progressPercentage,
          total: 100,
          currentChapter: currentChapterIndex + 1,
          totalChapters: Math.max(1, totalChapters),
          fraction: progressPercentage,
          currentPage: comicPage,
          totalPagesInChapter: comicTotalPages,
          currentChapterLabel,
        });

        updateProgress(progressPercentage, currentChapterIndex, currentChapterLabel, comicPage, comicTotalPages);
        updateLibraryProgressRef.current(propBookId, progressPercentage);

        const location = resolveLocation(detail);
        if (location) {
          updateLocation(location);
          setLastKnownLocation(location);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      view.addEventListener('create-overlayer', (event: any) => {
        const { doc, attach } = event.detail as { doc: Document; attach: (o: Overlayer) => void };
        const overlayer = new Overlayer(doc);
        overlayerRef.current = overlayer;
        attach(overlayer);
      });

      // Re-runs per section load — tap listeners must be re-attached each time
      view.addEventListener('load', (e: Event) => {
        const { doc } = (e as CustomEvent<{ doc: Document }>).detail;
        let t0 = 0;
        let x0 = 0;
        let y0 = 0;
        let moved = false;
        let pinched = false;
        let startedAtLeft = true;
        let startedAtRight = true;
        const isTap = (t: number) => t - t0 < 200 && !moved;

        doc.addEventListener('touchstart', (ev: Event) => {
          const te = ev as TouchEvent;
          t0 = te.timeStamp;
          x0 = te.changedTouches[0].screenX;
          y0 = te.changedTouches[0].screenY;
          moved = false;
          pinched = te.touches.length > 1;
          const renderer = viewRef.current?.renderer;
          const edge = renderer?.scrollEdge ?? { atLeft: true, atRight: true };
          startedAtLeft = edge.atLeft;
          startedAtRight = edge.atRight;
        }, { capture: true, passive: false });

        doc.addEventListener('touchmove', (ev: Event) => {
          const te = ev as TouchEvent;
          if (te.touches.length > 1) { pinched = true; return; }
          const d = Math.hypot(te.changedTouches[0].screenX - x0, te.changedTouches[0].screenY - y0);
          if (d > 10) moved = true;
        }, { capture: true, passive: false });

        doc.addEventListener('touchend', (ev: Event) => {
          const te = ev as TouchEvent;
          if (isTap(te.timeStamp)) {
            overlayRef.current?.toggle();
            ev.preventDefault();
            ev.stopPropagation();
          } else if (book.format === 'PDF' && moved && !pinched) {
            const touch = te.changedTouches[0];
            const dx = touch.screenX - x0;
            const dy = touch.screenY - y0;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
              if (dx < 0 && startedAtRight) viewRef.current?.next();
              else if (dx > 0 && startedAtLeft) viewRef.current?.prev();
            }
          }
        }, { capture: true, passive: false });

        doc.addEventListener('mousedown', (ev: MouseEvent) => {
          t0 = ev.timeStamp; x0 = ev.screenX; y0 = ev.screenY; moved = false;
        }, { capture: true });

        doc.addEventListener('mousemove', (ev: MouseEvent) => {
          if (Math.hypot(ev.screenX - x0, ev.screenY - y0) > 10) moved = true;
        }, { capture: true });

        doc.addEventListener('mouseup', (ev: MouseEvent) => {
          if (isTap(ev.timeStamp)) { overlayRef.current?.toggle(); ev.preventDefault(); ev.stopPropagation(); }
        }, { capture: true });
      });

      if (!localStorage.getItem('epub-single-tap-hint-shown')) {
        setTimeout(showSingleTapHint, 1000);
        localStorage.setItem('epub-single-tap-hint-shown', 'true');
      }

      const fileUrl = await fileStorage.retrieveFile(book.id, book.format);
      const fileResponse = await fetch(fileUrl);
      if (!fileResponse.ok) throw new Error(`Failed to fetch stored book: ${fileResponse.status}`);
      const fileBlob = await fileResponse.blob();
      const readerFile = new File(
        [fileBlob],
        `${book.id}${extensionForFormat(book.format)}`,
        { type: fileBlob.type },
      );
      await view.open(readerFile);

      const toc = view.book?.toc;
      const realChapters = mapTocItems(
        Array.isArray(toc) && toc.length > 0 ? toc : [],
        0,
        { n: 0 },
        book.format === 'CBZ',
      );
      chaptersRef.current = realChapters;
      setChapters(realChapters);

      if (realChapters.length > 0) {
        const allBooks = libraryService.getBooks();
        const updatedBooks = allBooks.map(b =>
          b.id === propBookId ? { ...b, chapters: realChapters, totalChapters: realChapters.length } : b
        );
        libraryService.updateBooksSilent(updatedBooks);
        await saveStoredBooks(updatedBooks);
      }

      if (view.renderer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderer.addEventListener('relocate', (e: any) => {
          const { fraction, size, index } = e.detail;
          if (typeof index === 'number') currentSectionIndexRef.current = index;
          if (typeof size === 'number' && size > 0) {
            rendererPagesRef.current = {
              currentPage: Math.round(fraction / size) + 1,
              totalPages: Math.round(1 / size),
            };
          }
        });
        if (book.format === 'PDF') {
          view.renderer.setAttribute('zoom', 'fit-page');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          view.renderer.addEventListener('zoom', (e: any) => setPdfZoom(e.detail.scale));
        } else {
          if (typeof view.renderer.setStyles === 'function') {
            view.renderer.setStyles(buildReaderStylesheet(settingsRef.current));
          }
        }
      }

      // Restore saved location
      const initialLocation = searchParams.get('location');
      let targetLocation: string | number = initialLocation ?? 0;
      if (!initialLocation) {
        try {
          const saved = await storageService.getItem(`book-tracker-${propBookId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.currentLocation) targetLocation = parsed.currentLocation;
          }
        } catch (err) {
          console.error('Failed to load saved location:', err);
        }
      }
      await view.goTo(targetLocation);

      if (book.format !== 'CBZ' && view.book?.metadata?.title) {
        setBookTitle(view.book.metadata.title);
      }

      setIsLoading(false);
      isInitializedRef.current = true;

      // Build search index after reader is ready
      // Map section indices → ToC chapter info for correct chapter numbers in search results
      const tocMap = new Map<number, TocMapping>();
      if (view.book?.resolveHref && realChapters.length > 0) {
        for (const chapter of realChapters) {
          try {
            const resolved = await view.book.resolveHref(chapter.href || chapter.cfi);
            if (resolved?.index !== undefined) {
              tocMap.set(resolved.index, { toCIndex: chapter.index, label: chapter.label });
            }
          } catch {
            // skip unresolvable ToC entries
          }
        }
      }
      searchService.buildSearchIndex(book, view, book, tocMap);
    } catch (err) {
      console.error('Failed to initialize reader:', err);
      setError('Failed to load book. Please try again.');
      setIsLoading(false);
      isInitializedRef.current = false;
    }
  }, [propBookId, searchParams, book, isLoaded, updateProgress, updateLocation]);

  useEffect(() => {
    let mounted = true;

    const cleanup = () => {
      if (viewRef.current) {
        viewRef.current.close?.();
        viewRef.current.parentNode?.removeChild(viewRef.current);
      }
      viewRef.current = null;
      overlayerRef.current = null;
      isInitializedRef.current = false;
    };

    if (mounted) initReader();

    return () => { mounted = false; cleanup(); };
  }, [initReader]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Re-apply typography when settings change after initialization (not for PDF)
  useEffect(() => {
    if (book.format === 'PDF') return;
    const renderer = viewRef.current?.renderer;
    if (!renderer || typeof renderer.setStyles !== 'function') return;
    renderer.setStyles(buildReaderStylesheet(settings));
  }, [settings, book.format]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    const results = searchService.search(query, { bookId: book.id });
    setSearchResults(results);
  }, [book.id]);

  const handleSearchResultClick = useCallback(async (location: string) => {
    try {
      if (book.format === 'PDF' && location.startsWith('page-')) {
        const pageIndex = parseInt(location.replace('page-', ''), 10);
        await viewRef.current?.goTo(pageIndex);
      } else {
        await viewRef.current?.goTo(location);
      }
    } catch (err) {
      console.error('[BookReader] Failed to navigate:', err);
    }
  }, [book.format]);

  return (
    <div className="flex flex-col h-screen bg-background relative">
      <ReaderOverlay
        ref={overlayRef}
        bookTitle={bookTitle}
        bookId={propBookId}
        locationInfo={locationInfo}
        chapters={chapters}
        onBack={handleBack}
        onPrev={handlePrev}
        onNext={handleNext}
        isLoading={isLoading}
        hasError={!!error}
        bookmarks={getBookmarks()}
        onBookmarkSelect={handleBookmarkSelect}
        onBookmarkDelete={handleBookmarkDelete}
        onAddBookmark={handleAddBookmark}
        onChapterSelect={handleChapterSelect}
        pdfZoom={book.format === 'PDF' ? pdfZoom : undefined}
        onPdfZoomChange={handleZoomChange}
        pdfRotation={book.format === 'PDF' ? pdfRotation : undefined}
        onPdfRotationChange={handleRotationChange}
        isPdf={book.format === 'PDF'}
        onSearch={handleSearch}
        searchResults={searchResults}
        searchQuery={searchQuery}
        onSearchResultClick={handleSearchResultClick}
      />

      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="reader-container absolute inset-0" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
            <div className="flex flex-col items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/')} className="absolute top-4 left-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading book...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
            <div className="text-center p-8">
              <Button variant="outline" onClick={() => navigate('/')} className="absolute top-4 left-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <p className="text-destructive font-medium mb-2">Error loading book</p>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookReader;
