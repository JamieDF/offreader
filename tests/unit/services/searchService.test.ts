import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchService } from '@/services/searchService';
import { Book } from '@/types/book';

// Mock book data
const mockBook: Book = {
  id: 'test-book-123',
  title: 'Test Book',
  author: 'Test Author',
  coverImage: '',
  filePath: '/test/book.epub',
  format: 'EPUB',
  progress: 0,
  shelfId: null,
  labelIds: [],
};

// Mock view with spine
const createMockView = (chapters: Array<{ title: string; content: string; href: string }>) => {
  return {
    book: {
      spine: {
        items: chapters.map((ch, i) => ({
          href: ch.href,
          load: async () => ({
            body: {
              innerHTML: `<p>${ch.content}</p>`
            }
          })
        }))
      }
    }
  };
};

describe('searchService', () => {
  beforeEach(() => {
    searchService.clearIndex('test-book-123');
  });

  describe('buildSearchIndex', () => {
    it('should build index from EPUB spine', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'Hello world this is a test', href: 'chapter1.xhtml' },
        { title: 'Chapter 2', content: 'Another chapter with more text', href: 'chapter2.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);

      expect(searchService.hasIndex('test-book-123')).toBe(true);
    });

    it('should handle empty spine', async () => {
      const mockView = {
        book: {
          spine: {
            items: []
          }
        }
      };

      await searchService.buildSearchIndex(mockBook, mockView as any);

      expect(searchService.hasIndex('test-book-123')).toBe(true);
    });
  });

  describe('search', () => {
    it('should find matches in indexed book', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'The quick brown fox jumps over the lazy dog', href: 'ch1.xhtml' },
        { title: 'Chapter 2', content: 'A quick brown fox was seen running', href: 'ch2.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);

      const results = searchService.search('quick', { bookId: 'test-book-123' });

      expect(results.length).toBe(2);
      expect(results[0].chapterTitle).toBe('Chapter 1');
      expect(results[1].chapterTitle).toBe('Chapter 2');
    });

    it('should be case insensitive', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'HELLO World Hello WORLD', href: 'ch1.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);

      const results = searchService.search('hello', { bookId: 'test-book-123' });

      expect(results.length).toBe(2);
    });

    it('should return empty for empty query', () => {
      const results = searchService.search('', { bookId: 'test-book-123' });
      expect(results.length).toBe(0);
    });

    it('should return empty for non-existent term', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'Some text content', href: 'ch1.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);

      const results = searchService.search('nonexistent', { bookId: 'test-book-123' });
      expect(results.length).toBe(0);
    });

    it('should sort by chapter by default', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'word in chapter 1', href: 'ch1.xhtml' },
        { title: 'Chapter 2', content: 'word in chapter 2', href: 'ch2.xhtml' },
        { title: 'Chapter 3', content: 'word in chapter 3', href: 'ch3.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);

      const results = searchService.search('word', { bookId: 'test-book-123' });

      expect(results.length).toBe(3);
      expect(results[0].chapterIndex).toBe(0);
      expect(results[1].chapterIndex).toBe(1);
      expect(results[2].chapterIndex).toBe(2);
    });

    it('should sort by page when specified', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'page word here', href: 'ch1.xhtml' },
        { title: 'Chapter 2', content: 'page word here', href: 'ch2.xhtml' },
        { title: 'Chapter 3', content: 'page word here', href: 'ch3.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);

      const results = searchService.search('word', { bookId: 'test-book-123', sortBy: 'page' });

      expect(results.length).toBe(3);
      expect(results[0].page).toBe(1);
      expect(results[1].page).toBe(2);
      expect(results[2].page).toBe(3);
    });
  });

  describe('clearIndex', () => {
    it('should remove index for book', async () => {
      const mockView = createMockView([
        { title: 'Chapter 1', content: 'Some text', href: 'ch1.xhtml' },
      ]);

      await searchService.buildSearchIndex(mockBook, mockView as any);
      expect(searchService.hasIndex('test-book-123')).toBe(true);

      searchService.clearIndex('test-book-123');
      expect(searchService.hasIndex('test-book-123')).toBe(false);
    });
  });
});