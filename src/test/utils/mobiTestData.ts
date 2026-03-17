/**
 * Test utilities for generating mock MOBI file data
 * Used for testing binary parsing without needing real MOBI files
 */

/**
 * Create a minimal valid MOBI file buffer for testing
 */
export function createMockMobiBuffer(options: {
  author?: string;
  description?: string;
  hasExthHeader?: boolean;
} = {}): ArrayBuffer {
  const {
    author = 'Test Author',
    description = 'Test Description',
    hasExthHeader = true
  } = options;

  const bufferSize = 2048;
  const buffer = new ArrayBuffer(bufferSize);
  const uint8Array = new Uint8Array(buffer);
  const dataView = new DataView(buffer);

  // Palm Database Header (78 bytes)
  const dbName = 'BOOK';
  for (let i = 0; i < dbName.length; i++) {
    uint8Array[i] = dbName.charCodeAt(i);
  }

  dataView.setUint16(78, 1, false); // Number of records

  // Record 0 offset
  dataView.setUint32(80, 100, false);

  // PalmDOC Header (at offset 100)
  const palmDocStart = 100;
  dataView.setUint32(palmDocStart + 4, 100, false);
  dataView.setUint16(palmDocStart + 8, 1, false);
  dataView.setUint16(palmDocStart + 10, 4096, false);

  // MOBI Header (at offset 100 + 16 = 116)
  const mobiStart = palmDocStart + 16;

  // MOBI signature
  uint8Array[mobiStart] = 77; // 'M'
  uint8Array[mobiStart + 1] = 79; // 'O'
  uint8Array[mobiStart + 2] = 66; // 'B'
  uint8Array[mobiStart + 3] = 73; // 'I'

  // Header length
  dataView.setUint32(mobiStart + 4, 232, false);

  // EXTH flags (offset 128 in MOBI header)
  const exthFlags = hasExthHeader ? 0x40 : 0x00;
  dataView.setUint32(mobiStart + 128, exthFlags, false);

  if (hasExthHeader) {
    // EXTH Header (starts after MOBI header)
    const exthStart = mobiStart + 232;

    // EXTH signature
    uint8Array[exthStart] = 69; // 'E'
    uint8Array[exthStart + 1] = 88; // 'X'
    uint8Array[exthStart + 2] = 84; // 'T'
    uint8Array[exthStart + 3] = 72; // 'H'

    const authorBytes = new TextEncoder().encode(author);
    const descBytes = new TextEncoder().encode(description);

    let exthHeaderSize = 12;
    exthHeaderSize += 8 + authorBytes.length;
    exthHeaderSize += 8 + descBytes.length;

    // EXTH header length
    dataView.setUint32(exthStart + 4, exthHeaderSize, false);

    // Number of tags
    dataView.setUint32(exthStart + 8, 2, false);

    // Tag 100 (Author)
    let tagOffset = exthStart + 12;
    dataView.setUint32(tagOffset, 100, false);
    dataView.setUint32(tagOffset + 4, 8 + authorBytes.length, false);
    for (let i = 0; i < authorBytes.length; i++) {
      uint8Array[tagOffset + 8 + i] = authorBytes[i];
    }

    // Tag 103 (Description)
    tagOffset += 8 + authorBytes.length;
    dataView.setUint32(tagOffset, 103, false);
    dataView.setUint32(tagOffset + 4, 8 + descBytes.length, false);
    for (let i = 0; i < descBytes.length; i++) {
      uint8Array[tagOffset + 8 + i] = descBytes[i];
    }
  }

  return buffer;
}

/**
 * Create a corrupted MOBI buffer (missing MOBI signature)
 */
export function createCorruptedMobiBuffer(): ArrayBuffer {
  const buffer = createMockMobiBuffer();
  const uint8Array = new Uint8Array(buffer);
  uint8Array[116] = 255;
  uint8Array[117] = 255;
  uint8Array[118] = 255;
  uint8Array[119] = 255;
  return buffer;
}

/**
 * Create a MOBI buffer that's too small to be valid
 */
export function createTinyMobiBuffer(): ArrayBuffer {
  return new ArrayBuffer(50);
}

/**
 * Create a file-like object for testing
 */
export function createMockFile(
  data: ArrayBuffer,
  name: string,
  type: string = 'application/octet-stream'
): File {
  const blob = new Blob([data], { type });
  return new File([blob], name, { type });
}
