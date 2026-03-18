/**
 * Dispatches book metadata extraction to the correct format-specific parser.
 */

import { extractChaptersWithFoliate, EpubMetadata } from './epubParser';
import { extractMobiMetadata, MobiMetadata } from './mobiParser';

export type BookMetadata = EpubMetadata | MobiMetadata;

export const extractBookMetadata = async (file: File): Promise<BookMetadata> => {
  try {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'epub') {
      return await extractChaptersWithFoliate(file);
    } else if (fileExtension === 'mobi') {
      return await extractMobiMetadata(file);
    } else {
      // Fallback for unknown formats
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Author',
        chapters: [],
        totalChapters: 0,
        format: fileExtension?.toUpperCase() || 'Unknown'
      };
    }
  } catch (error) {
    console.error('Failed to extract book metadata:', error);
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      author: 'Unknown Author',
      chapters: [],
      totalChapters: 0,
      format: file.name.split('.').pop()?.toUpperCase() || 'Unknown'
    };
  }
};
