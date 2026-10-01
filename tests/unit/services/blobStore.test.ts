import { describe, it, expect, beforeEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { blobStore } from '@/services/blobStore';

// Node's Blob clones correctly through fake-indexeddb's structuredClone
// (jsdom's Blob would degrade to a plain object).
const nodeBlob = (parts: string[]) => new NodeBlob(parts) as unknown as Blob;

beforeEach(async () => {
  for (const key of await blobStore.keys()) {
    await blobStore.delete(String(key));
  }
});

describe('blobStore (fake-indexeddb)', () => {
  it('round-trips a blob by key', async () => {
    await blobStore.put('hash.epub', nodeBlob(['book-bytes']));
    const blob = await blobStore.get('hash.epub');
    expect(blob?.size).toBe(10);
  });

  it('has() reports existence without returning the value', async () => {
    await blobStore.put('a.epub', nodeBlob(['x']));
    expect(await blobStore.has('a.epub')).toBe(true);
    expect(await blobStore.has('b.epub')).toBe(false);
  });

  it('delete() removes the key', async () => {
    await blobStore.put('a.epub', nodeBlob(['x']));
    await blobStore.delete('a.epub');
    expect(await blobStore.has('a.epub')).toBe(false);
  });

  it('keys() lists stored keys', async () => {
    await blobStore.put('a.epub', nodeBlob(['x']));
    await blobStore.put('b.pdf', nodeBlob(['y']));
    expect((await blobStore.keys()).sort()).toEqual(['a.epub', 'b.pdf']);
  });
});
