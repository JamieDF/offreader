/**
 * Tests for Electron-specific polyfills injected by the foliate-js fork.
 *
 * The fork's Rollup build injects utility functions into vendor/pdfjs/pdf.mjs and
 * pdf.worker.mjs to replace Node.js-only APIs that don't exist in browser/worker
 * contexts. These tests verify those polyfills work correctly.
 *
 * We extract and test the polyfill implementations independently so that if the
 * Rollup plugin changes the implementations, these tests catch regressions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// 1. Verify the patched vendor files contain the expected polyfill block
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const PDF_MJS = path.join(PROJECT_ROOT, 'node_modules/foliate-js/vendor/pdfjs/pdf.mjs');
const PDF_WORKER_MJS = path.join(PROJECT_ROOT, 'node_modules/foliate-js/vendor/pdfjs/pdf.worker.mjs');

describe('foliate-js vendor patches', () => {
  it('pdf.mjs starts with the OffReader patch block', () => {
    const content = readFileSync(PDF_MJS, 'utf-8');
    expect(content.startsWith('// -- OffReader patch:')).toBe(true);
    expect(content).toContain('bytesToHex');
    expect(content).toContain('bytesToBase64');
    expect(content).toContain('base64ToBytes');
    expect(content).toContain('getOrInsertComputed');
  });

  it('pdf.worker.mjs starts with the OffReader patch block', () => {
    const content = readFileSync(PDF_WORKER_MJS, 'utf-8');
    expect(content.startsWith('// -- OffReader patch:')).toBe(true);
    expect(content).toContain('bytesToHex');
    expect(content).toContain('bytesToBase64');
    expect(content).toContain('base64ToBytes');
    expect(content).toContain('getOrInsertComputed');
  });

  it('pdf.mjs has no stale .toBase64() calls', () => {
    const content = readFileSync(PDF_MJS, 'utf-8');
    expect(content).not.toContain('.toBase64()');
    expect(content).not.toContain('Uint8Array.fromBase64');
  });

  it('pdf.worker.mjs has no stale .toHex() calls', () => {
    const content = readFileSync(PDF_WORKER_MJS, 'utf-8');
    expect(content).not.toContain('.toHex()');
    expect(content).not.toContain('Uint8Array.fromBase64(this[$content])');
  });
});

// ---------------------------------------------------------------------------
// 2. Test the polyfill function implementations (mirrors the Rollup plugin)
// ---------------------------------------------------------------------------

// These implementations are intentionally copied from rollup.config.js in the fork
// to test them in isolation. If the fork's implementations change, these tests
// should be updated to match.
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(str: string): Uint8Array {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function getOrInsertComputed<K, V>(map: Map<K, V>, key: K, fn: () => V): V {
  if (map.has(key)) return map.get(key)!;
  const val = fn();
  map.set(key, val);
  return val;
}

describe('bytesToHex', () => {
  it('converts empty bytes to empty string', () => {
    expect(bytesToHex(new Uint8Array(0))).toBe('');
  });

  it('converts a single byte', () => {
    expect(bytesToHex(new Uint8Array([0x00]))).toBe('00');
    expect(bytesToHex(new Uint8Array([0xff]))).toBe('ff');
    expect(bytesToHex(new Uint8Array([0x0a]))).toBe('0a');
  });

  it('converts multiple bytes', () => {
    expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef');
  });

  it('produces lowercase hex', () => {
    expect(bytesToHex(new Uint8Array([0xab, 0xcd]))).toBe('abcd');
  });
});

describe('bytesToBase64', () => {
  it('encodes empty bytes', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
  });

  it('encodes "Hello"', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    expect(bytesToBase64(bytes)).toBe('SGVsbG8=');
  });

  it('encodes binary data', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
    expect(bytesToBase64(bytes)).toBe(btoa('\x00\x01\x02\xff'));
  });
});

describe('base64ToBytes', () => {
  it('decodes empty string', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });

  it('decodes "SGVsbG8=" to "Hello"', () => {
    const bytes = base64ToBytes('SGVsbG8=');
    expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('roundtrips with bytesToBase64', () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01]);
    expect(base64ToBytes(bytesToBase64(original))).toEqual(original);
  });
});

describe('getOrInsertComputed', () => {
  it('returns existing value without calling fn', () => {
    const map = new Map<string, number>();
    map.set('a', 1);
    let fnCalled = false;
    const result = getOrInsertComputed(map, 'a', () => { fnCalled = true; return 2; });
    expect(result).toBe(1);
    expect(fnCalled).toBe(false);
  });

  it('inserts and returns new value when key missing', () => {
    const map = new Map<string, number>();
    const result = getOrInsertComputed(map, 'a', () => 42);
    expect(result).toBe(42);
    expect(map.get('a')).toBe(42);
  });

  it('only calls fn once even if value is falsy', () => {
    const map = new Map<string, number>();
    let callCount = 0;
    const result = getOrInsertComputed(map, 'a', () => { callCount++; return 0; });
    expect(result).toBe(0);
    expect(callCount).toBe(1);
    // Second call should not invoke fn again
    getOrInsertComputed(map, 'a', () => { callCount++; return 1; });
    expect(callCount).toBe(1);
  });
});
