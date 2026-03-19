import { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { Chapter } from '@/types/book';
import { Bookmark } from '@/hooks/useBookTracker';
import ReaderHeader from './ReaderHeader';
import ReaderFooter from './ReaderFooter';
import SideNavigation from './SideNavigation';
import ChapterProgress from './ChapterProgress';
import SettingsDrawer from './SettingsDrawer';
import TocDrawer from './TocDrawer';
import { BookmarksDrawer } from './BookmarksDrawer';

export interface LocationInfo {
  current: number;
  total: number;
  currentChapter: number;
  totalChapters: number;
  fraction: number;
  currentPage: number;
  totalPagesInChapter: number;
}

interface ReaderOverlayProps {
  bookTitle: string;
  bookId: string;
  locationInfo: LocationInfo;
  chapters: Chapter[];
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  isLoading: boolean;
  hasError: boolean;
  bookmarks: Bookmark[];
  onBookmarkSelect: (bookmark: Bookmark) => void;
  onBookmarkDelete: (id: string) => void;
  onAddBookmark: () => void;
  onChapterSelect: (chapter: Chapter) => void;
}

export interface ReaderOverlayHandle {
  toggle: () => void;
}

const ReaderOverlay = forwardRef<ReaderOverlayHandle, ReaderOverlayProps>(({
  bookTitle,
  bookId,
  locationInfo,
  chapters,
  onBack,
  onPrev,
  onNext,
  isLoading,
  hasError,
  bookmarks,
  onBookmarkSelect,
  onBookmarkDelete,
  onAddBookmark,
  onChapterSelect,
}, ref) => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);

  useImperativeHandle(ref, () => ({
    toggle: () => setShowOverlay(prev => !prev),
  }));

  const handleOpenToc = useCallback(() => setShowToc(true), []);

  return (
    <>
      {showOverlay && (
        <ReaderHeader
          bookTitle={bookTitle}
          onBack={onBack}
          onOpenSettings={() => setShowSettings(true)}
          onOpenToc={() => setShowToc(true)}
          onOpenBookmarks={() => setShowBookmarks(true)}
        />
      )}

      <SideNavigation
        onPrev={onPrev}
        onNext={onNext}
        isVisible={showOverlay}
        isLoading={isLoading}
        hasError={hasError}
      />

      <ChapterProgress
        progress={locationInfo.fraction}
        isVisible={showOverlay}
      />

      <ReaderFooter
        progress={locationInfo.current}
        currentChapter={locationInfo.currentChapter}
        totalChapters={locationInfo.totalChapters}
        currentPage={locationInfo.currentPage}
        totalPagesInChapter={locationInfo.totalPagesInChapter}
        isVisible={showOverlay}
      />

      <TocDrawer
        isOpen={showToc}
        onClose={() => setShowToc(false)}
        chapters={chapters}
        currentChapterIndex={locationInfo.currentChapter - 1}
        onChapterSelect={onChapterSelect}
      />

      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        bookId={bookId}
        onOpenToc={handleOpenToc}
      />

      <BookmarksDrawer
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        bookmarks={bookmarks}
        onBookmarkSelect={onBookmarkSelect}
        onBookmarkDelete={onBookmarkDelete}
        onAddBookmark={onAddBookmark}
      />
    </>
  );
});

ReaderOverlay.displayName = 'ReaderOverlay';

export default ReaderOverlay;
