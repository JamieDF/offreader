/**
 * Dispatches book metadata extraction to the correct format-specific parser.
 */

import { extractChaptersWithFoliate, EpubMetadata } from './epubParser';
import { extractMobiMetadata, MobiMetadata } from './mobiParser';

export type BookMetadata = EpubMetadata | MobiMetadata;

export const extractBookMetadata = async (file: File): Promise<BookMetadata> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  if (fileExtension === 'epub') {
    return await extractChaptersWithFoliate(file);
  } else if (fileExtension === 'mobi') {
    return await extractMobiMetadata(file);
  } else {
    throw new Error(`Unsupported file format: .${fileExtension}`);
  }
};
