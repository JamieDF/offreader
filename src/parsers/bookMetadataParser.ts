/**
 * Dispatches book metadata extraction to the correct format-specific parser.
 */

import { extractChaptersWithFoliate, EpubMetadata } from './epubParser';
import { extractMobiMetadata, MobiMetadata } from './mobiParser';
import { extractPdfMetadata, PdfMetadata } from './pdfParser';
import { extractAzw3Metadata, Azw3Metadata } from './azw3Parser';
import { extractFb2Metadata, Fb2Metadata } from './fb2Parser';
import { extractCbzMetadata, CbzMetadata } from './cbzParser';

export type BookMetadata = EpubMetadata | MobiMetadata | PdfMetadata | Azw3Metadata | Fb2Metadata | CbzMetadata;

export const extractBookMetadata = async (file: File): Promise<BookMetadata> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  if (fileExtension === 'epub') {
    return await extractChaptersWithFoliate(file);
  } else if (fileExtension === 'mobi') {
    return await extractMobiMetadata(file);
  } else if (fileExtension === 'pdf') {
    return await extractPdfMetadata(file);
  } else if (fileExtension === 'azw3') {
    return await extractAzw3Metadata(file);
  } else if (fileExtension === 'fb2') {
    return await extractFb2Metadata(file);
  } else if (fileExtension === 'cbz') {
    return await extractCbzMetadata(file);
  } else {
    throw new Error(`Unsupported file format: .${fileExtension}`);
  }
};
