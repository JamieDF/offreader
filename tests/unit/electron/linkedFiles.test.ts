/**
 * Contract tests for linked-book file access on Electron.
 *
 * Linked books stream from their source path over the custom
 * offreader-file:// scheme instead of being copied into app storage. This
 * spans four files that must agree:
 * - electron/src/index.ts   — registers the privileged scheme, the
 *                             path allowlist, protocol.handle, and the IPC
 *                             handlers (picker, registerPath, fileExists,
 *                             statFile)
 * - electron/src/setup.ts   — CSP must allow connect-src offreader-file:
 * - electron/src/preload.ts — exposes window.offreaderFiles
 * - src/types/electron.d.ts — declares the OffreaderFilesApi type
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const indexSrc = readFileSync(path.join(PROJECT_ROOT, 'electron/src/index.ts'), 'utf-8');
const setupSrc = readFileSync(path.join(PROJECT_ROOT, 'electron/src/setup.ts'), 'utf-8');
const preloadSrc = readFileSync(path.join(PROJECT_ROOT, 'electron/src/preload.ts'), 'utf-8');
const dtsSrc = readFileSync(path.join(PROJECT_ROOT, 'src/types/electron.d.ts'), 'utf-8');

describe('offreader-file scheme', () => {
  it('is registered privileged with fetch/stream support before app ready', () => {
    // registerSchemesAsPrivileged must run before app.whenReady() — it sits
    // at module top level, above the Run Application block.
    const registerIdx = indexSrc.indexOf('registerSchemesAsPrivileged');
    const readyIdx = indexSrc.indexOf('app.whenReady()');
    expect(registerIdx).toBeGreaterThan(-1);
    expect(registerIdx).toBeLessThan(readyIdx);
    expect(indexSrc).toContain("scheme: 'offreader-file'");
    expect(indexSrc).toContain('supportFetchAPI: true');
    expect(indexSrc).toContain('stream: true');
  });

  it('serves only whitelisted paths', () => {
    // The handler must consult the allowlist and refuse unknown paths —
    // otherwise offreader-file:// would be a read-anything primitive.
    expect(indexSrc).toContain("protocol.handle('offreader-file'");
    expect(indexSrc).toContain('allowedFilePaths.has(sourcePath)');
    expect(indexSrc).toContain("status: 403");
    expect(indexSrc).toContain('allowedFilePaths.add(sourcePath)');
  });

  it('streams via net.fetch(pathToFileURL)', () => {
    expect(indexSrc).toContain('net.fetch(pathToFileURL(sourcePath).toString())');
  });

  it('CSP allows connect-src to the scheme', () => {
    expect(setupSrc).toContain('offreader-file:');
    expect(setupSrc).toMatch(/connect-src[^;]*offreader-file:/);
  });
});

describe('file-access IPC', () => {
  it('exposes window.offreaderFiles from the preload', () => {
    expect(preloadSrc).toContain("exposeInMainWorld('offreaderFiles'");
    expect(preloadSrc).toContain("'offreader:pick-book-files'");
    expect(preloadSrc).toContain("'offreader:register-file-path'");
    expect(preloadSrc).toContain("'offreader:file-exists'");
    expect(preloadSrc).toContain("'offreader:stat-file'");
  });

  it('declares the API type in electron.d.ts', () => {
    expect(dtsSrc).toContain('OffreaderFilesApi');
    expect(dtsSrc).toContain('offreaderFiles?:');
  });
});

describe('folder sync', () => {
  it('main process scans recursively and filters to book formats', () => {
    expect(indexSrc).toContain("'offreader:scan-folder'");
    expect(indexSrc).toContain('BOOK_EXTENSIONS');
    expect(indexSrc).toContain('withFileTypes: true');
  });

  it('main process watches folders via chokidar with debounced events', () => {
    // fs.watch is not recursive on Linux — chokidar is required.
    expect(indexSrc).toContain('chokidar');
    expect(indexSrc).toContain("'offreader:watch-folder'");
    expect(indexSrc).toContain("'offreader:unwatch-folder'");
    expect(indexSrc).toContain("'offreader:folder-changed'");
    expect(indexSrc).toContain('ignoreInitial: true');
  });

  it('preload exposes directory picking, scanning, and watching', () => {
    expect(preloadSrc).toContain("'offreader:pick-directory'");
    expect(preloadSrc).toContain("'offreader:scan-folder'");
    expect(preloadSrc).toContain("'offreader:watch-folder'");
    expect(preloadSrc).toContain("'offreader:unwatch-folder'");
    expect(preloadSrc).toContain("'offreader:folder-changed'");
  });
});
