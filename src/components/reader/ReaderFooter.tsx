import { Progress } from "@/components/ui/progress";

interface ReaderFooterProps {
  progress: number;
  currentChapter: number;
  totalChapters: number;
  currentPage: number;
  totalPagesInChapter: number;
  isVisible: boolean;
}

const ReaderFooter = ({
  progress,
  currentChapter,
  totalChapters,
  currentPage,
  totalPagesInChapter,
  isVisible,
}: ReaderFooterProps) => {
  return (
    <div className={`flex flex-col gap-2 px-4 py-2 bg-card/95 backdrop-blur-sm border-t border-border shrink-0 transition-all duration-300 absolute bottom-0 left-0 right-0 z-20 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
      <Progress value={progress} className="h-1" />
      <span className="text-xs text-muted-foreground text-center">
        Chapter {currentChapter} of {totalChapters} · Page {currentPage} of {totalPagesInChapter} · {progress}%
      </span>
    </div>
  );
};

export default ReaderFooter;
