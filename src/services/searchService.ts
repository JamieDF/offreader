import { Book } from '@/types/book';
import { fileStorage } from './fileStorage';

export interface SearchResult {
  text: string;
  matchStart: number;
  matchEnd: number;
  chapterTitle: string;
  chapterIndex: number;
  page: number;
  location: string;
}

interface IndexedChapter {
  title: string;
  index: number;
  text: string;
  location: string;
}

interface SearchIndex {
  bookId: string;
  chapters: IndexedChapter[];
  lastModified: number;
}

const indexCache = new Map<string, SearchIndex>();

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSnippet(text: string, matchStart: number, matchEnd: number, targetLength = 80): string {
  const queryLength = matchEnd - matchStart;
  const contextLength = Math.floor((targetLength - queryLength) / 2);

  let start = Math.max(0, matchStart - contextLength);
  let end = Math.min(text.length, matchEnd + contextLength);

  while (end - start < targetLength && start > 0) {
    start--;
  }
  while (end - start < targetLength && end < text.length) {
    end++;
  }

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

async function extractTextFromEpub(view: any): Promise<IndexedChapter[]> {
  const chapters: IndexedChapter[] = [];

  try {
    const book = view.book;
    if (!book) return chapters;

    let sections = book.sections || book.spine?.items;
    if (!sections || !sections.length) sections = [];
    if (!sections.length) return chapters;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;

      try {
        let doc = null;
        if (typeof section.createDocument === 'function') {
          doc = await section.createDocument().catch(() => null);
        } else if (typeof section.load === 'function') {
          doc = await section.load().catch(() => null);
        }
        const body = doc?.body || (doc?.getBody?.() || null);
        if (body && typeof body.innerHTML === 'string') {
          const text = stripHtml(body.innerHTML);
          if (text.length > 0) {
            chapters.push({
              title: section.label || section.title || `Chapter ${i + 1}`,
              index: i,
              text,
              location: section.href || section.id || section.cfi || `section-${i}`,
            });
          }
        }
      } catch {
        // skip problematic sections
      }
    }
  } catch {
    // skip extraction errors
  }

  return chapters;
}

async function extractTextFromPdf(view: any, libraryBook: Book): Promise<IndexedChapter[]> {
  const chapters: IndexedChapter[] = [];

  try {
    const book = view.book;
    if (!book) return chapters;

    const libraryNumPages = (libraryBook as any).numPages || (libraryBook as any).pageCount;
    const hasNumPages = typeof libraryNumPages === 'number' && libraryNumPages > 0;

    if (!hasNumPages && book.sections?.length) {
      for (let i = 0; i < book.sections.length; i++) {
        try {
          const section = book.sections[i];
          if (!section) continue;

          if (typeof section.load === 'function') {
            const src = await section.load();
            let url: string | null = null;
            if (typeof src === 'string') url = src;
            else if (src?.src) url = src.src;

            if (url) {
              try {
                const response = await fetch(url);
                const html = await response.text();
                const text = stripHtml(html);
                if (text.length > 0) {
                  chapters.push({
                    title: `Page ${i + 1}`,
                    index: i,
                    text,
                    location: `page-${i}`,
                  });
                }
              } catch {
                // skip
              }
            }
          }
        } catch {
          // skip
        }
      }
      return chapters;
    }

    const pageCount = libraryNumPages || book.numPages || 0;
    if (pageCount === 0) return chapters;

    let pdf = (book as any)._pdf || (book as any).pdf;
    if (!pdf && (view.renderer as any)?._pdf) {
      pdf = (view.renderer as any)._pdf;
    }
    if (!pdf) {
      if ((view as any)._pdf) pdf = (view as any)._pdf;
      else if ((book as any).pdfjs) pdf = (book as any).pdfjs;
      else if ((view.renderer as any)?.pdf) pdf = (view.renderer as any).pdf;
    }

    if (!pdf) {
      return extractTextFromPdfFile(view, libraryBook);
    }

    for (let i = 0; i < pageCount; i++) {
      try {
        const page = await pdf.getPage(i + 1);
        const content = await page.getTextContent();
        if (content?.items) {
          const text = content.items
            .map((item: any) => item.str || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length > 0) {
            chapters.push({
              title: `Page ${i + 1}`,
              index: i,
              text,
              location: `page-${i}`,
            });
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  return chapters;
}

async function extractTextFromPdfFile(view: any, libraryBook: Book): Promise<IndexedChapter[]> {
  const chapters: IndexedChapter[] = [];

  try {
    const pageCount = (libraryBook as any).numPages || (libraryBook as any).pageCount || 0;
    if (pageCount === 0) return chapters;

    const { pdfjsLib } = await import('foliate-js/pdfjs.js');
    const fileUrl = await fileStorage.retrieveFile(libraryBook.id, 'PDF');
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        if (content?.items) {
          const text = content.items
            .map((item: any) => item.str || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text.length > 0) {
            chapters.push({
              title: `Page ${i}`,
              index: i - 1,
              text,
              location: `page-${i - 1}`,
            });
          }
        }
      } catch {
        // skip
      }
    }

    await pdf.destroy();
  } catch {
    // skip
  }

  return chapters;
}

async function extractTextFromMobi(view: any): Promise<IndexedChapter[]> {
  return extractTextFromEpub(view);
}

export const searchService = {
  async buildSearchIndex(book: Book, view: any, passLibraryBook?: Book): Promise<void> {
    if (!view?.book) return;

    const libraryBook = passLibraryBook || book;
    const existing = indexCache.get(book.id);
    const bookModified = (book as any).lastModified;

    if (existing && existing.lastModified === bookModified && existing.chapters.length > 0) {
      return;
    }

    let chapters: IndexedChapter[] = [];

    if (libraryBook.format === 'PDF') {
      chapters = await extractTextFromPdf(view, libraryBook);
    } else if (libraryBook.format === 'MOBI') {
      chapters = await extractTextFromMobi(view);
    } else {
      chapters = await extractTextFromEpub(view);
    }

    indexCache.set(book.id, {
      bookId: book.id,
      chapters,
      lastModified: bookModified || Date.now(),
    });
  },

  search(query: string, options?: { sortBy?: 'page' | 'chapter', bookId?: string }): SearchResult[] {
    if (!query.trim()) return [];

    let cache: SearchIndex | undefined;
    const targetBookId = options?.bookId;
    if (targetBookId) {
      cache = indexCache.get(targetBookId);
    }
    if (!cache) {
      cache = Array.from(indexCache.values()).pop();
    }
    if (!cache || cache.chapters.length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const chapter of cache.chapters) {
      let searchStart = 0;
      let matchIdx: number;

      while ((matchIdx = chapter.text.toLowerCase().indexOf(lowerQuery, searchStart)) !== -1) {
        const matchEnd = matchIdx + query.length;
        const snippet = extractSnippet(chapter.text, matchIdx, matchEnd);

        results.push({
          text: snippet,
          matchStart: matchIdx > 0 ? matchIdx - (snippet.startsWith('...') ? 3 : 0) : 0,
          matchEnd: matchEnd,
          chapterTitle: chapter.title,
          chapterIndex: chapter.index,
          page: chapter.index + 1,
          location: chapter.location,
        });

        searchStart = matchEnd;
      }
    }

    return results;
  },

  clearIndex(bookId: string): void {
    indexCache.delete(bookId);
  },

  hasIndex(bookId: string): boolean {
    return indexCache.has(bookId);
  },
};