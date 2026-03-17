import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Chapter } from "@/types/book";
import { Check, BookOpen } from "lucide-react";

interface TocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterIndex: number;
  onChapterSelect: (chapter: Chapter) => void;
}

const TocDrawer = ({ 
  isOpen, 
  onClose, 
  chapters, 
  currentChapterIndex, 
  onChapterSelect 
}: TocDrawerProps) => {
  const handleSelect = (chapter: Chapter) => {
    onChapterSelect(chapter);
    // Don't close the drawer immediately - let the navigation handle it
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="px-4 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Table of Contents
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {chapters.length === 0 ? (
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
                    className={`w-full justify-start h-auto py-3 px-4 rounded-none text-left ${
                      isCurrent 
                        ? "bg-primary/10 border-l-2 border-primary" 
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handleSelect(chapter)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCurrent 
                          ? "bg-primary text-primary-foreground" 
                          : isRead
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isRead ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span>{chapter.index + 1}</span>
                        )}
                      </div>
                      <span className={`flex-1 text-sm leading-snug ${
                        isCurrent ? "font-medium text-primary" : ""
                      }`}>
                        {chapter.label}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default TocDrawer;
