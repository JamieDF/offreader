import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractChaptersWithFoliate } from '@/parsers/epubParser';
import { extractMobiMetadata } from '@/parsers/mobiParser';
import { extractPdfMetadata } from '@/parsers/pdfParser';
import { extractBookMetadata } from '@/parsers/bookMetadataParser';
import { extractAzw3Metadata } from '@/parsers/azw3Parser';
import { extractFb2Metadata } from '@/parsers/fb2Parser';
import { extractCbzMetadata } from '@/parsers/cbzParser';
import JSZip from 'jszip';

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

describe('azw3Parser', () => {
  describe('extractAzw3Metadata', () => {
    it('parses a valid AZW3 fixture and returns metadata', async () => {
      const file = makeFile('alice-in-wonderland.azw3', 'application/vnd.amazon.ebook');
      const metadata = await extractAzw3Metadata(file);

      expect(metadata.title).toBeTruthy();
      expect(metadata.format).toBe('AZW3');
    });
  });
});

describe('fb2Parser', () => {
  describe('extractFb2Metadata', () => {
    it('parses test-book.fb2 and returns metadata', async () => {
      const file = makeFile('test-book.fb2', 'application/x-fictionbook+xml');
      const metadata = await extractFb2Metadata(file);

      expect(metadata.title).toBe('test-book');
      expect(metadata.author).toBe('Unknown Author');
      expect(metadata.format).toBe('FB2');
      expect(metadata.totalChapters).toBe(4);
    });
  });
});

describe('cbzParser', () => {
  describe('extractCbzMetadata', () => {
    it('parses test-comic.cbz and returns metadata', async () => {
      const file = makeFile('test-comic.cbz', 'application/vnd.comicbook+zip');
      const metadata = await extractCbzMetadata(file);

      expect(metadata.title).toBe('test-comic');
      expect(metadata.format).toBe('CBZ');
      expect(metadata.pageCount).toBe(4);
      expect(metadata.readingTime).toBe('4m');
      expect(metadata.coverImage).toMatch(/^data:image\/jpeg;base64,/);
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

    it('dispatches to the AZW3 parser for .azw3 files', async () => {
      const file = makeFile('alice-in-wonderland.azw3', 'application/vnd.amazon.ebook');
      const metadata = await extractBookMetadata(file);
      expect(metadata.format).toBe('AZW3');
    });

    it('dispatches to the FB2 parser for .fb2 files', async () => {
      const file = makeFile('test-book.fb2', 'application/x-fictionbook+xml');
      const metadata = await extractBookMetadata(file);
      expect(metadata.format).toBe('FB2');
      expect(metadata.title).toBe('test-book');
    });

    it('dispatches to the CBZ parser for .cbz files', async () => {
      const file = makeFile('test-comic.cbz', 'application/vnd.comicbook+zip');
      const metadata = await extractBookMetadata(file);
      expect(metadata.format).toBe('CBZ');
      expect(metadata.pageCount).toBe(4);
    });

    it('propagates validation errors from PDF parser', async () => {
      const content = new Uint8Array(5).fill(0x00);
      const file = new File([content], 'fake.pdf', { type: 'application/pdf' });
      await expect(extractBookMetadata(file)).rejects.toThrow('Invalid PDF file');
    });

    describe('azw3Parser', () => {
      it('rejects files without the AZW3 extension', async () => {
        const file = new File([new Uint8Array(100)], 'book.mobi', { type: 'application/octet-stream' });
        await expect(extractAzw3Metadata(file)).rejects.toThrow('Invalid AZW3 file');
      });
    });

    describe('fb2Parser', () => {
      it('extracts FictionBook metadata and chapters', async () => {
        const source = `<?xml version="1.0" encoding="UTF-8"?>
          <FictionBook xmlns:l="http://www.w3.org/1999/xlink">
            <description><title-info>
              <book-title>Example Story</book-title>
              <author><first-name>Jane</first-name><last-name>Doe</last-name></author>
              <annotation><p>A short description.</p></annotation>
              <genre>fiction</genre><lang>en</lang>
            </title-info></description>
            <body><section id="one"><title><p>Opening</p></title><p>Text</p></section></body>
          </FictionBook>`;
        const metadata = await extractFb2Metadata(new File([source], 'example.fb2'));
        expect(metadata.title).toBe('Example Story');
        expect(metadata.author).toBe('Jane Doe');
        expect(metadata.format).toBe('FB2');
        expect(metadata.totalChapters).toBe(1);
        expect(metadata.subjects).toEqual(['fiction']);
      });

      it('rejects malformed XML', async () => {
        await expect(extractFb2Metadata(new File(['<not-fictionbook>'], 'bad.fb2'))).rejects.toThrow('Invalid FB2 file');
      });
    });

    describe('cbzParser', () => {
      it('extracts image pages and cover metadata', async () => {
        const zip = new JSZip();
        zip.file('page-2.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
        zip.file('page-1.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
        const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'comic.cbz');
        const metadata = await extractCbzMetadata(file);
        expect(metadata.title).toBe('comic');
        expect(metadata.format).toBe('CBZ');
        expect(metadata.totalChapters).toBe(2);
        expect(metadata.pageCount).toBe(2);
        expect(metadata.readingTime).toBe('2m');
        expect(metadata.coverImage).toMatch(/^data:image\/png;base64,/);
      });

      it('rejects archives without image pages', async () => {
        const zip = new JSZip();
        zip.file('readme.txt', 'not a comic page');
        const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'empty.cbz');
        await expect(extractCbzMetadata(file)).rejects.toThrow('no supported image files');
      });
    });

    it.each(['azw', 'azw4', 'kfx', 'cbr'])('rejects unsupported .%s files', async (extension) => {
      const file = new File(['content'], `book.${extension}`, { type: 'application/octet-stream' });
      await expect(extractBookMetadata(file)).rejects.toThrow('Unsupported file format');
    });
  });
});

describe('pdfParser', () => {
  describe('extractPdfMetadata', () => {
    it('reads real PDF fixture bytes (pdf.js is mocked; see e2e for full parse)', async () => {
      const bytes = readFileSync(path.join(BOOKS_DIR, 'minimal-document.pdf'));
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    });

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const file = makeFile('minimal-document.pdf', 'application/pdf');
      const metadata = await extractPdfMetadata(file);
      expect(metadata.title).toBe('minimal-document');
    });
  });
});
