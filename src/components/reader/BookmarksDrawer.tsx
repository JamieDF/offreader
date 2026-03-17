import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bookmark as BookmarkIcon, Trash2, Clock, MapPin } from "lucide-react";
import { Bookmark } from "@/hooks/useBookTracker";
import { format } from "date-fns";

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onBookmarkSelect: (bookmark: Bookmark) => void;
  onBookmarkDelete: (bookmarkId: string) => void;
  onAddBookmark: () => void;
}

export function BookmarksDrawer({
  isOpen,
  onClose,
  bookmarks,
  onBookmarkSelect,
  onBookmarkDelete,
  onAddBookmark,
}: BookmarksDrawerProps) {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM d, yyyy 'at' h:mm a");
    } catch {
      return "Unknown date";
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <BookmarkIcon className="h-5 w-5" />
              Bookmarks ({bookmarks.length})
            </DrawerTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddBookmark}
              className="gap-2"
            >
              <BookmarkIcon className="h-4 w-4" />
              Add Current
            </Button>
          </div>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 px-4 py-2">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookmarkIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bookmarks yet</h3>
              <p className="text-muted-foreground mb-4">
                Save your favorite passages to quickly return to them later
              </p>
              <Button onClick={onAddBookmark} className="gap-2">
                <BookmarkIcon className="h-4 w-4" />
                Add Your First Bookmark
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="group rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => onBookmarkSelect(bookmark)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm line-clamp-1">
                          {bookmark.chapterTitle}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(bookmark.createdAt)}</span>
                        <span>•</span>
                        <span>{Math.round(bookmark.position)}% through book</span>
                      </div>
                      
                      {bookmark.note && (
                        <p className="text-sm text-muted-foreground italic line-clamp-2">
                          "{bookmark.note}"
                        </p>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onBookmarkDelete(bookmark.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Delete bookmark"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
