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
  /** Native directory picker; resolves to a path or null. */
  pickDirectory: () => ipcRenderer.invoke('offreader:pick-directory'),
  /** Recursive scan for book files under a directory. */
  scanFolder: (path: string) => ipcRenderer.invoke('offreader:scan-folder', path),
  /** Watch a directory for add/change/unlink of book files (debounced). */
  watchFolder: (path: string) => ipcRenderer.invoke('offreader:watch-folder', path),
  unwatchFolder: (path: string) => ipcRenderer.invoke('offreader:unwatch-folder', path),
  /** Fires when a watched folder's book files change; returns unsubscribe. */
  onFolderChanged: (callback: (dirPath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dirPath: string) => callback(dirPath);
    ipcRenderer.on('offreader:folder-changed', listener);
    return () => ipcRenderer.removeListener('offreader:folder-changed', listener);
  },
});
