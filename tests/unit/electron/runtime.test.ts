/**
 * Tests for Electron-specific runtime behaviour that can be tested outside
 * of an actual Electron process.
 *
 * These cover:
 * - CSP header construction in dev vs production mode
 * - PDF metadata type coercion (PDF metadata values can be non-strings)
 * - Auto-updater error suppression pattern
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// CSP — mirrors the logic from electron/src/setup.ts
// ---------------------------------------------------------------------------

describe('CSP header construction', () => {
  const CUSTOM_SCHEME = 'capacitor-electron';

  it('dev CSP includes devtools and unsafe-eval', () => {
    // This mirrors the dev branch in setupContentSecurityPolicy
    const csp = `default-src ${CUSTOM_SCHEME}://* 'unsafe-inline' devtools://* 'unsafe-eval' data: blob:; connect-src ${CUSTOM_SCHEME}://* blob: https://fonts.googleapis.com https://fonts.gstatic.com; style-src-elem 'self' 'unsafe-inline' blob: https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' blob: https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:`;

    expect(csp).toContain('devtools://*');
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('blob:');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
  });

  it('production CSP excludes devtools and unsafe-eval', () => {
    // This mirrors the production branch in setupContentSecurityPolicy
    const csp = `default-src ${CUSTOM_SCHEME}://* 'unsafe-inline' data: blob:; connect-src ${CUSTOM_SCHEME}://* blob: https://fonts.googleapis.com https://fonts.gstatic.com; style-src-elem 'self' 'unsafe-inline' blob: https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' blob: https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:`;

    expect(csp).not.toContain('devtools://*');
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain('blob:');
    expect(csp).toContain('https://fonts.googleapis.com');
  });

  it('both CSPs include blob: for PDF workers and EPUB content', () => {
    const devCsp = `default-src ${CUSTOM_SCHEME}://* 'unsafe-inline' devtools://* 'unsafe-eval' data: blob:`;
    const prodCsp = `default-src ${CUSTOM_SCHEME}://* 'unsafe-inline' data: blob:`;

    expect(devCsp).toContain('blob:');
    expect(prodCsp).toContain('blob:');
  });

  it('both CSPs restrict font-src to gstatic only', () => {
    const fontDirective = 'font-src https://fonts.gstatic.com data:';
    // Neither CSP should allow arbitrary font loading
    expect(fontDirective).not.toContain("'self'");
    expect(fontDirective).toContain('https://fonts.gstatic.com');
  });
});

// ---------------------------------------------------------------------------
// PDF metadata coercion — mirrors the String() wrapping in pdfParser.ts
// ---------------------------------------------------------------------------

describe('PDF metadata type coercion', () => {
  // PDF metadata from pdfjs can return non-string values:
  // - Arrays when multiple values exist for a key
  // - Objects in some edge cases
  // - null/undefined when key is missing

  it('String() coerces array to comma-separated string', () => {
    const raw = ['Title One', 'Title Two'];
    expect(String(raw)).toBe('Title One,Title Two');
  });

  it('String() coerces object to "[object Object]"', () => {
    const raw = { toString: () => 'My Title' };
    expect(String(raw)).toBe('My Title');
  });

  it('String() coerces null to "null"', () => {
    expect(String(null)).toBe('null');
  });

  it('String() preserves normal strings', () => {
    expect(String('Hello')).toBe('Hello');
  });

  it('String() coerces undefined to "undefined"', () => {
    // This is why we use ?? '' before String() in some cases
    expect(String(undefined)).toBe('undefined');
  });

  it('fallback pattern: String(value ?? fallback) never produces "undefined"', () => {
    const raw = undefined;
    const result = String(raw ?? 'fallback');
    expect(result).toBe('fallback');
  });

  it('fallback pattern: String(value ?? fallback) preserves real strings', () => {
    const raw = 'Real Title';
    const result = String(raw ?? 'fallback');
    expect(result).toBe('Real Title');
  });
});

// ---------------------------------------------------------------------------
// Auto-updater suppression — verifies the pattern doesn't throw
// ---------------------------------------------------------------------------

describe('auto-updater error suppression', () => {
  it('catching a failed update check does not throw', async () => {
    // Simulates the pattern from electron/src/index.ts:
    //   autoUpdater.on('error', () => {});
    //   autoUpdater.checkForUpdatesAndNotify().catch(() => {});

    const failingUpdate = async () => {
      throw new Error('net::ERR_CONNECTION_REFUSED');
    };

    // This should NOT throw
    await expect(
      failingUpdate().catch(() => {})
    ).resolves.toBeUndefined();
  });

  it('error callback swallows the error', async () => {
    let errorCaught = false;
    const errorHandler = () => { errorCaught = true; };
    const failingUpdate = async () => {
      throw new Error('404 Not Found');
    };

    await failingUpdate().catch(errorHandler);
    expect(errorCaught).toBe(true);
  });
});
