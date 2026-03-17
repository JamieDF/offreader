export interface Chapter {
  label: string;
  href: string;
  cfi?: string;
  index: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  filePath: string;
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
}
