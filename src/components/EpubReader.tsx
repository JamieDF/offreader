import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import 'foliate-js/view.js';
import { Overlayer } from 'foliate-js/overlayer.js';
import { fileStorage } from "@/services/fileStorage";
import { titleCase } from "@/utils/titleCase";
import ReaderHeader from "./ReaderHeader";
import ReaderFooter from "./ReaderFooter";
import SideNavigation from "./reader/SideNavigation";
import ChapterProgress from "./reader/ChapterProgress";
import SettingsDrawer from "./reader/SettingsDrawer";
import TocDrawer from "./reader/TocDrawer";
import { BookmarksDrawer } from "./reader/BookmarksDrawer";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Chapter } from "@/types/book";
import { Book } from "@/types/book";
import { useBookTracker, Bookmark } from "@/hooks/useBookTracker";
import { storageService } from "@/services/storage";
import { useReaderSettings } from "@/contexts/ReaderSettingsContext";
import { useReadingStats } from "@/hooks/useReadingStats";

interface EpubReaderProps {
  bookId: string;
  book: Book; // Pass the book directly instead of fetching from library
  updateLibraryProgress: (bookId: string, progress: number) => void; // Pass progress update function
}

interface LocationInfo {
  current: number;
  total: number;
  currentChapter: number;
  totalChapters: number;
  fraction: number;
  currentPage: number;
  totalPagesInChapter: number;
}

const EpubReader = ({ bookId: propBookId, book, updateLibraryProgress }: EpubReaderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const overlayerRef = useRef<any>(null);
  const rendererPagesRef = useRef<{ currentPage: number; totalPages: number }>({ currentPage: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>("");
  const [showOverlay, setShowOverlay] = useState(false);
  const isInitializedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lastKnownLocation, setLastKnownLocation] = useState<string>('');
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    current: 1,
    total: 1,
    currentChapter: 1,
    totalChapters: 1,
    fraction: 0,
    currentPage: 1,
    totalPagesInChapter: 1
  });
  
  // Define font family map once at component level
  const fontFamilyMap: Record<string, string> = {
    'Georgia': 'Georgia, "Times New Roman", serif',
    'Playfair Display': '"Playfair Display", "Crimson Text", Georgia, serif',
    'JetBrains Mono': '"JetBrains Mono", "Courier New", monospace',
    'Fira Code': '"Syne Mono", "Space Mono", "Courier New", monospace',
    'Uncial Antiqua': '"Uncial Antiqua", "Cinzel", "Merriweather", serif',
    'Special Elite': '"Special Elite", "Courier Prime", "Courier New", monospace',
    'Lato': '"Lato", "Helvetica Neue", Arial, sans-serif',
    'Montserrat': '"Montserrat", "Helvetica Neue", Arial, sans-serif',
    'Source Sans Pro': '"Source Sans Pro", "Helvetica Neue", Arial, sans-serif'
  };

  // Reading Session Tracking State
  const { addSession } = useReadingStats();
  const sessionStartRef = useRef<Date | null>(null);
  const lastInteractionRef = useRef<Date>(new Date());
  const isActiveRef = useRef<boolean>(true);
  const accumulatedTimeRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const startLocationRef = useRef<string>('');

  // Initialize book tracker with book ID (derived from file path)
  const { updateProgress, updateLocation, addBookmark, removeBookmark, getBookmarks } = useBookTracker(propBookId);
  
  // Get reader settings for typography
  const { settings, isLoaded: settingsLoaded } = useReaderSettings();

  // --- Session Tracking Logic ---
  // Use refs for location state to avoid triggering useEffect cleanups on every page turn
  const currentProgressRef = useRef(locationInfo.fraction);
  const currentLocationRef = useRef(lastKnownLocation);

  useEffect(() => {
    currentProgressRef.current = locationInfo.fraction;
  }, [locationInfo.fraction]);

  useEffect(() => {
    currentLocationRef.current = lastKnownLocation;
  }, [lastKnownLocation]);

  const commitSession = useCallback(() => {
    if (!sessionStartRef.current) return;
    
    // Calculate final duration
    let finalDuration = accumulatedTimeRef.current;
    if (isActiveRef.current) {
       finalDuration += (new Date().getTime() - sessionStartRef.current.getTime());
    }

    // Don't save sessions less than 10 seconds to avoid clutter
    if (finalDuration < 10000) {
      sessionStartRef.current = new Date();
      accumulatedTimeRef.current = 0;
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
      return;
    }

    addSession({
      id: `session-${Date.now()}`,
      bookId: propBookId,
      startTime: sessionStartRef.current.toISOString(),
      endTime: new Date().toISOString(),
      durationMs: finalDuration,
      startProgress: startProgressRef.current,
      endProgress: currentProgressRef.current,
      startLocation: startLocationRef.current,
      endLocation: currentLocationRef.current,
    });

    // Reset session tracking for next burst
    sessionStartRef.current = new Date();
    accumulatedTimeRef.current = 0;
    startProgressRef.current = currentProgressRef.current;
    startLocationRef.current = currentLocationRef.current;
  }, [addSession, propBookId]);

  // Handle user interaction to keep session alive
  const handleInteraction = useCallback(() => {
    const now = new Date();
    const idleTime = now.getTime() - lastInteractionRef.current.getTime();
    
    // If we were inactive for more than 5 minutes, commit the previous session and start a new one
    if (idleTime > 5 * 60 * 1000 && isActiveRef.current) {
      commitSession();
    } else if (!isActiveRef.current) {
      // Waking up from inactive state
      sessionStartRef.current = new Date();
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
      isActiveRef.current = true;
    }

    lastInteractionRef.current = now;
  }, [commitSession]);

  // Always keep start location and progress updated if they are 0
  useEffect(() => {
    if (startProgressRef.current === 0 && locationInfo.fraction > 0) {
      startProgressRef.current = locationInfo.fraction;
    }
    if (startLocationRef.current === '' && lastKnownLocation !== '') {
      startLocationRef.current = lastKnownLocation;
    }
  }, [locationInfo.fraction, lastKnownLocation]);

  // Set up visibility and interaction listeners
  useEffect(() => {
    // Initial setup
    if (!sessionStartRef.current) {
      sessionStartRef.current = new Date();
      lastInteractionRef.current = new Date();
      isActiveRef.current = true;
      accumulatedTimeRef.current = 0;
      startProgressRef.current = currentProgressRef.current;
      startLocationRef.current = currentLocationRef.current;
    }
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App went to background
        isActiveRef.current = false;
        commitSession();
      } else {
        // App came to foreground
        sessionStartRef.current = new Date();
        lastInteractionRef.current = new Date();
        isActiveRef.current = true;
      }
    };

    // Global interaction listeners
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    // Idle checker interval
    const idleInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      
      const now = new Date();
      const idleTime = now.getTime() - lastInteractionRef.current.getTime();
      
      if (idleTime > 5 * 60 * 1000) {
        // 5 minutes idle - pause session
        isActiveRef.current = false;
        commitSession();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      clearInterval(idleInterval);
      
      // We explicitly DO NOT commit session on unmount here because React Router 
      // unmounts/remounts rapidly during certain transitions which causes duplicate
      // or zero-duration sessions. 
      // The visibilitychange event (tab switch) and idle timeout will catch genuine session ends.
      // Additionally, the user pressing "back" to Library will trigger a route change,
      // but we will rely on a dedicated "save on back" button or the natural idle timeout
      // to avoid race conditions.
    };
  }, [handleInteraction, commitSession]);
  // --- End Session Tracking Logic ---

  const toggleOverlay = useCallback(() => {
    setShowOverlay(prev => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleOpenToc = useCallback(() => {
    setShowToc(true);
  }, []);

  const handleOpenBookmarks = useCallback(() => {
    setShowBookmarks(true);
  }, []);

  const handleAddBookmark = useCallback(() => {
    if (!viewRef.current) {
      console.error('No view reference');
      return;
    }

    if (!propBookId) {
      console.error('No book ID set');
      return;
    }

    const view = viewRef.current;
    const currentChapter = chapters[locationInfo.currentChapter - 1];
    const chapterTitle = currentChapter?.label || `Chapter ${locationInfo.currentChapter}`;
    
    // Use last known location as primary source
    let currentLocation = lastKnownLocation;
    
    // Fallback: Try foliate's location object
    if (!currentLocation && view.location) {
      currentLocation = view.location.cfi || view.location.href || '';
    }
    
    // Fallback: Use current chapter href
    if (!currentLocation && currentChapter?.href) {
      currentLocation = currentChapter.href;
    }
    
    if (currentLocation) {
      addBookmark(currentLocation, chapterTitle, locationInfo.fraction);
      toast.success(`Bookmark saved in "${chapterTitle}"`);
    } else {
      console.error('Could not determine current location for bookmark');
      toast.error('Could not save bookmark. Please try navigating to a different page first.');
    }
  }, [propBookId, chapters, locationInfo, addBookmark, lastKnownLocation]);

  const handleBookmarkSelect = useCallback(async (bookmark: Bookmark) => {
    try {
      if (!viewRef.current) {
        console.error('No view reference available');
        return;
      }
      
      await viewRef.current.goTo(bookmark.location);
      setShowBookmarks(false);
    } catch (err) {
      console.error("Failed to navigate to bookmark:", err);
    }
  }, []);

  const handleBookmarkDelete = useCallback((bookmarkId: string) => {
    removeBookmark(bookmarkId);
    toast.success('Bookmark deleted');
  }, [removeBookmark]);

  const handleChapterSelect = useCallback(async (chapter: Chapter) => {
    try {
      const view = viewRef.current;
      if (!view) return;

      // Navigate to chapter using href or CFI
      const location = chapter.cfi || chapter.href;
      if (location) {
        await view.goTo(location);
      }
    } catch (err) {
      console.error("Failed to navigate to chapter:", err);
    }
  }, []);

  const initReader = useCallback(async () => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      return;
    }
    
    if (!containerRef.current) {
      isInitializedRef.current = false; // Reset if we can't initialize
      return;
    }

    try {
      // Use the passed book prop instead of searching in library
      if (!book || book.id !== propBookId) {
        setError(`Book with ID ${propBookId} not found`);
        setIsLoading(false);
        isInitializedRef.current = false; // Reset on error
        return;
      }

      setBookTitle(titleCase(book.title));
      
      // Clear any existing content in container
      containerRef.current.innerHTML = '';
      
      // Create foliate view element (custom element is now registered)
      const view = document.createElement('foliate-view') as any;
      viewRef.current = view;
      
      // Ensure the view has proper dimensions
      view.style.width = '100%';
      view.style.height = '100%';
      view.style.display = 'block';
      
      containerRef.current.appendChild(view);

      // Set up event listener for progress tracking
      view.addEventListener('relocate', (event: any) => {
        const detail = event.detail;
        
        // Calculate progress percentage and chapter info
        const totalChapters = view.book.toc?.length || 1; // Use actual TOC length
        
        // Try to determine current chapter from TOC using location
        let currentChapterIndex = 0;
        if (detail.tocItem && detail.tocItem.label) {
          // Find the chapter in the TOC that matches the current location
          const currentChapterLabel = detail.tocItem.label;
          const tocChapter = view.book.toc?.findIndex((item: any) => item.label === currentChapterLabel);
          if (tocChapter !== -1) {
            currentChapterIndex = tocChapter;
          }
        }
        
        const sectionFraction = detail.fraction || 0;
        const progressPercentage = Math.round(sectionFraction * 100);

        // Page info within the current chapter (from renderer listener below)
        const currentPage = rendererPagesRef.current.currentPage;
        const totalPagesInChapter = rendererPagesRef.current.totalPages;

        const newLocationInfo: LocationInfo = {
          current: progressPercentage, // Use progress percentage as "current"
          total: 100, // Show as percentage out of 100
          currentChapter: currentChapterIndex + 1,
          totalChapters: Math.max(1, totalChapters),
          fraction: progressPercentage,
          currentPage,
          totalPagesInChapter,
        };

        setLocationInfo(newLocationInfo);

        // Save progress and location to tracker using propBookId
        if (propBookId) {
          const progressPercentage = newLocationInfo.fraction; // Already a percentage (0-100)

          // Update both progress systems
          updateProgress(progressPercentage, currentChapterIndex, currentPage, totalPagesInChapter); // Update useBookTracker
          updateLibraryProgress(propBookId, progressPercentage); // Update library progress
          
          // Save CFI location if available
          if (detail.cfi) {
            updateLocation(detail.cfi);
            setLastKnownLocation(detail.cfi);
          } else {
            // Try alternative location sources
            if (detail.location?.cfi) {
              updateLocation(detail.location.cfi);
              setLastKnownLocation(detail.location.cfi);
            } else if (detail.location?.href) {
              updateLocation(detail.location.href);
              setLastKnownLocation(detail.location.href);
            }
          }
        }
      });
      
      // Set up event listener for overlay creation
      view.addEventListener('create-overlayer', (event: any) => {
        const { doc, index, attach } = event.detail;
        
        // Create overlay using foliate's Overlayer class
        const overlayer = new Overlayer(doc);
        overlayerRef.current = overlayer;
        
        // Attach the overlay to the page
        attach(overlayer);
      });
      
      // Wait for the view to load and then hijack touch events
      view.addEventListener('load', ({ detail: { doc } }) => {
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let hasMoved = false;
        
        // Add touch event listeners to the document inside foliate
        const handleTouchStart = (e: Event) => {
          const touchEvent = e as TouchEvent;
          touchStartTime = touchEvent.timeStamp;
          touchStartX = touchEvent.changedTouches[0].screenX;
          touchStartY = touchEvent.changedTouches[0].screenY;
          hasMoved = false;
        };
        
        const handleTouchMove = (e: Event) => {
          const touchEvent = e as TouchEvent;
          const touch = touchEvent.changedTouches[0];
          const distance = Math.sqrt(
            Math.pow(touch.screenX - touchStartX, 2) + 
            Math.pow(touch.screenY - touchStartY, 2)
          );
          if (distance > 10) {
            hasMoved = true;
          }
        };
        
        const handleTouchEnd = (e: Event) => {
          const touchEvent = e as TouchEvent;
          const touchDuration = touchEvent.timeStamp - touchStartTime;
          
          // Check if it's a tap (short duration, small distance, no movement)
          if (touchDuration < 200 && !hasMoved) {
            toggleOverlay();
            e.preventDefault();
            e.stopPropagation();
          }
        };
        
        // Add our listeners with capture to intercept before foliate
        doc.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
        doc.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        doc.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        
        // Also handle mouse events for desktop
        doc.addEventListener('mousedown', (e: MouseEvent) => {
          touchStartTime = e.timeStamp;
          touchStartX = e.screenX;
          touchStartY = e.screenY;
          hasMoved = false;
        }, { capture: true });
        
        doc.addEventListener('mousemove', (e: MouseEvent) => {
          const distance = Math.sqrt(
            Math.pow(e.screenX - touchStartX, 2) + 
            Math.pow(e.screenY - touchStartY, 2)
          );
          if (distance > 10) {
            hasMoved = true;
          }
        }, { capture: true });
        
        doc.addEventListener('mouseup', (e: MouseEvent) => {
          const touchDuration = e.timeStamp - touchStartTime;
          
          // Check if it's a click (short duration, small distance, no movement)
          if (touchDuration < 200 && !hasMoved) {
            toggleOverlay();
            e.preventDefault();
            e.stopPropagation();
          }
        }, { capture: true });
      });
      
      // Add a one-time hint about single-tap
      const showSingleTapHint = () => {
        const hint = document.createElement('div');
        hint.textContent = 'Tap to toggle menu';
        hint.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 1000;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        `;
        document.body.appendChild(hint);
        
        // Fade in
        setTimeout(() => hint.style.opacity = '1', 100);
        
        // Fade out and remove
        setTimeout(() => {
          hint.style.opacity = '0';
          setTimeout(() => document.body.removeChild(hint), 300);
        }, 2000);
      };
      
      // Show hint on first load
      if (!localStorage.getItem('epub-single-tap-hint-shown')) {
        setTimeout(showSingleTapHint, 1000);
        localStorage.setItem('epub-single-tap-hint-shown', 'true');
      }
      
      // Get the proper file URL (blob URL for web, file URI for native)
      const fileUrl = await fileStorage.retrieveFile(book.id, book.title);

      // Wait for settings to be loaded from storage by checking if CSS properties are set
      let attempts = 0;
      const maxAttempts = 40; // 2 seconds max wait
      while (attempts < maxAttempts) {
        const fontFamilySet = document.documentElement.style.getPropertyValue('--reader-font-family');
        if (fontFamilySet) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      
      // Open the book
      await view.open(fileUrl);

      // Attach renderer-level listener for per-chapter page data.
      // The renderer's `relocate` event fires with { fraction, size } where:
      //   fraction = (page - 1) / (pages - 2) (within-section progress)
      //   size     = 1 / (pages - 2)          (one page as fraction of section)
      // This fires before the view's `relocate` event, so the ref is ready in time.
      if (view.renderer) {
        view.renderer.addEventListener('relocate', (e: any) => {
          const { fraction, size } = e.detail;
          if (typeof size === 'number' && size > 0) {
            rendererPagesRef.current = {
              currentPage: Math.round(fraction / size) + 1,
              totalPages: Math.round(1 / size),
            };
          }
        });
      }

      // Apply initial typography settings after book loads
      const applyTypographyStyles = () => {
        if (!view.renderer || typeof view.renderer.setStyles !== 'function') {
          return;
        }
        
        // Read current settings from CSS custom properties (set by useReaderSettings)
        const fontSize = document.documentElement.style.getPropertyValue('--reader-font-size') || '100%';
        const lineHeight = document.documentElement.style.getPropertyValue('--reader-line-height') || '1.6';
        const marginWidth = document.documentElement.style.getPropertyValue('--reader-margin-width') || '20%';
        const paragraphSpacing = document.documentElement.style.getPropertyValue('--reader-paragraph-spacing') || '1em';
        const fontFamilyKey = document.documentElement.style.getPropertyValue('--reader-font-family') || 'Georgia';
        
        const stylesheet = `
        /* Force font loading for remaining fonts */
        .force-georgia { font-family: "Georgia", serif !important; }
        .force-playfair { font-family: "Playfair Display", serif !important; }
        .force-jetbrains { font-family: "JetBrains Mono", monospace !important; }
        .force-fira { font-family: "Syne Mono", monospace !important; }
        .force-uncial { font-family: "Uncial Antiqua", serif !important; }
        .force-special { font-family: "Special Elite", monospace !important; }
        .force-lato { font-family: "Lato", sans-serif !important; }
        .force-montserrat { font-family: "Montserrat", sans-serif !important; }
        .force-source { font-family: "Source Sans Pro", sans-serif !important; }
        
          body {
            font-size: ${fontSize} !important;
            line-height: ${lineHeight} !important;
            font-family: ${fontFamilyMap[fontFamilyKey] || fontFamilyMap['Georgia']} !important;
            padding-left: ${marginWidth} !important;
            padding-right: ${marginWidth} !important;
          }
          
          /* Ensure fonts are applied to all text elements */
          body, p, div, span, h1, h2, h3, h4, h5, h6 {
            font-family: ${fontFamilyMap[fontFamilyKey] || fontFamilyMap['Georgia']} !important;
          }
          p {
            margin-bottom: ${paragraphSpacing} !important;
          }
        `;
        
        view.renderer.setStyles(stylesheet);
      };
      
      // Try to apply styles immediately
      applyTypographyStyles();
      
      // Check if we have a location to navigate to
      const initialLocation = searchParams.get('location');
      let targetLocation: string | null = null;

      if (initialLocation) {
        targetLocation = initialLocation;
      } else {
        // Try to get saved location from tracker
        try {
          const savedLocationString = await storageService.getItem(`book-tracker-${propBookId}`);
          if (savedLocationString) {
            const savedLocation = JSON.parse(savedLocationString);
            if (savedLocation?.currentLocation) {
              targetLocation = savedLocation.currentLocation;
            }
          }
        } catch (error) {
          console.error("Failed to load saved location:", error);
        }
      }

      // Navigate to target location if available
      if (targetLocation) {
        await view.goTo(targetLocation);
      } else {
        // Navigate to first page
        await view.goTo(0);
      }

      // Get book metadata
      const bookData = view.book;
      if (bookData?.metadata?.title) {
        setBookTitle(bookData.metadata.title);
      }
      
      // Extract Table of Contents
      if (bookData?.toc && Array.isArray(bookData.toc)) {
        const extractedChapters: Chapter[] = bookData.toc.map((item: any, index: number) => ({
          label: item.label || item.title || `Chapter ${index + 1}`,
          href: item.href || '',
          cfi: item.cfi || '',
          index: index
        }));
        setChapters(extractedChapters);
      } else {
        // Fallback: use view.book.toc if bookData.toc is not available
        const viewToc = view.book.toc || [];
        const fallbackChapters: Chapter[] = viewToc.map((item: any, index: number) => ({
          label: item.label || item.title || `Chapter ${index + 1}`,
          href: item.href || '',
          cfi: item.cfi || '',
          index: index
        }));
        setChapters(fallbackChapters);
      }

      setIsLoading(false);
      isInitializedRef.current = true;
    } catch (err) {
      console.error("Failed to initialize reader:", err);
      setError("Failed to load book. Please try again.");
      setIsLoading(false);
      isInitializedRef.current = false; // Reset on error
    }
  }, [propBookId, searchParams, updateProgress, updateLocation, book]);

  useEffect(() => {
    let mounted = true;
    
    const cleanup = () => {
      if (viewRef.current && viewRef.current.parentNode && mounted) {
        viewRef.current.parentNode.removeChild(viewRef.current);
      }
      viewRef.current = null;
      overlayerRef.current = null;
      isInitializedRef.current = false;
    };
    
    if (mounted) {
      initReader();
    }
    
    return () => {
      mounted = false;
      cleanup();
    };
  }, [initReader]);

  // Apply typography settings to foliate-view when settings change
  useEffect(() => {
    const applyStyles = () => {
      if (!viewRef.current) {
        return;
      }

      const view = viewRef.current;

      if (!view.renderer || typeof view.renderer.setStyles !== 'function') {
        return;
      }
      
      // Get current settings from CSS custom properties (set by useReaderSettings)
      const fontSize = document.documentElement.style.getPropertyValue('--reader-font-size') || '100%';
      const lineHeight = document.documentElement.style.getPropertyValue('--reader-line-height') || '1.6';
      const marginWidth = document.documentElement.style.getPropertyValue('--reader-margin-width') || '20%';
      const paragraphSpacing = document.documentElement.style.getPropertyValue('--reader-paragraph-spacing') || '1em';
      const fontFamilyKey = document.documentElement.style.getPropertyValue('--reader-font-family') || 'Georgia';
      
      const fontFamily = fontFamilyMap[fontFamilyKey] || fontFamilyMap['Georgia'];

      // Create CSS stylesheet string for foliate-js
      const stylesheet = `
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Uncial+Antiqua&family=Cinzel:wght@400;600&family=Special+Elite&family=Courier+Prime:wght@400;700&family=Space+Mono:wght@400;700&family=Roboto+Mono:wght@400;500&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;700&family=Crimson+Text:wght@400;600&family=JetBrains+Mono:wght@400;500&family=IBM+Plex+Mono:wght@400;500&family=Old+Standard+TT:wght@400;700&display=swap');
        
        /* Force font loading for remaining fonts */
        .force-georgia { font-family: "Georgia", serif !important; }
        .force-playfair { font-family: "Playfair Display", serif !important; }
        .force-jetbrains { font-family: "JetBrains Mono", monospace !important; }
        .force-fira { font-family: "Syne Mono", monospace !important; }
        .force-uncial { font-family: "Uncial Antiqua", serif !important; }
        .force-special { font-family: "Special Elite", monospace !important; }
        .force-lato { font-family: "Lato", sans-serif !important; }
        .force-montserrat { font-family: "Montserrat", sans-serif !important; }
        .force-source { font-family: "Source Sans Pro", sans-serif !important; }
        
        body {
          font-size: ${fontSize} !important;
          line-height: ${lineHeight} !important;
          font-family: ${fontFamily} !important;
          padding-left: ${marginWidth} !important;
          padding-right: ${marginWidth} !important;
        }
        
        /* Ensure fonts are applied to all text elements */
        body, p, div, span, h1, h2, h3, h4, h5, h6 {
          font-family: ${fontFamily} !important;
        }
        p {
          margin-bottom: ${paragraphSpacing} !important;
        }
      `;
      
      view.renderer.setStyles(stylesheet);
    };
    
    // Apply styles on mount and when settings change
    applyStyles();
    
    // Listen for settings updates from other components
    const handleSettingsUpdate = () => {
      applyStyles();
    };
    
    window.addEventListener('reader-settings-updated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('reader-settings-updated', handleSettingsUpdate);
    };
  }, [settings.fontSize, settings.fontFamily, settings.lineHeight, settings.marginWidth, settings.paragraphSpacing]);

  const handlePrev = async () => {
    try {
      await viewRef.current?.prev();
    } catch (err) {
      console.error("Failed to go to previous page:", err);
    }
  };

  const handleNext = async () => {
    try {
      await viewRef.current?.next();
    } catch (err) {
      console.error("Failed to go to next page:", err);
    }
  };

  const handleBack = useCallback(() => {
    // Explicitly commit the session when returning to library
    if (isActiveRef.current && sessionStartRef.current) {
       commitSession();
    }
    navigate('/');
  }, [navigate, commitSession]);

  return (
    <div className="flex flex-col h-screen bg-background relative">
      {/* Header */}
      {showOverlay && (
        <ReaderHeader 
          bookTitle={bookTitle}
          onBack={handleBack}
          onOpenSettings={() => setShowSettings(true)}
          onOpenToc={() => setShowToc(true)}
          onOpenBookmarks={() => setShowBookmarks(true)}
        />
      )}

      {/* Side Navigation */}
      <SideNavigation
        onPrev={handlePrev}
        onNext={handleNext}
        isVisible={showOverlay}
        isLoading={isLoading}
        hasError={!!error}
      />

      {/* Chapter Progress Bar */}
      <ChapterProgress
        progress={locationInfo.fraction}
        isVisible={showOverlay}
      />

      {/* Reader Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className="reader-container absolute inset-0"
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
            <div className="flex flex-col items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="absolute top-4 left-4"
              >
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
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="absolute top-4 left-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <p className="text-destructive font-medium mb-2">
                Error loading book
              </p>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <ReaderFooter
        progress={locationInfo.current}
        currentChapter={locationInfo.currentChapter}
        totalChapters={locationInfo.totalChapters}
        currentPage={locationInfo.currentPage}
        totalPagesInChapter={locationInfo.totalPagesInChapter}
        isVisible={showOverlay}
      />

      {/* ToC Drawer */}
      <TocDrawer
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        chapters={chapters}
        currentChapterIndex={locationInfo.currentChapter - 1}
        onChapterSelect={handleChapterSelect}
      />

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        bookId={propBookId}
        onOpenToc={handleOpenToc}
      />

      {/* Bookmarks Drawer */}
      <BookmarksDrawer
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        bookmarks={getBookmarks()}
        onBookmarkSelect={handleBookmarkSelect}
        onBookmarkDelete={handleBookmarkDelete}
        onAddBookmark={handleAddBookmark}
      />
    </div>
  );
};

export default EpubReader;
