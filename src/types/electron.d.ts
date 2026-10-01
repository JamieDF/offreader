// API exposed by the Electron preload (electron/src/preload.ts) for the
// frameless custom titlebar. Only defined inside the desktop app.
export interface ElectronWindowApi {
  minimize(): Promise<void>;
  /** Toggles maximize; resolves to the new maximized state. */
  toggleMaximize(): Promise<boolean>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** Subscribes to maximize/unmaximize events; returns an unsubscribe fn. */
  onMaximizedChange(callback: (maximized: boolean) => void): () => void;
}

/** Native file access for linked books and picker imports (Electron only). */
export interface OffreaderFilesApi {
  /** Native multi-file picker; resolves to absolute paths ([] if cancelled). */
  pickBookFiles(): Promise<string[]>;
  /** Native single-file picker; resolves to a path or null. */
  pickBookFile(): Promise<string | null>;
  /** Whitelists a path so offreader-file:// can serve it to the renderer. */
  registerPath(path: string): Promise<void>;
  /** True if the path exists and is readable. */
  fileExists(path: string): Promise<boolean>;
  /** File metadata, or null if unreadable/missing. */
  statFile(path: string): Promise<{ size: number; mtimeMs: number; name: string } | null>;
}

declare global {
  interface Window {
    offreaderWindow?: ElectronWindowApi;
    offreaderFiles?: OffreaderFilesApi;
  }
}

export {};
