import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, dialog, ipcMain, MenuItem, net, protocol } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
import chokidar, { FSWatcher } from 'chokidar';
import { access, copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';

// Linked books are read in place from their source path and served to the
// WebView over a custom scheme — no copy into app storage, no base64
// round-trip. Must be registered before app ready for fetch() support.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'offreader-file',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

// Only paths explicitly registered by the renderer (linked books / picked
// files) may be served — keeps the scheme from becoming a read-anything hole.
const allowedFilePaths = new Set<string>();

const BOOK_EXTENSIONS = new Set(['.epub', '.pdf', '.mobi', '.azw3', '.fb2', '.cbz']);

// "Open with" / double-clicked book files land here until the renderer pulls
// them via offreader:take-pending-files — pull-based so launch timing (cold
// start vs second instance vs macOS open-file) can't drop events.
const pendingOpenFiles: string[] = [];
const collectOpenPaths = (argv: string[]) => {
  for (const arg of argv) {
    if (!arg.startsWith('-') && BOOK_EXTENSIONS.has(extname(arg).toLowerCase())) {
      pendingOpenFiles.push(arg);
    }
  }
};
collectOpenPaths(process.argv);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // A second "open with" hit should deliver the file to the running instance.
  app.quit();
}
app.on('second-instance', (_event, argv) => {
  collectOpenPaths(argv);
  myCapacitorApp.getMainWindow()?.webContents.send('offreader:files-opened');
});
app.on('open-file', (event, filePath) => {
  // macOS "Open with"
  event.preventDefault();
  if (BOOK_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    pendingOpenFiles.push(filePath);
    myCapacitorApp.getMainWindow()?.webContents.send('offreader:files-opened');
  }
});

// Graceful handling of unhandled errors.
unhandled();

// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}

// If we are in Dev mode, use the file watcher components.
if (electronIsDev) {
  setupReloadWatcher(myCapacitorApp);
}

// Run Application
(async () => {
  // Wait for electron app to be ready.
  await app.whenReady();
  // Streams whitelisted source files (linked books / picked imports) to the
  // renderer over offreader-file://file/?p=<path> — no copy into app storage.
  protocol.handle('offreader-file', async (request) => {
    const sourcePath = new URL(request.url).searchParams.get('p') ?? '';
    if (!allowedFilePaths.has(sourcePath)) {
      return new Response('Forbidden', { status: 403 });
    }
    const upstream = await net.fetch(pathToFileURL(sourcePath).toString());
    // Wrap to add CORS — the request is cross-scheme from the app origin.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      },
    });
  });
  // Security - Set Content-Security-Policy based on whether or not we are in dev mode.
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
  // Initialize our app, build windows, and load content.
  await myCapacitorApp.init();
  // Check for updates if we are in a packaged app.
  // Silently skip if no GitHub releases exist yet.
  autoUpdater.logger = { info: () => {}, warn: () => {}, error: () => {} };
  autoUpdater.on('error', () => {});
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
})();

// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// When the dock icon is clicked.
app.on('activate', async function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});

// Place all ipc or other electron api calls and custom functionality under this line

// Window controls for the frameless custom titlebar. Handlers resolve the
// window lazily so they keep working if the window is recreated on activate.
ipcMain.handle('offreader:window-minimize', () => {
  myCapacitorApp.getMainWindow()?.minimize();
});
ipcMain.handle('offreader:window-toggle-maximize', () => {
  const win = myCapacitorApp.getMainWindow();
  if (!win) return false;
  if (win.isMaximized()) {
    win.unmaximize();
    return false;
  }
  win.maximize();
  return true;
});
ipcMain.handle('offreader:window-close', () => {
  myCapacitorApp.getMainWindow()?.close();
});
ipcMain.handle('offreader:window-is-maximized', () => {
  return myCapacitorApp.getMainWindow()?.isMaximized() ?? false;
});

ipcMain.handle('offreader:pick-book-files', async () => {
  const win = myCapacitorApp.getMainWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import books',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Books', extensions: ['epub', 'pdf', 'mobi', 'azw3', 'fb2', 'cbz'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return canceled ? [] : filePaths;
});

ipcMain.handle('offreader:pick-book-file', async () => {
  const win = myCapacitorApp.getMainWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Locate book file',
    properties: ['openFile'],
    filters: [
      { name: 'Books', extensions: ['epub', 'pdf', 'mobi', 'azw3', 'fb2', 'cbz'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

ipcMain.handle('offreader:register-file-path', (_event, sourcePath: string) => {
  if (typeof sourcePath === 'string' && sourcePath.length > 0) {
    allowedFilePaths.add(sourcePath);
  }
});

ipcMain.handle('offreader:file-exists', async (_event, sourcePath: string) => {
  if (typeof sourcePath !== 'string' || !sourcePath) return false;
  try {
    await access(sourcePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('offreader:stat-file', async (_event, sourcePath: string) => {
  if (typeof sourcePath !== 'string' || !sourcePath) return null;
  try {
    const s = await stat(sourcePath);
    return { size: s.size, mtimeMs: s.mtimeMs, name: basename(sourcePath) };
  } catch {
    return null;
  }
});

// --- Folder sync ------------------------------------------------------------

ipcMain.handle('offreader:pick-directory', async () => {
  const win = myCapacitorApp.getMainWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose a folder to sync',
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled || filePaths.length === 0 ? null : filePaths[0];
});

// Recursive walk filtered to book formats. Returns sorted entries with the
// stat data the sync pass needs to skip unchanged files without re-hashing.
ipcMain.handle('offreader:scan-folder', async (_event, dirPath: string) => {
  if (typeof dirPath !== 'string' || !dirPath) return [];
  const results: { path: string; name: string; size: number; mtimeMs: number }[] = [];
  const pending = [dirPath];
  while (pending.length > 0) {
    const dir = pending.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir (permissions, dangling symlink) — skip
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        pending.push(full);
      } else if (entry.isFile() && BOOK_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const s = await stat(full).catch(() => null);
        if (s) results.push({ path: full, name: entry.name, size: s.size, mtimeMs: s.mtimeMs });
      }
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
});

// chokidar, not fs.watch — recursive watching isn't supported on Linux's
// inotify. Events are debounced so a batch of file ops yields one rescan.
const folderWatchers = new Map<string, FSWatcher>();
const FOLDER_EVENT_DEBOUNCE_MS = 750;

ipcMain.handle('offreader:watch-folder', (_event, dirPath: string) => {
  if (typeof dirPath !== 'string' || !dirPath || folderWatchers.has(dirPath)) return;
  const win = myCapacitorApp.getMainWindow();
  let timer: NodeJS.Timeout | null = null;
  const notify = (changedPath?: string) => {
    // Book formats only — ignores churn on unrelated files in the folder.
    if (changedPath && !BOOK_EXTENSIONS.has(extname(changedPath).toLowerCase())) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      win?.webContents.send('offreader:folder-changed', dirPath);
    }, FOLDER_EVENT_DEBOUNCE_MS);
  };
  const watcher = chokidar.watch(dirPath, { ignoreInitial: true, depth: 10 });
  watcher.on('add', notify).on('change', notify).on('unlink', notify);
  folderWatchers.set(dirPath, watcher);
});

ipcMain.handle('offreader:unwatch-folder', async (_event, dirPath: string) => {
  const watcher = folderWatchers.get(dirPath);
  if (watcher) {
    await watcher.close();
    folderWatchers.delete(dirPath);
  }
});

// --- "Open with" ------------------------------------------------------------

// Renderer pulls queued paths (from argv / second-instance / open-file);
// returns and clears the queue.
ipcMain.handle('offreader:take-pending-files', () => pendingOpenFiles.splice(0));

// --- Library export -----------------------------------------------------------

// Managed books' bytes live in renderer IndexedDB, so they arrive as a
// buffer; linked books are copied natively — no bridge round-trip.
ipcMain.handle('offreader:export-write-file', async (_event, destPath: string, data: Uint8Array) => {
  await mkdir(join(destPath, '..'), { recursive: true });
  await writeFile(destPath, Buffer.from(data));
});

ipcMain.handle('offreader:export-copy-file', async (_event, sourcePath: string, destPath: string) => {
  await mkdir(join(destPath, '..'), { recursive: true });
  await copyFile(sourcePath, destPath);
});
