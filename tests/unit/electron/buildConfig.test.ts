/**
 * Production-grade tests for Electron build configuration.
 *
 * These tests verify that:
 * - package.json files have correct, complete build configuration
 * - Build scripts exist and are properly configured
 * - The electron platform scaffold is intact
 * - Required dependencies are present
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync as readFile } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

function readJson(filepath: string): Record<string, unknown> {
  return JSON.parse(readFile(filepath, 'utf-8'));
}

describe('electron/package.json', () => {
  const pkg = readJson(path.join(PROJECT_ROOT, 'electron/package.json'));

  describe('required fields', () => {
    it('has a non-empty name', () => {
      expect(pkg.name).toBeTruthy();
      expect(typeof pkg.name).toBe('string');
      expect(pkg.name.length).toBeGreaterThan(0);
    });

    it('has a version', () => {
      expect(pkg.version).toBeTruthy();
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('has a license', () => {
      expect(pkg.license).toBeTruthy();
    });
  });

  describe('author field (required for RPM/DEB)', () => {
    it('has an author block', () => {
      expect(pkg.author).toBeTruthy();
    });

    it('has non-empty author.name', () => {
      expect(pkg.author?.name).toBeTruthy();
      expect(pkg.author?.name?.length).toBeGreaterThan(0);
    });

    it('has non-empty author.email', () => {
      expect(pkg.author?.email).toBeTruthy();
      expect(pkg.author?.email?.length).toBeGreaterThan(0);
      expect(pkg.author?.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    });
  });

  describe('electron build config', () => {
    it('has a build section', () => {
      expect(pkg.build).toBeTruthy();
    });

    it('has appId', () => {
      expect(pkg.build?.appId).toBeTruthy();
      expect(pkg.build?.appId).toMatch(/^[a-z][a-z0-9-.]+$/);
    });

    it('has productName', () => {
      expect(pkg.build?.productName).toBeTruthy();
      expect(pkg.build?.productName).toBe('OffReader');
    });

    it('has linux.target array', () => {
      expect(Array.isArray(pkg.build?.linux?.target)).toBe(true);
      expect(pkg.build?.linux?.target).toContain('AppImage');
    });

    it('has linux.category', () => {
      expect(pkg.build?.linux?.category).toBeTruthy();
    });

    it('has output directory configured', () => {
      expect(pkg.build?.directories?.output).toBe('../dist-electron');
    });

    it('has build files include app and assets', () => {
      const files = pkg.build?.files ?? [];
      expect(files).toContain('app/**/*');
      expect(files).toContain('assets/**/*');
    });
  });

  describe('scripts', () => {
    it('has build script', () => {
      expect(pkg.scripts?.build).toBeTruthy();
    });

    it('has electron:start script', () => {
      expect(pkg.scripts?.['electron:start']).toBeTruthy();
    });
  });

  describe('electron-specific dependencies', () => {
    it('has @capacitor-community/electron', () => {
      expect(pkg.dependencies?.['@capacitor-community/electron']).toBeTruthy();
    });

    it('has electron-updater', () => {
      expect(pkg.dependencies?.['electron-updater']).toBeTruthy();
    });

    it('has electron-is-dev', () => {
      expect(pkg.dependencies?.['electron-is-dev']).toBeTruthy();
    });

    it('has electron-serve', () => {
      expect(pkg.dependencies?.['electron-serve']).toBeTruthy();
    });

    it('has electron-builder as devDependency', () => {
      expect(pkg.devDependencies?.['electron-builder']).toBeTruthy();
    });

    it('has electron as devDependency', () => {
      expect(pkg.devDependencies?.electron).toBeTruthy();
    });
  });
});

describe('root package.json electron scripts', () => {
  const rootPkg = readJson(path.join(PROJECT_ROOT, 'package.json'));
  const scripts = rootPkg.scripts ?? {};

  it('has electron:dev script', () => {
    expect(scripts['electron:dev']).toBeTruthy();
    expect(scripts['electron:dev']).toContain('electron');
  });

  it('has electron:build script', () => {
    expect(scripts['electron:build']).toBeTruthy();
    expect(scripts['electron:build']).toContain('electron');
  });

  it('has electron:build:appimage script', () => {
    expect(scripts['electron:build:appimage']).toBeTruthy();
    expect(scripts['electron:build:appimage']).toContain('AppImage');
  });

  it('has electron:build:rpm script', () => {
    expect(scripts['electron:build:rpm']).toBeTruthy();
    expect(scripts['electron:build:rpm']).toContain('rpm');
  });

  it('has electron:build:deb script', () => {
    expect(scripts['electron:build:deb']).toBeTruthy();
    expect(scripts['electron:build:deb']).toContain('deb');
  });
});

describe('electron platform scaffold', () => {
  const scaffoldFiles = [
    'electron/src/index.ts',
    'electron/src/preload.ts',
    'electron/src/setup.ts',
  ];

  it.each(scaffoldFiles)('%s exists', (file) => {
    expect(existsSync(path.join(PROJECT_ROOT, file))).toBe(true);
  });

  it('electron/src/setup.ts exports setupContentSecurityPolicy', () => {
    const content = readFileSync(path.join(PROJECT_ROOT, 'electron/src/setup.ts'), 'utf-8');
    expect(content).toContain('setupContentSecurityPolicy');
    expect(content).toContain('ElectronCapacitorApp');
  });

  it('electron/src/index.ts sets up CSP and auto-updater', () => {
    const content = readFileSync(path.join(PROJECT_ROOT, 'electron/src/index.ts'), 'utf-8');
    expect(content).toContain('setupContentSecurityPolicy');
    expect(content).toContain('autoUpdater');
    expect(content).toContain("logger = { info: () => {}, warn: () => {}, error: () => {} }");
  });

  it('electron/src/index.ts suppresses auto-updater errors', () => {
    const content = readFileSync(path.join(PROJECT_ROOT, 'electron/src/index.ts'), 'utf-8');
    // Should silently handle missing GitHub releases (no throw)
    expect(content).toContain("autoUpdater.on('error', () => {})");
    expect(content).toContain('.catch(() => {})');
  });
});

describe('version consistency', () => {
  const rootPkg = readJson(path.join(PROJECT_ROOT, 'package.json'));
  const electronPkg = readJson(path.join(PROJECT_ROOT, 'electron/package.json'));

  it('root and electron package.json versions match', () => {
    expect(rootPkg.version).toBe(electronPkg.version);
  });

  it('electron builder version is ^26.0.0', () => {
    expect(electronPkg.devDependencies?.['electron-builder']).toMatch(/^\^?26/);
  });

  it('electron version is ^33.0.0', () => {
    expect(electronPkg.devDependencies?.electron).toMatch(/^\^?33/);
  });
});
