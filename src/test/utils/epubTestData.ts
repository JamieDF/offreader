/**
 * Test utilities for generating mock EPUB file structures
 * Creates valid ZIP/EPUB archives for testing without needing real files
 */

/**
 * Create a minimal valid EPUB3 structure
 */
export function createTestEpub3Buffer(options: {
  title?: string;
  author?: string;
  description?: string;
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  subjects?: string[];
  chapters?: number;
} = {}): ArrayBuffer {
  const {
    title = 'Test EPUB',
    author = 'Test Author',
    description = 'A test EPUB book',
    publisher = 'Test Publisher',
    pubDate = '2024-01-01',
    language = 'en',
    identifier = 'urn:uuid:test-123',
    subjects = ['Fiction', 'Test'],
    chapters = 3
  } = options;

  // Create OPF content (package file)
  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator id="creator">${author}</dc:creator>
    <dc:description>${description}</dc:description>
    <dc:publisher>${publisher}</dc:publisher>
    <dc:issued>${pubDate}</dc:issued>
    <dc:language>${language}</dc:language>
    <dc:identifier id="pub-id">${identifier}</dc:identifier>
    ${subjects.map(s => `<dc:subject>${s}</dc:subject>`).join('\n    ')}
  </metadata>
  <manifest>
    ${Array.from({length: chapters}, (_, i) => 
      `<item id="ch${i+1}" href="chapter${i+1}.xhtml" media-type="application/xhtml+xml"/>`
    ).join('\n    ')}
  </manifest>
  <spine>
    ${Array.from({length: chapters}, (_, i) => 
      `<itemref idref="ch${i+1}"/>`
    ).join('\n    ')}
  </spine>
</package>`;

  // Create container.xml
  const containerContent = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  // Create minimal chapter XHTML
  const chapterContent = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>Chapter Title</h1>
    <p>This is chapter content.</p>
  </body>
</html>`;

  // Create mimetype file (uncompressed)
  const mimetypeContent = 'application/epub+zip';

  // Build a JSON representation of the EPUB structure
  // In real scenario, this would be a ZIP file
  const structure = {
    mimetype: mimetypeContent,
    'META-INF/container.xml': containerContent,
    'OEBPS/content.opf': opfContent,
    ...Object.fromEntries(
      Array.from({length: chapters}, (_, i) => 
        [`OEBPS/chapter${i+1}.xhtml`, chapterContent]
      )
    )
  };

  // Convert to JSON string (represents the EPUB structure)
  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create a minimal valid EPUB2 structure
 */
export function createTestEpub2Buffer(options: {
  title?: string;
  author?: string;
  chapters?: number;
} = {}): ArrayBuffer {
  const {
    title = 'Test EPUB2',
    author = 'Test Author',
    chapters = 2
  } = options;

  // EPUB2 uses different metadata structure
  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uuid_id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:identifier id="uuid_id">urn:uuid:test-epub2</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${Array.from({length: chapters}, (_, i) => 
      `<item id="ch${i}" href="ch${i}.html" media-type="application/xhtml+xml"/>`
    ).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${Array.from({length: chapters}, (_, i) => 
      `<itemref idref="ch${i}"/>`
    ).join('\n    ')}
  </spine>
</package>`;

  const structure = {
    'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    'content.opf': opfContent,
    'toc.ncx': `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    ${Array.from({length: chapters}, (_, i) => 
      `<navPoint><navLabel><text>Chapter ${i+1}</text></navLabel></navPoint>`
    ).join('\n    ')}
  </navMap>
</ncx>`
  };

  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create EPUB with missing metadata (edge case)
 */
export function createMinimalEpubBuffer(): ArrayBuffer {
  const structure = {
    'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf"/>
  </rootfiles>
</container>`,
    'content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf">
  <metadata/>
  <manifest/>
  <spine/>
</package>`
  };

  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create EPUB with special characters
 */
export function createEpubWithSpecialCharsBuffer(): ArrayBuffer {
  const structure = {
    'META-INF/container.xml': `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf"/>
  </rootfiles>
</container>`,
    'content.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Café & Restaurant Éclairs</dc:title>
    <dc:creator>José María García</dc:creator>
    <dc:description>"Paris" &amp; "Romance" — A tale</dc:description>
  </metadata>
  <manifest/>
  <spine/>
</package>`
  };

  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create EPUB with many chapters
 */
export function createEpubWithManyChaptersBuffer(chapterCount: number = 100): ArrayBuffer {
  const chapters = Array.from({length: chapterCount}, (_, i) => 
    `<item id="ch${i+1}" href="chapter${i+1}.xhtml" media-type="application/xhtml+xml"/>`
  ).join('\n    ');

  const spine = Array.from({length: chapterCount}, (_, i) => 
    `<itemref idref="ch${i+1}"/>`
  ).join('\n    ');

  const structure = {
    'content.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Big Book</dc:title>
    <dc:creator>Author</dc:creator>
  </metadata>
  <manifest>
    ${chapters}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`
  };

  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create corrupted/invalid EPUB
 */
export function createCorruptedEpubBuffer(): ArrayBuffer {
  const structure = {
    'content.opf': '{ invalid XML content ]]]'
  };

  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create EPUB with ISBN/identifier
 */
export function createEpubWithISBNBuffer(): ArrayBuffer {
  const structure = {
    'content.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Author</dc:creator>
    <dc:identifier id="isbn">978-0-7432-7356-5</dc:identifier>
  </metadata>
  <manifest/>
  <spine/>
</package>`
  };

  const jsonStr = JSON.stringify(structure);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(jsonStr);
  
  return buffer.buffer;
}

/**
 * Create a mock File from EPUB buffer
 */
export function createMockEpubFile(
  buffer: ArrayBuffer,
  name: string = 'test.epub'
): File {
  const blob = new Blob([buffer], { type: 'application/epub+zip' });
  return new File([blob], name, { type: 'application/epub+zip' });
}
