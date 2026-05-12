import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Book } from "@/types/book";
import { BookStats } from "@/hooks/useBookTracker";
import { Bookmark } from "@/hooks/useBookTracker";
import { FileText, Layers, HardDrive, Calendar, Building2, Globe, Tag, Copyright, Clock, BookOpen, Bookmark as BookmarkIcon, MapPin, ExternalLink, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";
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

interface BookMetadataProps {
  book: Book;
  stats: BookStats;
  bookmarks?: Bookmark[];
  bookFilePath?: string;
  onBookmarkSelect?: (bookmark: Bookmark) => void;
  onBookmarkDelete?: (bookmarkId: string) => void;
}

export function BookMetadata({ book, stats, bookmarks = [], bookFilePath: _bookFilePath = "", onBookmarkSelect, onBookmarkDelete }: BookMetadataProps) {
  const description = book.description || "No description available.";
  const hasExtraMetadata = book.publisher || book.pubDate || book.language || book.subjects?.length || book.rights;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookmarkToDelete, setBookmarkToDelete] = useState<string | null>(null);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM d, yyyy");
    } catch {
      return "Unknown date";
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "h:mm a");
    } catch {
      return "";
    }
  };

  const handleDeleteClick = (bookmarkId: string) => {
    setBookmarkToDelete(bookmarkId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (bookmarkToDelete) {
      onBookmarkDelete?.(bookmarkToDelete);
      toast.success("Bookmark deleted");
      setBookmarkToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="px-4 md:px-6 mt-6 space-y-4">
      {/* Synopsis */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Synopsis</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-28 pr-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div className="space-y-1">
              <div className="flex justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground uppercase">Format</p>
              <p className="text-sm font-medium">{stats.format}</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-center">
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground uppercase">{book.format === 'PDF' ? 'Sections' : 'Chapters'}</p>
              <p className="text-sm font-medium">{book.chapters?.length || book.totalChapters || '—'}</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-center">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground uppercase">Size</p>
              <p className="text-sm font-medium">{stats.fileSize}</p>
            </div>
          </div>
          
          {/* Reading Metrics */}
          {(book.pageCount || book.estimatedReadingTime) && (
            <div className="grid grid-cols-2 gap-4 text-center pt-4 border-t border-border/50">
              {book.pageCount && (
                <div className="space-y-1">
                  <div className="flex justify-center">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground uppercase">{book.format === 'PDF' ? 'Pages' : 'Est. Pages'}</p>
                  <p className="text-sm font-medium">{book.pageCount.toLocaleString()}</p>
                </div>
              )}
              {book.estimatedReadingTime && (
                <div className="space-y-1">
                  <div className="flex justify-center">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground uppercase">Reading Time</p>
                  <p className="text-sm font-medium">{book.estimatedReadingTime}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publication Details */}
      {hasExtraMetadata && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Publication Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {book.publisher && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase">Publisher</p>
                    <p className="font-medium truncate">{book.publisher}</p>
                  </div>
                </div>
              )}
              {book.pubDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Published</p>
                    <p className="font-medium">{new Date(book.pubDate).getFullYear()}</p>
                  </div>
                </div>
              )}
              {book.language && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Language</p>
                    <p className="font-medium">{book.language.toUpperCase()}</p>
                  </div>
                </div>
              )}
              {book.rights && (
                <div className="flex items-center gap-2">
                  <Copyright className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase">Copyright</p>
                    <p className="font-medium text-xs truncate" title={book.rights}>{book.rights}</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Tags/Subjects */}
            {book.subjects && book.subjects.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground uppercase">Tags</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {book.subjects.slice(0, 6).map((subject, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {subject}
                    </span>
                  ))}
                  {book.subjects.length > 6 && (
                    <span className="text-xs text-muted-foreground">
                      +{book.subjects.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Bookmarks */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookmarkIcon className="h-5 w-5" />
              Bookmarks ({bookmarks.length})
            </div>
            <Badge variant="secondary" className="text-xs">
              {bookmarks.length} saved
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookmarks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookmarkIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">No bookmarks yet</p>
              <p className="text-sm">Start reading and save your favorite passages to see them here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onBookmarkSelect?.(bookmark)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium text-sm line-clamp-1">
                          {bookmark.chapterTitle}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {Math.round(bookmark.position)}%
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(bookmark.createdAt)}</span>
                        </div>
                        <span>{formatTime(bookmark.createdAt)}</span>
                      </div>
                      
                      {bookmark.note && (
                        <p className="text-sm text-muted-foreground italic line-clamp-2 border-l-2 border-primary/20 pl-3">
                          "{bookmark.note}"
                        </p>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookmarkSelect?.(bookmark);
                      }}
                      aria-label="Go to bookmark"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(bookmark.id);
                      }}
                      className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive"
                      aria-label="Delete bookmark"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {bookmarks.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Click any bookmark to continue reading from that position
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Delete Bookmark Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bookmark</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete this bookmark? This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
