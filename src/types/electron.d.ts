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

declare global {
  interface Window {
    offreaderWindow?: ElectronWindowApi;
  }
}

export {};
