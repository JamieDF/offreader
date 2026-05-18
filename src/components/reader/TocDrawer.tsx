import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chapter, SearchResult } from '@/types/book';
import { Check, BookOpen, Search, X, ArrowLeft, ChevronDown } from 'lucide-react';

interface TocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters?: Chapter[];
  currentChapterIndex: number;
  onChapterSelect: (chapter: Chapter) => void;
  // Search props
  onSearch?: (query: string) => void;
  searchResults?: SearchResult[];
  searchQuery?: string;
  onSearchResultClick?: (location: string) => void;
}

type SortBy = 'page' | 'chapter';

export function TocDrawer({
  isOpen,
  onClose,
  chapters = [],
  currentChapterIndex = 0,
  onChapterSelect,
  onSearch,
  searchResults = [],
  searchQuery = '',
  onSearchResultClick,
}: TocDrawerProps) {
  const [localQuery, setLocalQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('chapter');
  const [groupByChapter, setGroupByChapter] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLocalQuery('');
      setShowResults(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (localQuery.trim()) {
      const timer = setTimeout(() => {
        onSearch?.(localQuery);
        setShowResults(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowResults(false);
      onSearch?.('');
    }
  }, [localQuery, onSearch]);

  const handleClearSearch = useCallback(() => {
    setLocalQuery('');
    setShowResults(false);
  }, []);

  const handleResultClick = useCallback((location: string) => {
    onSearchResultClick?.(location);
  }, [onSearchResultClick]);

  const sortedResults = [...(searchResults || [])].sort((a, b) => {
    if (sortBy === 'page') {
      return a.page - b.page || a.chapterIndex - b.chapterIndex;
    }
    return a.chapterIndex - b.chapterIndex;
  });

  const groupedResults = sortedResults.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const key = result.chapterTitle;
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {});

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;

    return (
      <>
        {text.slice(0, idx)}
        <strong className="font-bold">{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            {showResults ? (
              <button onClick={handleClearSearch} className="p-1 -ml-1 hover:bg-muted rounded">
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <BookOpen className="h-5 w-5" />
            )}
            <span>{showResults ? 'Search Results' : 'Table of Contents'}</span>
          </SheetTitle>

          {/* Search input */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in book..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="pl-9 pr-8"
              autoComplete="off"
            />
            {localQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Results info bar */}
          {showResults && searchResults?.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">
                {searchResults?.length} match{searchResults?.length !== 1 ? 'es' : ''}
              </span>
              <div className="flex items-center gap-2">
                {/* Sort dropdown */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="appearance-none bg-muted hover:bg-muted/80 text-xs px-2 py-1 rounded cursor-pointer pl-2 pr-6"
                  >
                    <option value="chapter">Chapter</option>
                    <option value="page">Page</option>
                  </select>
                  <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                </div>

                {/* Group toggle */}
                <button
                  onClick={() => setGroupByChapter(!groupByChapter)}
                  className={`text-xs px-2 py-1 rounded ${
                    groupByChapter ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  Group
                </button>
              </div>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          {showResults ? (
            // Results view
            searchResults?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <p className="text-sm font-medium text-muted-foreground">No matches found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Try a different search term
                </p>
              </div>
            ) : groupByChapter ? (
              // Grouped by chapter
              <div className="py-2">
                {Object.entries(groupedResults).map(([chapterTitle, results]) => (
                  <div key={chapterTitle} className="border-b last:border-b-0">
                    <div className="px-4 py-2 bg-muted/50">
                      <span className="text-xs font-medium text-muted-foreground">
                        {chapterTitle} ({results.length})
                      </span>
                    </div>
                    {results.map((result, idx) => (
                      <button
                        key={`${result.chapterIndex}-${idx}`}
                        onClick={() => handleResultClick(result.location)}
                        className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-b-0"
                      >
                        <p className="text-sm leading-snug line-clamp-2">
                          {highlightMatch(result.text, localQuery)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.chapterTitle} • Page {result.page}
                        </p>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              // Flat list
              <div className="py-2">
                {sortedResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleResultClick(result.location)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 border-b border-border/50 last:border-b-0"
                  >
                    <p className="text-sm leading-snug line-clamp-2">
                      {highlightMatch(result.text, localQuery)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {result.chapterTitle} • Page {result.page}
                    </p>
                  </button>
                ))}
              </div>
            )
          ) : (
            // Chapters view
            (chapters?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-sm font-medium text-muted-foreground">No chapters found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  This book doesn't have a table of contents
                </p>
              </div>
            ) : (
              <div className="py-2">
                {chapters.map((chapter) => {
                  const isCurrent = chapter.index === currentChapterIndex;
                  const isRead = chapter.index < currentChapterIndex;

                  return (
                    <Button
                      key={chapter.index}
                      variant="ghost"
                      style={{ paddingLeft: `${16 + (chapter.depth ?? 0) * 16}px` }}
                      className={`w-full justify-start h-auto py-3 rounded-none text-left ${
                        isCurrent
                          ? "bg-primary/10 border-l-2 border-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => onChapterSelect(chapter)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            isCurrent
                              ? "bg-primary text-primary-foreground"
                              : isRead
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isRead ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <span>{chapter.index + 1}</span>
                          )}
                        </div>
                        <span
                          className={`flex-1 text-sm leading-snug ${
                            isCurrent ? "font-medium text-primary" : ""
                          }`}
                        >
                          {chapter.label}
                        </span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default TocDrawer;