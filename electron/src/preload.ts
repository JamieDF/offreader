import { contextBridge, ipcRenderer } from 'electron';

import './rt/electron-rt';
//////////////////////////////
// User Defined Preload scripts below

// Window controls for the frameless custom titlebar. Channel names must match
// the ipcMain.handle() calls in index.ts (tests/unit/electron/titlebar.test.ts
// verifies this).
contextBridge.exposeInMainWorld('offreaderWindow', {
  minimize: () => ipcRenderer.invoke('offreader:window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('offreader:window-toggle-maximize'),
  close: () => ipcRenderer.invoke('offreader:window-close'),
  isMaximized: () => ipcRenderer.invoke('offreader:window-is-maximized'),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('offreader:window-maximized-change', listener);
    return () => ipcRenderer.removeListener('offreader:window-maximized-change', listener);
  },
});

// Native file access for linked books and picker imports. Channel names must
// match the ipcMain.handle() calls in index.ts (tests/unit/electron/
// titlebar.test.ts verifies channel-name agreement).
contextBridge.exposeInMainWorld('offreaderFiles', {
  /** Native multi-file picker; resolves to absolute paths ([] if cancelled). */
  pickBookFiles: () => ipcRenderer.invoke('offreader:pick-book-files'),
  /** Native single-file picker; resolves to a path or null. */
  pickBookFile: () => ipcRenderer.invoke('offreader:pick-book-file'),
  /** Whitelists a path so offreader-file:// can serve it to the renderer. */
  registerPath: (path: string) => ipcRenderer.invoke('offreader:register-file-path', path),
  fileExists: (path: string) => ipcRenderer.invoke('offreader:file-exists', path),
  statFile: (path: string) => ipcRenderer.invoke('offreader:stat-file', path),
});
