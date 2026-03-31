import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractChaptersWithFoliate } from '@/parsers/epubParser';
import { extractMobiMetadata } from '@/parsers/mobiParser';
import { extractBookMetadata } from '@/parsers/bookMetadataParser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = path.resolve(__dirname, '../../books');

function makeFile(filename: string, type: string): File {
  const buffer = readFileSync(path.join(BOOKS_DIR, filename));
  return new File([buffer], filename, { type });
}

describe('epubParser', () => {
  describe('extractChaptersWithFoliate', () => {
    it('parses a valid EPUB and returns metadata', async () => {
      const file = makeFile('alice-in-wonderland.epub', 'application/epub+zip');
      const metadata = await extractChaptersWithFoliate(file);

      expect(metadata.title).toBeTruthy();
      expect(metadata.author).toBeTruthy();
      expect(metadata.format).toBe('EPUB');
      expect(metadata.totalChapters).toBeGreaterThan(0);
    });

    it('throws on a file that is not a ZIP archive', async () => {
      const file = makeFile('bad-file.epub', 'application/epub+zip');
      await expect(extractChaptersWithFoliate(file)).rejects.toThrow('Invalid EPUB file');
    });
  });
});

describe('mobiParser', () => {
  describe('extractMobiMetadata', () => {
    it('parses a valid MOBI and returns metadata', async () => {
      const file = makeFile('alice-in-wonderland.mobi', 'application/x-mobipocket-ebook');
      const metadata = await extractMobiMetadata(file);

      expect(metadata.title).toBeTruthy();
      expect(metadata.format).toBe('MOBI');
    });

    it('throws on a file that is not a MOBI archive', async () => {
      const file = makeFile('bad-file.mobi', 'application/x-mobipocket-ebook');
      await expect(extractMobiMetadata(file)).rejects.toThrow('Invalid MOBI file');
    });

    it('throws on a file that is too small to contain a MOBI header', async () => {
      const file = new File([new Uint8Array(10)], 'tiny.mobi', { type: 'application/x-mobipocket-ebook' });
      await expect(extractMobiMetadata(file)).rejects.toThrow('Invalid MOBI file');
    });
  });
});

describe('bookMetadataParser', () => {
  describe('extractBookMetadata', () => {
    it('dispatches to the EPUB parser for .epub files', async () => {
      const file = makeFile('alice-in-wonderland.epub', 'application/epub+zip');
      const metadata = await extractBookMetadata(file);
      expect(metadata.format).toBe('EPUB');
    });

    it('dispatches to the MOBI parser for .mobi files', async () => {
      const file = makeFile('alice-in-wonderland.mobi', 'application/x-mobipocket-ebook');
      const metadata = await extractBookMetadata(file);
      expect(metadata.format).toBe('MOBI');
    });

    it('propagates validation errors from EPUB parser', async () => {
      const file = makeFile('bad-file.epub', 'application/epub+zip');
      await expect(extractBookMetadata(file)).rejects.toThrow('Invalid EPUB file');
    });

    it('propagates validation errors from MOBI parser', async () => {
      const content = new Uint8Array(100).fill(0x41);
      const file = new File([content], 'fake.mobi', { type: 'application/x-mobipocket-ebook' });
      await expect(extractBookMetadata(file)).rejects.toThrow('Invalid MOBI file');
    });
  });
});
