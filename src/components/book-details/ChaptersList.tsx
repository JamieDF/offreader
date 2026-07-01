import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Chapter } from "@/types/book";
import { Check, BookOpen, ChevronRight } from "lucide-react";

interface ChaptersListProps {
  chapters: Chapter[];
  bookFilePath: string;
  currentChapter: number;
  totalChapters: number;
  progress: number;
  onChapterSelect?: (chapter: Chapter) => void;
}

export function ChaptersList({ 
  chapters, 
  bookFilePath, 
  currentChapter, 
  totalChapters,
  progress,
  onChapterSelect 
}: ChaptersListProps) {
  const navigate = useNavigate();

  // Calculate which chapters are "read" based on progress
  const getChapterStatus = (chapterIndex: number) => {
    if (progress >= 100) return "read";
    const chapterProgress = ((chapterIndex + 1) / totalChapters) * 100;
    if (progress >= chapterProgress) return "read";
    if (chapterIndex + 1 === currentChapter) return "current";
    return "unread";
  };

  const handleChapterClick = (chapter: Chapter) => {
    if (onChapterSelect) {
      onChapterSelect(chapter);
    } else {
      // Navigate to reader with chapter location
      const location = chapter.cfi || chapter.href;
      navigate(`/reader?book=${encodeURIComponent(bookFilePath)}&location=${encodeURIComponent(location)}`);
    }
  };

  if (chapters.length === 0) {
    return (
      <Card className="border-border/50 mx-4 md:mx-6 mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Chapters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No chapters found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              This book doesn't have a table of contents
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 mx-4 md:mx-6 mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Chapters ({chapters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-64">
          <div className="px-4 pb-4 space-y-1">
            {chapters.map((chapter) => {
              const status = getChapterStatus(chapter.index);
              return (
                <Button
                  key={chapter.index}
                  variant="ghost"
                  className={`w-full justify-start h-auto py-3 px-3 text-left group ${
                    status === "current" 
                      ? "bg-primary/10 hover:bg-primary/20" 
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleChapterClick(chapter)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      status === "read" 
                        ? "bg-primary/20 text-primary" 
                        : status === "current"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {status === "read" ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span>{chapter.index + 1}</span>
                      )}
                    </div>
                    <span className={`flex-1 min-w-0 text-sm truncate ${
                      status === "current" ? "font-medium text-primary" : ""
                    }`}>
                      {chapter.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
