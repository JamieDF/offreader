import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookStats } from "@/hooks/useBookTracker";
import { Book } from "@/types/book";
import { Play, RotateCcw } from "lucide-react";

interface ReadingStatsCardProps {
  book: Book;
  stats: BookStats;
  resumeLabel: string;
  lastReadFormatted: string;
  timeLeftFormatted: string;
  onReadNow: () => void;
}

export function ReadingStatsCard({
  book,
  stats,
  resumeLabel,
  lastReadFormatted,
  timeLeftFormatted,
  onReadNow,
}: ReadingStatsCardProps) {
  const isNewBook = stats.progress === 0;

  return (
    <Card className="mx-4 md:mx-6 border-border/50 shadow-lg">
      <CardContent className="p-4 md:p-6">
        {/* Progress section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{Math.round(stats.progress)}%</span>
          </div>
          <Progress value={stats.progress} className="h-2" />
          {!isNewBook && (
            <p className="text-xs text-muted-foreground">
              {stats.currentChapterLabel
                ? stats.currentChapterLabel
                : stats.currentChapter != null
                ? `Chapter ${stats.currentChapter + 1}`
                : null}
              {stats.currentPage && stats.totalPagesInChapter
                ? ` · Page ${stats.currentPage} of ${stats.totalPagesInChapter}`
                : null}
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Time Left
            </p>
            <p className="text-sm font-medium text-foreground">
              {isNewBook && book.estimatedReadingTime ? book.estimatedReadingTime : timeLeftFormatted}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Last Read
            </p>
            <p className="text-sm font-medium text-foreground">
              {lastReadFormatted}
            </p>
          </div>
        </div>

        {/* Read Now Button */}
        <Button
          onClick={onReadNow}
          className="w-full mt-6 h-12 text-base font-semibold"
          size="lg"
        >
          {stats.isFinished ? (
            <RotateCcw className="w-5 h-5 mr-2" />
          ) : (
            <Play className="w-5 h-5 mr-2" />
          )}
          {resumeLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
