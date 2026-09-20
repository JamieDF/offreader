/**
 * Tests for the frameless-window custom titlebar wiring.
 *
 * The titlebar spans three files that must agree with each other:
 * - electron/src/setup.ts   — BrowserWindow must be frameless and forward
 *                             maximize/unmaximize events to the renderer
 * - electron/src/index.ts   — ipcMain.handle() for each window control
 * - electron/src/preload.ts — contextBridge expose that invokes the same
 *                             channel names
 *
 * Channel names are string literals in both sides of the bridge, so a typo
 * compiles fine and fails silently at runtime. These tests pin the contract.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const setupSrc = readFileSync(path.join(PROJECT_ROOT, 'electron/src/setup.ts'), 'utf-8');
const indexSrc = readFileSync(path.join(PROJECT_ROOT, 'electron/src/index.ts'), 'utf-8');
const preloadSrc = readFileSync(path.join(PROJECT_ROOT, 'electron/src/preload.ts'), 'utf-8');

function channels(src: string, via: string): Set<string> {
  const re = new RegExp(`${via}\\('([^']+)'`, 'g');
  return new Set([...src.matchAll(re)].map((m) => m[1]));
}

describe('frameless window setup', () => {
  it('BrowserWindow is created with frame: false', () => {
    expect(setupSrc).toContain('frame: false');
  });

  it('forwards maximize and unmaximize events to the renderer', () => {
    expect(setupSrc).toContain("on('maximize'");
    expect(setupSrc).toContain("on('unmaximize'");
    expect(setupSrc).toContain("'offreader:window-maximized-change'");
  });
});

describe('window control IPC contract', () => {
  const handled = channels(indexSrc, 'ipcMain\\.handle');
  const invoked = channels(preloadSrc, 'ipcRenderer\\.invoke');

  it('main process registers handlers', () => {
    expect(handled.size).toBeGreaterThan(0);
  });

  it('every preload invoke() has a matching main-process handle()', () => {
    for (const channel of invoked) {
      expect(handled.has(channel), `missing ipcMain.handle for ${channel}`).toBe(true);
    }
  });

  it('every handle() is reachable from the preload', () => {
    for (const channel of handled) {
      expect(invoked.has(channel), `unreachable channel ${channel}`).toBe(true);
    }
  });

  it('all channels use the offreader: namespace', () => {
    for (const channel of [...handled, ...invoked]) {
      expect(channel).toMatch(/^offreader:/);
    }
  });
});

describe('maximize state events', () => {
  it('preload subscribes to the same event channel setup.ts sends on', () => {
    const sent = channels(setupSrc, 'webContents\\.send');
    const heard = channels(preloadSrc, 'ipcRenderer\\.on');
    for (const channel of heard) {
      expect(sent.has(channel), `setup.ts never sends ${channel}`).toBe(true);
    }
  });

  it('event subscription returns an unsubscribe function', () => {
    expect(preloadSrc).toContain('removeListener');
  });
});

describe('renderer exposure', () => {
  it('preload exposes the offreaderWindow API on window', () => {
    expect(preloadSrc).toContain("exposeInMainWorld('offreaderWindow'");
  });

  it('web app declares the window.offreaderWindow type', () => {
    const dts = readFileSync(
      path.join(PROJECT_ROOT, 'src/types/electron.d.ts'),
      'utf-8'
    );
    expect(dts).toContain('offreaderWindow');
  });
});
