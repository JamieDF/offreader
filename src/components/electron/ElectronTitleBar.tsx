import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

// Custom titlebar for the frameless Electron window (mockup: variant A in
// public/mockups/electron-titlebar-v1.html). Renders nothing outside the
// desktop app — window.offreaderWindow only exists when the preload ran.
export const ElectronTitleBar = () => {
  const api = window.offreaderWindow;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!api) return;
    void api.isMaximized().then(setIsMaximized);
    return api.onMaximizedChange(setIsMaximized);
  }, [api]);

  if (!api) return null;

  const toggleMaximize = async () => {
    setIsMaximized(await api.toggleMaximize());
  };

  return (
    <header
      className="electron-titlebar flex h-9 shrink-0 select-none items-center justify-between border-b border-border bg-card text-card-foreground"
      onDoubleClick={() => void toggleMaximize()}
    >
      <div className="flex items-center gap-2 pl-3">
        <img src="/offReader.svg" alt="" className="h-4 w-4" />
        <span className="text-xs font-medium tracking-wide">OffReader</span>
      </div>
      <div
        className="app-no-drag flex h-full"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void api.minimize()}
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Minimize window"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void toggleMaximize()}
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => void api.close()}
          className="flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          aria-label="Close window"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
