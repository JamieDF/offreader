import { ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookDetailsHeaderProps {
  onBack: () => void;
  onShare: () => void;
}

export function BookDetailsHeader({ onBack, onShare }: BookDetailsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-md border-b border-border">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onShare}>
        <Share2 className="h-5 w-5" />
      </Button>
    </header>
  );
}
