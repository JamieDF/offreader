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
