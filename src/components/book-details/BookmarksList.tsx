import { Bookmark } from "@/hooks/useBookTracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bookmark as BookmarkIcon, Clock, MapPin, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface BookmarksListProps {
  bookmarks: Bookmark[];
  bookFilePath: string;
  onBookmarkSelect: (bookmark: Bookmark) => void;
  onBookmarkDelete: (bookmarkId: string) => void;
}

export function BookmarksList({ bookmarks, bookFilePath, onBookmarkSelect, onBookmarkDelete }: BookmarksListProps) {
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

  if (bookmarks.length === 0) {
    return (
      <div className="px-4 md:px-6 mt-6 space-y-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookmarkIcon className="h-5 w-5" />
              Bookmarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <BookmarkIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">No bookmarks yet</p>
              <p className="text-sm">Start reading and save your favorite passages to see them here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 mt-6 space-y-4">
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
          <div className="space-y-3">
            {bookmarks.map((bookmark, index) => (
              <div
                key={bookmark.id}
                className="group rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onBookmarkSelect(bookmark)}
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
                      onBookmarkSelect(bookmark);
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
                      onBookmarkDelete(bookmark.id);
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
          
          {bookmarks.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Click any bookmark to continue reading from that position
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
