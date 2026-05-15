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

  // Extend to fill target length
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

    // Try book.sections first (foliate-js uses this)
    let sections = book.sections;
    if (!sections || !sections.length) {
      sections = [];
    }

    console.log('[SearchService] sections count:', sections.length);
    if (!sections.length) return chapters;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section) continue;

      try {
        // Try createDocument (foliate-js method)
        const doc = await section.createDocument();
        if (doc?.body) {
          const text = stripHtml(doc.body.innerHTML);
          if (text.length > 0) {
            chapters.push({
              title: section.label || section.title || `Chapter ${i + 1}`,
              index: i,
              text,
              location: section.href || section.id || section.cfi || `section-${i}`,
            });
          }
        }
      } catch (err) {
        console.warn('[SearchService] Failed to load section:', err);
      }
    }
  } catch (e) {
    console.warn('[SearchService] Failed to extract EPUB text:', e);
  }

  return chapters;
}

async function extractTextFromPdf(view: any): Promise<IndexedChapter[]> {
  const chapters: IndexedChapter[] = [];

  try {
    const renderer = view.renderer;
    if (!renderer) return chapters;

    // PDF pages as chapters
    const pageCount = await renderer.getPageCount?.() || 0;
    for (let i = 0; i < pageCount; i++) {
      try {
        const page = await renderer.loadPage(i);
        const content = await page.getTextContent?.();
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
        // Skip pages that fail
      }
    }
  } catch (e) {
    console.warn('Failed to extract PDF text:', e);
  }

  return chapters;
}

async function extractTextFromMobi(view: any): Promise<IndexedChapter[]> {
  // MOBI uses same spine-based extraction as EPUB
  return extractTextFromEpub(view);
}

export const searchService = {
  async buildSearchIndex(book: Book, view: any): Promise<void> {
    if (!view?.book) {
      console.warn('[SearchService] No view.book');
      return;
    }

    const existing = indexCache.get(book.id);
    const bookModified = (book as any).lastModified;

    // Re-index if no existing index, no lastModified, or existing has 0 chapters
    const shouldReindex = !existing || !existing.chapters.length ||
      (!bookModified && existing.chapters.length === 0);

    if (existing && existing.lastModified === bookModified && existing.chapters.length > 0) {
      return; // Already indexed with content
    }

    let chapters: IndexedChapter[] = [];

    if (book.format === 'PDF') {
      chapters = await extractTextFromPdf(view);
    } else if (book.format === 'MOBI') {
      chapters = await extractTextFromMobi(view);
    } else {
      // EPUB default
      chapters = await extractTextFromEpub(view);
    }

    console.log('[SearchService] Indexed', chapters.length, 'chapters for', book.id, book.title);
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
      console.warn('[SearchService] No index found, cached keys:', Array.from(indexCache.keys()));
      return [];
    }

    console.log('[SearchService] Found index with', cache.chapters.length, 'chapters, searching for:', query);
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
          page: chapter.index + 1, // 1-indexed
          location: chapter.location,
        });

        console.log('[SearchService] Result location:', chapter.location);

searchStart = matchEnd;
      }
    }

    console.log('[SearchService] Search for "', query, '" found', results.length, 'results');
    return results;
  },

  clearIndex(bookId: string): void {
    indexCache.delete(bookId);
  },

  hasIndex(bookId: string): boolean {
    return indexCache.has(bookId);
  },
};