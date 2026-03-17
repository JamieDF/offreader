import { Progress } from "@/components/ui/progress";

interface ChapterProgressProps {
  progress: number;
  isVisible: boolean;
}

const ChapterProgress = ({ progress, isVisible }: ChapterProgressProps) => {
  return (
    <div className={`absolute bottom-14 left-14 right-14 z-25 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <Progress value={progress} className="h-1 bg-muted/50" />
    </div>
  );
};

export default ChapterProgress;
