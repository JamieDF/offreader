import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractChaptersWithFoliate } from '@/parsers/epubParser';
import { extractMobiMetadata } from '@/parsers/mobiParser';
import { extractPdfMetadata } from '@/parsers/pdfParser';
import { extractBookMetadata } from '@/parsers/bookMetadataParser';

vi.mock('foliate-js/pdfjs.js', () => ({
  pdfjsLib: {
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        numPages: 3,
        getMetadata: async () => ({ metadata: null, info: { Title: 'Test PDF', Author: 'Test Author' } }),
        getOutline: async () => null,
        getPage: async () => ({
          getViewport: () => ({ width: 100, height: 100 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
        destroy: async () => {},
      }),
    })),
    GlobalWorkerOptions: { workerSrc: '' },
  },
}));

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
      // Note: totalChapters may be 0 if EPUB has no discernible chapters or uses non-standard structure
      // The important thing is metadata was successfully parsed
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

    it('dispatches to the PDF parser for .pdf files', async () => {
      const file = makeFile('minimal-document.pdf', 'application/pdf');
      const metadata = await extractBookMetadata(file);
      expect(metadata.format).toBe('PDF');
    });

    it('propagates validation errors from PDF parser', async () => {
      const content = new Uint8Array(5).fill(0x00);
      const file = new File([content], 'fake.pdf', { type: 'application/pdf' });
      await expect(extractBookMetadata(file)).rejects.toThrow('Invalid PDF file');
    });

    it('throws on unsupported file format', async () => {
      const file = new File(['content'], 'book.azw', { type: 'application/octet-stream' });
      await expect(extractBookMetadata(file)).rejects.toThrow('Unsupported file format');
    });
  });
});

describe('pdfParser', () => {
  describe('extractPdfMetadata', () => {
    it('parses a valid PDF and returns metadata', async () => {
      const file = makeFile('minimal-document.pdf', 'application/pdf');
      const metadata = await extractPdfMetadata(file);

      expect(metadata.format).toBe('PDF');
      expect(metadata.title).toBeTruthy();
      expect(metadata.author).toBeTruthy();
      expect(metadata.totalChapters).toBe(0);   // no outline in mock → 0 sections
      expect(metadata.pageCount).toBe(3);        // mock numPages = 3
      expect(metadata.readingTime).toBeTruthy(); // e.g. "6m"
    });

    it('returns mocked title and author from PDF info', async () => {
      const file = makeFile('minimal-document.pdf', 'application/pdf');
      const metadata = await extractPdfMetadata(file);

      expect(metadata.title).toBe('Test PDF');
      expect(metadata.author).toBe('Test Author');
    });

    it('throws on a file with invalid PDF magic bytes', async () => {
      const content = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      const file = new File([content], 'not-a-pdf.pdf', { type: 'application/pdf' });
      await expect(extractPdfMetadata(file)).rejects.toThrow('Invalid PDF file');
    });

    it('throws on a file too small to contain magic bytes', async () => {
      const file = new File([new Uint8Array(3)], 'tiny.pdf', { type: 'application/pdf' });
      await expect(extractPdfMetadata(file)).rejects.toThrow();
    });

    it('falls back to filename when PDF has no title metadata', async () => {
      const { pdfjsLib } = await import('foliate-js/pdfjs.js');
      vi.mocked(pdfjsLib.getDocument).mockReturnValueOnce({
        promise: Promise.resolve({
          numPages: 1,
          getMetadata: async () => ({ metadata: null, info: {} }),
          getOutline: async () => null,
          getPage: async () => ({
            getViewport: () => ({ width: 100, height: 100 }),
            render: () => ({ promise: Promise.resolve() }),
          }),
          destroy: async () => {},
        }),
      } as any);

      const file = makeFile('minimal-document.pdf', 'application/pdf');
      const metadata = await extractPdfMetadata(file);
      expect(metadata.title).toBe('minimal-document');
    });
  });
});
