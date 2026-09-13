export interface Chapter {
  label: string;
  href: string;
  cfi?: string;
  index: number;
  depth?: number;
}

export interface SearchResult {
  text: string;
  matchStart: number;
  matchEnd: number;
  chapterTitle: string;
  chapterIndex: number;
  page: number;
  location: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Shelf {
  id: string;
  name: string;
  isDefault: boolean;
  order: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  filePath: string;
  format?: 'EPUB' | 'MOBI' | 'PDF' | 'AZW3' | 'FB2' | 'CBZ';
  progress: number; // 0-100
  description?: string;
  totalChapters?: number;
  fileSize?: string;
  chapters?: Chapter[];
  currentLocation?: string; // CFI or href for resume position
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  subjects?: string[];
  rights?: string;
  estimatedReadingTime?: string; // e.g., "4h 30m"
  pageCount?: number; // Estimated page count
  shelfId: string | null;
  labelIds: string[];
}
