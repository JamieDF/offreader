import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Book } from "@/types/book";
import { BookOpen, Play } from "lucide-react";
import { useState } from "react";
import { titleCase } from "@/utils/titleCase";

interface ResumeHeroProps {
  book: Book;
  onContinue: (book: Book) => void;
}

export function ResumeHero({ book, onContinue }: ResumeHeroProps) {
  const [imageError, setImageError] = useState(false);
  const showFallback = imageError || !book.coverImage;

  return (
    <Card className="mb-8 overflow-hidden border-none bg-gradient-to-br from-primary/15 via-primary/5 to-background shadow-md hover:shadow-lg transition-all duration-300 ring-1 ring-primary/10">
    <CardContent className="p-0">
        <div className="flex flex-row items-stretch">
          {/* Thumbnail */}
          <div className="relative w-24 sm:w-40 shrink-0 overflow-hidden shadow-xl bg-muted">
            <div className="aspect-[2/3]">
              {showFallback ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 p-2">
                  <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-primary/60 mb-1" />
                  <span className="text-[10px] sm:text-xs text-primary/90 text-center font-semibold line-clamp-2 px-1">
                    {titleCase(book.title)}
                  </span>
                </div>
              ) : (
                <img
                  src={book.coverImage}
                  alt={titleCase(book.title)}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between flex-1 p-4 sm:p-8 bg-card/50 backdrop-blur-sm">
            <div className="space-y-1 sm:space-y-2">
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-[11px] font-bold uppercase tracking-widest mb-3 border border-primary/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Continue Reading
              </div>
              <h2 className="text-base sm:text-3xl font-extrabold text-foreground tracking-tight line-clamp-2">
                {titleCase(book.title)}
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground font-medium line-clamp-1">
                {book.author}
              </p>
            </div>

            <div className="mt-3 sm:mt-8 space-y-3 sm:space-y-6">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm font-semibold tracking-wide">
                  <span className="text-muted-foreground/80">Progress</span>
                  <span className="text-primary font-bold">{Math.round(book.progress)}%</span>
                </div>
                <Progress value={book.progress} className="h-2 sm:h-2.5 bg-primary/10" />
              </div>
              
              <Button 
                onClick={() => onContinue(book)}
                size="default"
                className="w-full sm:w-fit gap-2 sm:gap-3 px-4 sm:px-8 shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 font-bold text-sm sm:text-base"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                Resume
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
