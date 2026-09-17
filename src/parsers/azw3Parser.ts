/**
 * AZW3 (Kindle KF8) metadata parser.
 *
 * AZW3 uses the same Palm database container and MOBI header validation as
 * MOBI, so the established binary parser is reused with the format corrected.
 */

import { extractMobiMetadata, MobiMetadata } from './mobiParser';

export type Azw3Metadata = Omit<MobiMetadata, 'format'> & { format: 'AZW3' };

export const extractAzw3Metadata = async (file: File): Promise<Azw3Metadata> => {
  if (!file.name.toLowerCase().endsWith('.azw3')) {
    throw new Error('Invalid AZW3 file');
  }

  const metadata = await extractMobiMetadata(file);
  return { ...metadata, format: 'AZW3' };
};
