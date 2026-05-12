/**
 * MOBI binary format parser.
 * Extracts metadata and cover images from MOBI/PalmDOC files.
 */

export interface MobiMetadata {
  title: string;
  author: string;
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  subjects?: string[];
  rights?: string;
  chapters: { label: string; href: string; index: number }[];
  totalChapters: number;
  format: string;
  coverImage?: string;
}

// Helper function to safely read uint32 with bounds checking
const safeReadUint32 = (dataView: DataView, offset: number, littleEndian = false): number | null => {
  if (offset + 4 > dataView.byteLength) return null;
  try {
    return dataView.getUint32(offset, littleEndian);
  } catch {
    return null;
  }
};


// Helper function to validate and clean extracted text
const cleanExtractedText = (text: string): string => {
  return text
    .replace(/\0+/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control chars except \t, \n, \r
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper function to validate text quality
const isValidText = (text: string, minLength = 2): boolean => {
  if (!text || text.length < minLength) return false;
  const printableRatio = text.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 || c.charCodeAt(0) >= 160).length / text.length;
  return printableRatio > 0.7;
};

// Helper function to detect image type from magic bytes
const detectImageType = (data: Uint8Array): string | null => {
  if (data.length < 4) return null;
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) return 'image/png';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return 'image/gif';
  return null;
};

// Helper function to convert Uint8Array to base64
const arrayBufferToBase64 = (data: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
};

// Helper function to extract cover image from MOBI file
const extractMobiCover = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const dataView = new DataView(arrayBuffer);
    const uint8Array = new Uint8Array(arrayBuffer);

    const readPdbRecordOffset = (recordIndex: number): number =>
      dataView.getUint32(78 + 8 * recordIndex, false); // big-endian

    const firstRecordOffset = readPdbRecordOffset(0);
    const mobiHeaderOffset = firstRecordOffset + 16;

    const mobiSig = String.fromCharCode(
      uint8Array[mobiHeaderOffset], uint8Array[mobiHeaderOffset + 1],
      uint8Array[mobiHeaderOffset + 2], uint8Array[mobiHeaderOffset + 3]
    );
    if (mobiSig !== 'MOBI') return '';

    const mobiHeaderLength = dataView.getUint32(firstRecordOffset + 20, false);
    const firstImageRecordIndex = dataView.getUint32(firstRecordOffset + 108, false);
    const exthFlags = dataView.getUint32(firstRecordOffset + 128, false);

    if ((exthFlags & 0x40) === 0) {
      // No EXTH — try first image record as fallback
      if (firstImageRecordIndex > 0 && firstImageRecordIndex < 1000) {
        try {
          const imageOffset = readPdbRecordOffset(firstImageRecordIndex);
          const nextOffset = readPdbRecordOffset(firstImageRecordIndex + 1);
          const imageSize = nextOffset - imageOffset;
          if (imageSize > 0 && imageSize < 5_000_000) {
            const imageData = uint8Array.slice(imageOffset, nextOffset);
            const mediaType = detectImageType(imageData);
            if (mediaType) return `data:${mediaType};base64,${arrayBufferToBase64(imageData)}`;
          }
        } catch {
          // Fallback image extraction failed
        }
      }
      return '';
    }

    const exthOffset = mobiHeaderOffset + mobiHeaderLength;
    const exthSig = String.fromCharCode(
      uint8Array[exthOffset], uint8Array[exthOffset + 1],
      uint8Array[exthOffset + 2], uint8Array[exthOffset + 3]
    );
    if (exthSig !== 'EXTH') return '';

    const exthHeaderLength = dataView.getUint32(exthOffset + 4, false);
    const exthRecordCount = dataView.getUint32(exthOffset + 8, false);

    let currentOffset = exthOffset + 12;
    let coverOffset: number | null = null;

    for (let i = 0; i < exthRecordCount && currentOffset < exthOffset + exthHeaderLength; i++) {
      const recordType = dataView.getUint32(currentOffset, false);
      const recordLength = dataView.getUint32(currentOffset + 4, false);
      const valueLength = recordLength - 8;

      if (recordType === 201) {
        if (valueLength === 4) coverOffset = dataView.getUint32(currentOffset + 8, false);
        else if (valueLength === 2) coverOffset = dataView.getUint16(currentOffset + 8, false);
        else if (valueLength === 1) coverOffset = dataView.getUint8(currentOffset + 8);
        break;
      }
      currentOffset += recordLength;
    }

    if (coverOffset === null) return '';

    const coverRecordIndex = firstImageRecordIndex + coverOffset;
    if (coverRecordIndex < 0 || coverRecordIndex > 10000) return '';

    const coverImageOffset = readPdbRecordOffset(coverRecordIndex);
    const nextRecordOffset = readPdbRecordOffset(coverRecordIndex + 1);
    const imageSize = nextRecordOffset - coverImageOffset;
    if (imageSize <= 0 || imageSize > 5_000_000) return '';

    const imageData = uint8Array.slice(coverImageOffset, nextRecordOffset);
    const mediaType = detectImageType(imageData);
    if (!mediaType) return '';

    return `data:${mediaType};base64,${arrayBufferToBase64(imageData)}`;
  } catch (error) {
    console.error('❌ Error extracting MOBI cover:', error);
    return '';
  }
};

// Helper function to extract MOBI metadata
export const extractMobiMetadata = async (file: File): Promise<MobiMetadata> => {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  if (arrayBuffer.byteLength < 68) throw new Error('Invalid MOBI file');
  const sig = String.fromCharCode(...new Uint8Array(arrayBuffer, 60, 8));
  if (sig !== 'BOOKMOBI') throw new Error('Invalid MOBI file');

  // Filename-based fallback (often most reliable for MOBI)
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  let title = fileName;
  let author = 'Unknown Author';

  if (fileName.includes(' - ')) {
    const parts = fileName.split(' - ');
    title = parts[0].trim();
    author = parts.slice(1).join(' - ').trim();
  } else if (fileName.toLowerCase().includes(' by ')) {
    const parts = fileName.toLowerCase().split(' by ');
    title = parts[0].trim();
    author = parts.slice(1).join(' by ').trim();
  } else if (fileName.includes('_')) {
    const parts = fileName.split('_');
    if (parts.length >= 2) {
      title = parts[0].trim();
      author = parts[1].trim();
    }
  } else {
    const authorPatterns = [
      /(.+?)(?:\s+by\s+|\s*-\s*|\s*_\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*$/,
      /(.+?)(?:\s+by\s+|\s*-\s*|\s*_\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    ];
    for (const pattern of authorPatterns) {
      const match = fileName.match(pattern);
      if (match && match[2]) {
        title = match[1].trim();
        author = match[2].trim();
        break;
      }
    }
  }

  title = title.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  author = author.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

  try {
    const dataView = new DataView(arrayBuffer);

    if (arrayBuffer.byteLength < 84) throw new Error('File too small for MOBI header');

    // Find MOBI header — try PDB record 0 offset first, fall back to manual search
    let mobiHeaderStart = safeReadUint32(dataView, 80, false);

    if (!mobiHeaderStart || mobiHeaderStart > arrayBuffer.byteLength || mobiHeaderStart < 100) {
      const le = safeReadUint32(dataView, 80, true);
      if (le && le < arrayBuffer.byteLength && le >= 100) mobiHeaderStart = le;
    }

    if (!mobiHeaderStart || mobiHeaderStart > arrayBuffer.byteLength || mobiHeaderStart < 100) {
      mobiHeaderStart = -1;
      const searchLimit = Math.min(arrayBuffer.byteLength - 4, 20000);
      for (let i = 0; i < searchLimit; i++) {
        if (uint8Array[i] === 77 && uint8Array[i + 1] === 79 && uint8Array[i + 2] === 66 && uint8Array[i + 3] === 73) {
          if (i >= 8 && uint8Array[i - 8] === 66 && uint8Array[i - 7] === 79 && uint8Array[i - 6] === 79 && uint8Array[i - 5] === 75) {
            mobiHeaderStart = i - 8;
            break;
          }
          if (i < 100) { mobiHeaderStart = i; break; }
        }
      }
      if (mobiHeaderStart === -1) throw new Error('Could not locate MOBI header in file');
    }

    // Check MOBI signature at common offsets (+0, +8, +16)
    const checkMobiSig = (base: number): boolean => {
      for (const off of [16, 0, 8]) {
        const o = base + off;
        if (o + 4 <= arrayBuffer.byteLength &&
            uint8Array[o] === 77 && uint8Array[o + 1] === 79 && uint8Array[o + 2] === 66 && uint8Array[o + 3] === 73) {
          return true;
        }
      }
      return false;
    };
    // isMobi may be false for some files — continue anyway
    checkMobiSig(mobiHeaderStart);

    // Find EXTH header — search from end of MOBI header then broadly
    const headerLength = safeReadUint32(dataView, mobiHeaderStart + 20, false);
    const exthSearchStart = headerLength ? mobiHeaderStart + headerLength : mobiHeaderStart + 232;
    const exthSearchEnd = Math.min(exthSearchStart + 5000, arrayBuffer.byteLength - 4);

    let exthOffset = -1;
    for (let i = exthSearchStart; i < exthSearchEnd; i++) {
      if (uint8Array[i] === 69 && uint8Array[i + 1] === 88 && uint8Array[i + 2] === 84 && uint8Array[i + 3] === 72) {
        exthOffset = i; break;
      }
    }
    if (exthOffset === -1) {
      const broadLimit = Math.min(arrayBuffer.byteLength - 4, 50000);
      for (let i = 0; i < broadLimit; i++) {
        if (uint8Array[i] === 69 && uint8Array[i + 1] === 88 && uint8Array[i + 2] === 84 && uint8Array[i + 3] === 72) {
          exthOffset = i; break;
        }
      }
    }
    if (exthOffset === -1) throw new Error('EXTH header not found');

    const exthStart = exthOffset + 4;
    const exthHeaderLength = safeReadUint32(dataView, exthStart, false);
    const tagCount = safeReadUint32(dataView, exthStart + 4, false);
    if (!exthHeaderLength || !tagCount) throw new Error('EXTH header corrupted');

    let currentOffset = exthStart + 8;
    let extractedAuthor = '';
    let extractedDescription = '';
    let description = '';

    for (let i = 0; i < tagCount && currentOffset < exthStart + exthHeaderLength; i++) {
      try {
        const tagId = safeReadUint32(dataView, currentOffset, false);
        const tagLength = safeReadUint32(dataView, currentOffset + 4, false);
        if (!tagId || !tagLength) { currentOffset += 8; continue; }

        const tagDataOffset = currentOffset + 8;
        if (tagLength > 10000 || tagLength < 8 || tagDataOffset + tagLength - 8 > arrayBuffer.byteLength) {
          currentOffset += 8; continue;
        }

        const actualDataLength = tagLength - 8;
        const tagBytes = new Uint8Array(arrayBuffer, tagDataOffset, actualDataLength);
        const tagText = cleanExtractedText(new TextDecoder('utf-8', { fatal: false }).decode(tagBytes));

        if (isValidText(tagText)) {
          if (tagId === 100) extractedAuthor = tagText;       // Author
          else if (tagId === 103) extractedDescription = tagText; // Description
        }

        currentOffset = tagDataOffset + ((actualDataLength + 3) & ~3);
      } catch {
        currentOffset += 8;
      }
    }

    if (extractedAuthor) author = extractedAuthor;
    if (extractedDescription) description = extractedDescription;

    const coverImage = await extractMobiCover(arrayBuffer);

    return {
      title,
      author,
      publisher: undefined,
      pubDate: undefined,
      language: undefined,
      identifier: undefined,
      description,
      subjects: [],
      rights: undefined,
      chapters: [],
      totalChapters: 0,
      format: 'MOBI',
      coverImage
    };

  } catch {
    const description = `A MOBI book by ${author}.`;
    let coverImage = '';
    try { coverImage = await extractMobiCover(arrayBuffer); } catch { /* proceed without cover */ }

    return {
      title,
      author,
      publisher: undefined,
      pubDate: undefined,
      language: undefined,
      identifier: undefined,
      description,
      subjects: [],
      rights: undefined,
      chapters: [],
      totalChapters: 0,
      format: 'MOBI',
      coverImage
    };
  }
};
