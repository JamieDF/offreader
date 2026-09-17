/**
 * CBZ comic archive parser.
 * Validates a ZIP archive and exposes supported image pages as metadata.
 */

import JSZip from 'jszip';
import { calculateReadingMetrics } from '@/utils/readingMetrics';

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

const imageExtension = (name: string): string | null => {
  const extension = name.split('.').pop()?.toLowerCase();
  return extension && IMAGE_TYPES[extension] ? extension : null;
};

export interface CbzMetadata {
  title: string;
  author: string;
  description?: string;
  chapters: { label: string; href: string; index: number }[];
  totalChapters: number;
  readingTime: string;
  pageCount: number;
  format: 'CBZ';
  coverImage?: string;
}

export const extractCbzMetadata = async (file: File): Promise<CbzMetadata> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error('Invalid CBZ file');
  }

  const pages = Object.keys(zip.files)
    .filter(name => !zip.files[name].dir && imageExtension(name))
    .sort(new Intl.Collator([], { numeric: true }).compare);

  if (pages.length === 0) throw new Error('Invalid CBZ file: no supported image files');

  const firstPage = pages[0];
  const firstPageData = await zip.file(firstPage)!.async('base64');
  const mediaType = IMAGE_TYPES[imageExtension(firstPage)!];
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  const { readingTime: byteBasedReadingTime } = calculateReadingMetrics(file.size);
  const readingTime = pages.length <= 1
    ? byteBasedReadingTime
    : `${Math.max(1, pages.length)}m`;

  return {
    title: fileName,
    author: 'Unknown Author',
    description: `A CBZ comic with ${pages.length} page${pages.length === 1 ? '' : 's'}.`,
    chapters: pages.map((page, index) => ({ label: page, href: page, index })),
    totalChapters: pages.length,
    readingTime,
    pageCount: pages.length,
    format: 'CBZ',
    coverImage: `data:${mediaType};base64,${firstPageData}`,
  };
};
