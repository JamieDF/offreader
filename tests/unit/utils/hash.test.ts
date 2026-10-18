import { describe, it, expect } from 'vitest';
import { sha256Hex } from '@/utils/hash';

describe('sha256Hex', () => {
  it('matches the known SHA-256 vector for "abc"', async () => {
    const hash = await sha256Hex(new Blob(['abc']));
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('produces different hashes for different contents', async () => {
    const a = await sha256Hex(new Blob(['a']));
    const b = await sha256Hex(new Blob(['b']));
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
