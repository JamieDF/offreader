import { Book } from '@/types/book';

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

async function extractTextFromPdfFile(pdfDoc: any): Promise<IndexedChapter[]> {
  const chapters: IndexedChapter[] = [];

  try {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
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
      const pdfDoc = view.book?.pdfDoc;
      if (pdfDoc) {
        chapters = await extractTextFromPdfFile(pdfDoc);
      }
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