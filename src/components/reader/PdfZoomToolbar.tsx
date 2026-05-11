import { Minus, Plus, Minimize2, ArrowLeftRight, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type PdfZoom = 'fit-page' | 'fit-width' | number;

interface PdfZoomToolbarProps {
  zoom: PdfZoom;
  onZoomChange: (zoom: PdfZoom) => void;
  isVisible: boolean;
  rotation?: number;
  onRotationChange?: (rotation: number) => void;
}

const ZOOM_STEP = 0.1;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

const PdfZoomToolbar = ({ zoom, onZoomChange, isVisible, rotation = 0, onRotationChange }: PdfZoomToolbarProps) => {
  const numericBase = typeof zoom === 'number' ? zoom : 1;

  const handleZoomOut = () =>
    onZoomChange(Math.max(ZOOM_MIN, Math.round((numericBase - ZOOM_STEP) * 100) / 100));

  const handleZoomIn = () =>
    onZoomChange(Math.min(ZOOM_MAX, Math.round((numericBase + ZOOM_STEP) * 100) / 100));

  const label = zoom === 'fit-page' ? 'Fit Page'
    : zoom === 'fit-width' ? 'Fit Width'
    : `${Math.round((zoom as number) * 100)}%`;

  return (
    <div data-testid="pdf-zoom-toolbar" className={`flex flex-col gap-2 px-4 py-3 bg-card/95 backdrop-blur-sm border-t border-border shrink-0 transition-all duration-300 absolute bottom-[44px] left-0 right-0 z-20 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
      <div className="flex items-center justify-center gap-2">
        <Button
          variant={zoom === 'fit-page' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 px-3 text-xs gap-1.5"
          onClick={() => onZoomChange('fit-page')}
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Fit Page
        </Button>

        <Button
          variant={zoom === 'fit-width' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 px-3 text-xs gap-1.5"
          onClick={() => onZoomChange('fit-width')}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Fit Width
        </Button>

        <div className="flex items-center gap-1 ml-2">
          <Button
            aria-label="Zoom out"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={typeof zoom === 'number' && zoom <= ZOOM_MIN}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span data-testid="zoom-label" className="text-xs w-14 text-center tabular-nums text-muted-foreground select-none">
            {label}
          </span>
          <Button
            aria-label="Zoom in"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={typeof zoom === 'number' && zoom >= ZOOM_MAX}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {onRotationChange && (
            <Button
              aria-label="Rotate clockwise"
              variant="ghost"
              size="icon"
              className="h-8 w-8 ml-1"
              onClick={() => onRotationChange((rotation + 90) % 360)}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfZoomToolbar;
