import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SideNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  isVisible: boolean;
  isLoading: boolean;
  hasError: boolean;
}

const SideNavigation = ({ onPrev, onNext, isVisible, isLoading, hasError }: SideNavigationProps) => {
  const disabled = isLoading || hasError;
  
  return (
    <>
      {/* Left navigation button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrev}
        disabled={disabled}
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-30 h-12 w-10 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      
      {/* Right navigation button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={disabled}
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-30 h-12 w-10 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="Next page"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </>
  );
};

export default SideNavigation;
