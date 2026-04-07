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
      <button
        onClick={onPrev}
        disabled={disabled}
        className="side-nav-btn side-nav-prev"
        style={{ opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'auto' : 'none' }}
        aria-label="Previous page"
      >
        <div className="h-12 w-12 rounded-full bg-background/40 group-hover:bg-background/90 backdrop-blur-sm flex items-center justify-center transition-all">
          <ChevronLeft className="h-8 w-8" />
        </div>
      </button>
      
      <button
        onClick={onNext}
        disabled={disabled}
        className="side-nav-btn side-nav-next"
        style={{ opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'auto' : 'none' }}
        aria-label="Next page"
      >
        <div className="h-12 w-12 rounded-full bg-background/40 group-hover:bg-background/90 backdrop-blur-sm flex items-center justify-center transition-all">
          <ChevronRight className="h-8 w-8" />
        </div>
      </button>

      <style>{`
        .side-nav-btn {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 80px;
          display: flex;
          align-items: center;
          transition: background 0.2s, opacity 0.3s;
          z-index: 10;
        }
        .side-nav-prev {
          left: 0;
          justify-content: flex-start;
          padding-left: 8px;
          background: linear-gradient(to right, hsl(var(--primary) / 0.25), transparent);
        }
        .side-nav-prev:hover {
          background: linear-gradient(to right, hsl(var(--primary) / 0.35), transparent);
        }
        .side-nav-next {
          right: 0;
          justify-content: flex-end;
          padding-right: 8px;
          background: linear-gradient(to left, hsl(var(--primary) / 0.25), transparent);
        }
        .side-nav-next:hover {
          background: linear-gradient(to left, hsl(var(--primary) / 0.35), transparent);
        }

        /* Desktop: always visible and clickable */
        @media (hover: hover) and (pointer: fine) {
          .side-nav-btn {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
        }
      `}</style>
    </>
  );
};

export default SideNavigation;
