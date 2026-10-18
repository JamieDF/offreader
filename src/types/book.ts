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
  /** SHA-256 of the file bytes: storage key in the content-addressed store.
   *  Absent on pre-migration records (file is keyed by `id` in the legacy store). */
  contentHash?: string;
  /** Where the file bytes live. 'managed' = app-owned store; 'linked' = read
   *  in place from sourcePath (Electron folder sync). Defaults to 'managed'. */
  source?: 'managed' | 'linked';
  /** Absolute path of a linked book's source file. */
  sourcePath?: string;
  /** Byte size of the linked source file at last scan: cheap identity for
   *  change/move detection before resorting to a content hash. */
  sourceSize?: number;
  /** mtime (ms) of the linked source file at last scan. */
  sourceMtimeMs?: number;
  /** Set at startup when a linked book's sourcePath can't be read: the book
   *  stays in the library (progress/metadata intact) and the reader offers a
   *  relink flow. Cleared on the next init once the file is reachable again. */
  missing?: boolean;
}

export interface Bookmark {
  id: string;
  /** CFI or href. */
  location: string;
  chapterTitle: string;
  /** 0-100 progress within book. */
  position: number;
  /** ISO timestamp. */
  createdAt: string;
  note?: string;
}
