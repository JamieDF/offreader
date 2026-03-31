/**
 * EPUB format parser.
 * Extracts metadata and cover images from EPUB files using JSZip + DOMParser.
 */

import JSZip, { JSZipObject } from 'jszip';

export interface EpubMetadata {
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

// Helper function to extract cover image from EPUB
export const extractEpubCover = async (zip: JSZip, opfDoc: Document, opfPath: string): Promise<string> => {
  try {
    // Get the directory path of the OPF file for resolving relative paths
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

    // Method 1: EPUB3 - Look for properties="cover-image" in manifest
    const manifestItems = opfDoc.querySelectorAll('manifest item');
    for (const item of Array.from(manifestItems)) {
      const properties = item.getAttribute('properties');
      if (properties?.includes('cover-image')) {
        const href = item.getAttribute('href');
        if (href) {
          const coverPath = opfDir + href;
          const coverFile = zip.file(coverPath);
          if (coverFile) {
            const base64 = await coverFile.async('base64');
            const mediaType = item.getAttribute('media-type') || 'image/jpeg';
            return `data:${mediaType};base64,${base64}`;
          }
        }
      }
    }

    // Method 2: EPUB2 - Look for <meta name="cover"> tag
    const coverMeta = opfDoc.querySelector('meta[name="cover"]');
    if (coverMeta) {
      const coverId = coverMeta.getAttribute('content');
      if (coverId) {
        for (const item of Array.from(manifestItems)) {
          if (item.getAttribute('id') === coverId) {
            const href = item.getAttribute('href');
            if (href) {
              const coverPath = opfDir + href;
              const coverFile = zip.file(coverPath);
              if (coverFile) {
                const base64 = await coverFile.async('base64');
                const mediaType = item.getAttribute('media-type') || 'image/jpeg';
                return `data:${mediaType};base64,${base64}`;
              }
            }
          }
        }
      }
    }

    // Method 3: Fuzzy detection - Look for common cover file names
    const coverPatterns = ['cover', 'front', 'title'];
    const imageFiles = Object.keys(zip.files).filter(name =>
      /\.(jpg|jpeg|png|gif)$/i.test(name) && !zip.files[name].dir
    );

    for (const pattern of coverPatterns) {
      const matchingFile = imageFiles.find(name =>
        name.toLowerCase().includes(pattern)
      );
      if (matchingFile) {
        const coverFile = zip.file(matchingFile);
        if (coverFile) {
          const base64 = await coverFile.async('base64');
          const ext = matchingFile.split('.').pop()?.toLowerCase();
          const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';
          return `data:${mediaType};base64,${base64}`;
        }
      }
    }

    // Method 4: First page scan - Look for single large image on first page
    const spineItems = opfDoc.querySelectorAll('spine itemref');
    if (spineItems.length > 0) {
      const firstItemRef = spineItems[0].getAttribute('idref');
      if (firstItemRef) {
        const firstItem = Array.from(manifestItems).find(item =>
          item.getAttribute('id') === firstItemRef
        );
        if (firstItem) {
          const href = firstItem.getAttribute('href');
          if (href) {
            const firstPagePath = opfDir + href;
            const firstPage = zip.file(firstPagePath);
            if (firstPage) {
              const content = await firstPage.async('string');
              const parser = new DOMParser();
              const doc = parser.parseFromString(content, 'text/html');
              const images = doc.querySelectorAll('img');
              if (images.length === 1) {
                const imgSrc = images[0].getAttribute('src');
                if (imgSrc) {
                  const imgPath = opfDir + imgSrc.split('/').filter(p => p !== '..').join('/');
                  const imgFile = zip.file(imgPath);
                  if (imgFile) {
                    const base64 = await imgFile.async('base64');
                    const ext = imgPath.split('.').pop()?.toLowerCase();
                    const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';
                    return `data:${mediaType};base64,${base64}`;
                  }
                }
              }
            }
          }
        }
      }
    }

    return '';
  } catch (error) {
    console.error('❌ Error extracting cover:', error);
    return '';
  }
};

// Helper function to extract chapters and full metadata from an EPUB file
export const extractChaptersWithFoliate = async (file: File): Promise<EpubMetadata> => {
  // Read the EPUB file as a zip to get spine count
  const arrayBuffer = await file.arrayBuffer();

  const header = new Uint8Array(arrayBuffer, 0, 4);
  if (header[0] !== 0x50 || header[1] !== 0x4B || header[2] !== 0x03 || header[3] !== 0x04) {
    throw new Error('Invalid EPUB file');
  }

  const zip = await JSZip.loadAsync(arrayBuffer);

  // Look for the OPF file
  let opfFile: JSZipObject | null = null;
  let opfPath = '';
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (containerXml) {
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'text/xml');
    const rootfile = containerDoc.querySelector('rootfile');
    if (rootfile) {
      opfPath = rootfile.getAttribute('full-path') || '';
      opfFile = zip.file(opfPath);
    }
  }

  if (!opfFile) {
    // Fallback: look for any .opf file
    const opfFiles = Object.keys(zip.files).filter(name => name.endsWith('.opf'));
    if (opfFiles.length > 0) {
      opfPath = opfFiles[0];
      opfFile = zip.file(opfPath);
    }
  }

  if (!opfFile) {
    throw new Error('Invalid EPUB file');
  }

  // Parse OPF file
  const opfContent = await opfFile.async('string');
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfContent, 'text/xml');

  // Extract comprehensive metadata
  const title = opfDoc.querySelector('title')?.textContent || file.name.replace(/\.[^/.]+$/, '');
  const author = opfDoc.querySelector('creator')?.textContent || 'Unknown Author';
  const publisher = opfDoc.querySelector('publisher')?.textContent || 'Unknown Publisher';
  const pubDate = opfDoc.querySelector('date')?.textContent || '';
  const language = opfDoc.querySelector('language')?.textContent || 'Unknown';
  const identifier = opfDoc.querySelector('identifier')?.textContent || '';

  // Extract description - try multiple selectors
  let description = opfDoc.querySelector('description')?.textContent || '';
  if (!description) {
    // Try with namespace (use attribute selector)
    const descWithNs = opfDoc.querySelector('[*|description]')?.textContent || '';
    if (descWithNs) description = descWithNs;
  }
  if (!description) {
    // Try any element that has 'description' in attribute
    const descElements = opfDoc.querySelectorAll('*');
    for (const el of descElements) {
      if (el.textContent && el.textContent.length > 50 &&
          (el.tagName.toLowerCase().includes('desc') ||
           el.getAttribute('property')?.includes('description') ||
           el.getAttribute('name')?.includes('description'))) {
        description = el.textContent;
        break;
      }
    }
  }

  // Extract subject/tags
  const subjects = Array.from(opfDoc.querySelectorAll('subject')).map(el => el.textContent).filter(Boolean) as string[];

  // Extract rights/copyright
  const rights = opfDoc.querySelector('rights')?.textContent || '';

  // Get spine items for rough chapter count
  const spineItems = opfDoc.querySelectorAll('spine itemref');
  const totalChapters = Math.max(1, Math.floor(spineItems.length * 0.6)); // Estimate 60% are actual chapters

  // Create estimated chapters
  const chapters = Array.from({ length: totalChapters }, (_, i) => ({
    label: `Chapter ${i + 1}`,
    href: `chapter-${i + 1}`,
    index: i
  }));

  // If no description, try to create a better fallback
  if (!description || description.trim().length < 10) {
    const fallbackDesc = `An EPUB book by ${author}${subjects.length > 0 ? `. Topics include: ${subjects.slice(0, 3).join(', ')}` : ''}.`;
    description = fallbackDesc;
  }

  // Extract cover image
  const coverImage = await extractEpubCover(zip, opfDoc, opfPath);

  return {
    title,
    author,
    publisher,
    pubDate,
    language,
    identifier,
    description,
    subjects,
    rights,
    chapters,
    totalChapters,
    format: 'EPUB',
    coverImage
  };
};
