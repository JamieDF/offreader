import { useState, useCallback, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/toast";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { storageService } from "@/services/storage";
import { fileStorage } from "@/services/fileStorage";
import JSZip from 'jszip';
import 'foliate-js/view.js';

export type SortOption = "recent" | "title" | "author" | "progress";

// Storage key for book tracking data (to get lastReadDate)
const TRACKER_STORAGE_KEY = "book-tracker-data";

interface StoredBookData {
  [bookId: string]: {
    progress: number;
    lastReadDate: string | null;
    currentChapter: number;
    isFinished: boolean;
  };
}

// Helper function to extract chapters using foliate-js
const extractChaptersWithFoliate = async (file: File): Promise<{
  title: string; 
  author: string; 
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  subjects?: string[];
  rights?: string;
  chapters: any[]; 
  totalChapters: number; 
  format: string 
}> => {
  try {
    // Read the EPUB file as a zip to get spine count
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Look for the OPF file
    let opfFile = null;
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
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Author',
        chapters: [],
        totalChapters: 0,
        format: 'EPUB',
        coverImage: ''
      };
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
    const subjects = Array.from(opfDoc.querySelectorAll('subject')).map(el => el.textContent).filter(Boolean);
    
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
      // We could try to extract from first chapter here in the future
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
  } catch (error) {
    console.error('Failed to extract chapters:', error);
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      author: 'Unknown Author',
      chapters: [],
      totalChapters: 0,
      format: 'EPUB',
      coverImage: ''
    };
  }
};

// Helper function to extract basic EPUB/MOBI metadata
const extractBookMetadata = async (file: File): Promise<{
  title: string; 
  author: string; 
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  subjects?: string[];
  rights?: string;
  chapters: any[]; 
  totalChapters: number; 
  format: string 
}> => {
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

// Helper function to extract cover image from EPUB
const extractEpubCover = async (zip: JSZip, opfDoc: Document, opfPath: string): Promise<string> => {
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

// Helper function to extract EPUB metadata
const extractEpubMetadata = async (file: File): Promise<{ title: string, author: string, chapters: any[], totalChapters: number, format: string, coverImage: string }> => {
  try {
    // Read the EPUB file as a zip
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Look for the OPF file (content.opf)
    let opfFile = null;
    let opfPath = '';
    
    // Find container.xml to get OPF path
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
        opfFile = zip.file(opfFiles[0]);
        opfPath = opfFiles[0];
      }
    }
    
    if (!opfFile) {
      return {
        title: file.name.replace(/\.[^/.]+$/, ''),
        author: 'Unknown Author',
        chapters: [],
        totalChapters: 0,
        format: 'EPUB',
        coverImage: ''
      };
    }

    // Parse OPF file
    const opfContent = await opfFile.async('string');
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfContent, 'text/xml');

    // Extract title
    const titleElement = opfDoc.querySelector('title');
    const title = titleElement?.textContent || file.name.replace(/\.[^/.]+$/, '');
    
    // Extract author
    const creatorElement = opfDoc.querySelector('creator');
    const author = creatorElement?.textContent || 'Unknown Author';
    
    // Extract spine (reading order) for chapter count
    const spineItems = opfDoc.querySelectorAll('spine itemref');
    
    // Get manifest items for reference
    const manifestItems = opfDoc.querySelectorAll('manifest item');
    
    // Extract TOC data for accurate chapter information
    const tocItems = opfDoc.querySelectorAll('guide reference') || [];
    const chapters: any[] = [];
    
    tocItems.forEach((item) => {
      const title = item.getAttribute('title');
      const href = item.getAttribute('href');
      const type = item.getAttribute('type');

      // Only include actual chapters, not front/back matter
      if (href && type === 'text' && title) {
        chapters.push({
          label: title,
          href: href,
          index: chapters.length
        });
      }
    });
    
    // If no guide TOC, try to extract from NCX file
    if (chapters.length === 0) {
      const ncxFile = Array.from(manifestItems).find(m =>
        m.getAttribute('media-type') === 'application/x-dtbncx+xml'
      );

      if (ncxFile) {
        const ncxPath = ncxFile.getAttribute('href');
        try {
          // Read and parse the NCX file
          const ncxContent = await zip.file(ncxPath)?.async('string');

          if (ncxContent) {
            const parser = new DOMParser();
            const ncxDoc = parser.parseFromString(ncxContent, 'text/xml');

            // Extract navPoints from NCX
            const navPoints = ncxDoc.querySelectorAll('navPoint');

            navPoints.forEach((navPoint) => {
              const label = navPoint.querySelector('navLabel text')?.textContent;
              const contentSrc = navPoint.querySelector('content')?.getAttribute('src');

              if (label && contentSrc) {
                chapters.push({
                  label: label,
                  href: contentSrc,
                  index: chapters.length
                });
              }
            });
          }
        } catch (error) {
          console.error('Failed to parse NCX file:', error);
        }
      }
    }
    
    // Estimate total chapters (60% of spine items are usually actual chapters)
    const totalChapters = Math.max(1, Math.round(spineItems.length * 0.6));
    
    // Extract cover image
    const coverImage = await extractEpubCover(zip, opfDoc, opfPath);
    
    return {
      title,
      author,
      chapters,
      totalChapters,
      format: 'EPUB',
      coverImage
    };
  } catch (error) {
    console.error('Failed to extract EPUB metadata:', error);
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      author: 'Unknown Author',
      chapters: [],
      totalChapters: 0,
      format: 'EPUB',
      coverImage: ''
    };
  }
};

// Helper function to calculate estimated reading time and page count from file size
const calculateReadingMetrics = (fileSize: number): { readingTime: string; pageCount: number } => {
  // Average reading speed: 250 words per minute
  // Average words per page: 250-300 (using 275)
  // Average bytes per word in ebook: ~6 bytes (including markup)
  
  const estimatedWords = Math.floor(fileSize / 6);
  const estimatedPages = Math.floor(estimatedWords / 275);
  const readingMinutes = Math.floor(estimatedWords / 250);
  
  const hours = Math.floor(readingMinutes / 60);
  const minutes = readingMinutes % 60;
  
  let readingTime = '';
  if (hours > 0) {
    readingTime = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    readingTime = `${minutes}m`;
  }
  
  return {
    readingTime,
    pageCount: Math.max(1, estimatedPages) // At least 1 page
  };
};

// Helper function to safely read uint32 with bounds checking
const safeReadUint32 = (dataView: DataView, offset: number, littleEndian: boolean = false): number | null => {
  if (offset + 4 > dataView.byteLength) {
    return null;
  }
  try {
    return dataView.getUint32(offset, littleEndian);
  } catch {
    return null;
  }
};

// Helper function to safely read uint16 with bounds checking
const safeReadUint16 = (dataView: DataView, offset: number, littleEndian: boolean = false): number | null => {
  if (offset + 2 > dataView.byteLength) {
    return null;
  }
  try {
    return dataView.getUint16(offset, littleEndian);
  } catch {
    return null;
  }
};

// Helper function to validate and clean extracted text
const cleanExtractedText = (text: string): string => {
  // Remove null bytes, control characters, and excessive whitespace
  return text
    .replace(/\0+/g, '') // Remove all null bytes
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control chars except \t, \n, \r
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Helper function to validate text quality
const isValidText = (text: string, minLength: number = 2): boolean => {
  if (!text || text.length < minLength) return false;
  // Check if text is mostly printable characters
  const printableRatio = text.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 || c.charCodeAt(0) >= 160).length / text.length;
  return printableRatio > 0.7; // At least 70% printable
};

// Helper function to extract alternative MOBI metadata when EXTH is not found
const extractAlternativeMobiMetadata = async (
  dataView: DataView,
  arrayBuffer: ArrayBuffer,
  mobiHeaderOffset: number,
  title: string,
  author: string
): Promise<{ hasMetadata: boolean; result: any }> => {
  try {
    // Look for readable text in the MOBI header area
    const mobiStart = mobiHeaderOffset + 8;
    const headerArea = new Uint8Array(arrayBuffer, mobiStart, Math.min(1000, arrayBuffer.byteLength - mobiStart));
    const headerText = new TextDecoder('utf-8', { fatal: false }).decode(headerArea);
    
    // Look for author patterns in the header text
    const authorPatterns = [
      /author[:\s]*([^\n\r]{3,100})/i,
      /by[:\s]*([^\n\r]{3,100})/i,
      /written\s+by[:\s]*([^\n\r]{3,100})/i
    ];
    
    let foundAuthor = author;
    for (const pattern of authorPatterns) {
      const match = headerText.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        foundAuthor = match[1].trim();
        break;
      }
    }
    
    // Look for description patterns
    const descPatterns = [
      /description[:\s]*([^\n\r]{20,500})/i,
      /synopsis[:\s]*([^\n\r]{20,500})/i,
      /summary[:\s]*([^\n\r]{20,500})/i
    ];
    
    let foundDescription = '';
    for (const pattern of descPatterns) {
      const match = headerText.match(pattern);
      if (match && match[1] && match[1].trim().length > 10) {
        foundDescription = match[1].trim();
        break;
      }
    }
    
    // If we found any metadata, return it
    if (foundAuthor !== author || foundDescription) {
      const description = foundDescription || `A MOBI book by ${foundAuthor}. This appears to be "${title}" imported from a MOBI format file.`;
      
      const estimatedChapters = Math.max(1, Math.floor(arrayBuffer.byteLength / 75000));
      const chapters = Array.from({ length: estimatedChapters }, (_, i) => ({
        label: `Chapter ${i + 1}`,
        href: `chapter-${i + 1}`,
        index: i
      }));
      
      return {
        hasMetadata: true,
        result: {
          title,
          author: foundAuthor,
          publisher: undefined,
          pubDate: undefined,
          language: undefined,
          identifier: undefined,
          description,
          subjects: [],
          rights: undefined,
          chapters,
          totalChapters: estimatedChapters,
          format: 'MOBI'
        }
      };
    }
  } catch (error) {
    // Alternative extraction failed - caller will use filename fallback
  }

  return { hasMetadata: false, result: null };
};

// Helper function to extract cover image from MOBI file
const extractMobiCover = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const dataView = new DataView(arrayBuffer);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Helper to read PDB record offset
    const readPdbRecordOffset = (recordIndex: number): number => {
      // PDB header is 78 bytes, each record info is 8 bytes
      return dataView.getUint32(78 + 8 * recordIndex, false); // big-endian
    };
    
    // Read first record offset (contains PalmDOC + MOBI + EXTH headers)
    const firstRecordOffset = readPdbRecordOffset(0);

    // MOBI header starts at offset 16 within the first record
    const mobiHeaderOffset = firstRecordOffset + 16;
    
    // Verify MOBI signature
    const mobiSig = String.fromCharCode(
      uint8Array[mobiHeaderOffset],
      uint8Array[mobiHeaderOffset + 1],
      uint8Array[mobiHeaderOffset + 2],
      uint8Array[mobiHeaderOffset + 3]
    );
    
    if (mobiSig !== 'MOBI') {
      return '';
    }

    // Read key values from MOBI header
    const mobiHeaderLength = dataView.getUint32(firstRecordOffset + 20, false);
    const firstImageRecordIndex = dataView.getUint32(firstRecordOffset + 108, false);
    const exthFlags = dataView.getUint32(firstRecordOffset + 128, false);

    // Check if EXTH header exists (bit 6 = 0x40)
    if ((exthFlags & 0x40) === 0) {
      // Try fallback: use first image record
      if (firstImageRecordIndex > 0 && firstImageRecordIndex < 1000) {
        try {
          const imageOffset = readPdbRecordOffset(firstImageRecordIndex);
          const nextOffset = readPdbRecordOffset(firstImageRecordIndex + 1);
          const imageSize = nextOffset - imageOffset;

          if (imageSize > 0 && imageSize < 5000000) { // Max 5MB
            const imageData = uint8Array.slice(imageOffset, nextOffset);
            const mediaType = detectImageType(imageData);
            if (mediaType) {
              const base64 = arrayBufferToBase64(imageData);
              return `data:${mediaType};base64,${base64}`;
            }
          }
        } catch (error) {
          // Fallback image extraction failed
        }
      }
      return '';
    }
    
    // EXTH header starts after MOBI header
    const exthOffset = mobiHeaderOffset + mobiHeaderLength;
    
    // Verify EXTH signature
    const exthSig = String.fromCharCode(
      uint8Array[exthOffset],
      uint8Array[exthOffset + 1],
      uint8Array[exthOffset + 2],
      uint8Array[exthOffset + 3]
    );
    
    if (exthSig !== 'EXTH') {
      return '';
    }

    // Read EXTH header info
    const exthHeaderLength = dataView.getUint32(exthOffset + 4, false);
    const exthRecordCount = dataView.getUint32(exthOffset + 8, false);
    
    // Search for EXTH record 201 (coveroffset)
    let currentOffset = exthOffset + 12;
    let coverOffset: number | null = null;
    
    for (let i = 0; i < exthRecordCount && currentOffset < exthOffset + exthHeaderLength; i++) {
      const recordType = dataView.getUint32(currentOffset, false);
      const recordLength = dataView.getUint32(currentOffset + 4, false);
      const valueLength = recordLength - 8; // Subtract type and length fields
      
      if (recordType === 201) {
        // Found coveroffset record
        if (valueLength === 4) {
          coverOffset = dataView.getUint32(currentOffset + 8, false);
        } else if (valueLength === 2) {
          coverOffset = dataView.getUint16(currentOffset + 8, false);
        } else if (valueLength === 1) {
          coverOffset = dataView.getUint8(currentOffset + 8);
        }
        break;
      }
      
      currentOffset += recordLength;
    }
    
    if (coverOffset === null) {
      return '';
    }

    // Calculate cover record index
    const coverRecordIndex = firstImageRecordIndex + coverOffset;

    // Validate record index
    if (coverRecordIndex < 0 || coverRecordIndex > 10000) {
      return '';
    }

    // Read cover image data
    const coverImageOffset = readPdbRecordOffset(coverRecordIndex);
    const nextRecordOffset = readPdbRecordOffset(coverRecordIndex + 1);
    const imageSize = nextRecordOffset - coverImageOffset;

    // Validate image size
    if (imageSize <= 0 || imageSize > 5000000) { // Max 5MB
      return '';
    }

    // Extract image data
    const imageData = uint8Array.slice(coverImageOffset, nextRecordOffset);

    // Detect image type from magic bytes
    const mediaType = detectImageType(imageData);
    if (!mediaType) {
      return '';
    }

    // Convert to base64
    const base64 = arrayBufferToBase64(imageData);
    return `data:${mediaType};base64,${base64}`;
    
  } catch (error) {
    console.error('❌ Error extracting MOBI cover:', error);
    return '';
  }
};

// Helper function to detect image type from magic bytes
const detectImageType = (data: Uint8Array): string | null => {
  if (data.length < 4) return null;
  
  // JPEG: FF D8 FF
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return 'image/gif';
  }
  
  return null;
};

// Helper function to convert Uint8Array to base64
const arrayBufferToBase64 = (data: Uint8Array): string => {
  let binary = '';
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
};

// Helper function to parse EXTH header directly
const parseExthHeader = async (
  exthOffset: number, 
  dataView: DataView, 
  arrayBuffer: ArrayBuffer, 
  title: string, 
  author: string
): Promise<{
  title: string;
  author: string;
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  subjects?: string[];
  rights?: string;
  chapters: any[];
  totalChapters: number;
  format: string
}> => {
  const exthStart = exthOffset + 4; // skip 'EXTH'
  const headerLength = dataView.getUint32(exthStart, false); // big-endian
  const tagCount = dataView.getUint32(exthStart + 4, false); // big-endian
  
  let currentOffset = exthStart + 8;
  let extractedAuthor = author;
  let extractedDescription = '';
  
  for (let i = 0; i < tagCount && currentOffset < exthStart + headerLength; i++) {
    const tagId = dataView.getUint32(currentOffset, false);
    const tagLength = dataView.getUint32(currentOffset + 4, false);
    const tagDataOffset = currentOffset + 8;

    if (tagLength > 0 && tagLength < 10000 && tagDataOffset + tagLength <= arrayBuffer.byteLength) {
      const tagBytes = new Uint8Array(arrayBuffer, tagDataOffset, tagLength);
      let tagText = new TextDecoder('utf-8', { fatal: false }).decode(tagBytes);

      // Clean up null termination and control characters
      tagText = tagText.replace(/\0+$/, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();

      if (tagId === 100) { // Author
        extractedAuthor = tagText;
      } else if (tagId === 103) { // Description
        extractedDescription = tagText;
      }
    }
    
    currentOffset = tagDataOffset + ((tagLength + 3) & ~3);
  }
  
  // Create fallback description if none found
  if (!extractedDescription) {
    extractedDescription = `A MOBI book by ${extractedAuthor}. This appears to be "${title}" imported from a MOBI format file.`;
  }
  
  const estimatedChapters = Math.max(1, Math.floor(arrayBuffer.byteLength / 75000));
  const chapters = Array.from({ length: estimatedChapters }, (_, i) => ({
    label: `Chapter ${i + 1}`,
    href: `chapter-${i + 1}`,
    index: i
  }));
  
  return {
    title,
    author: extractedAuthor,
    publisher: undefined,
    pubDate: undefined,
    language: undefined,
    identifier: undefined,
    description: extractedDescription,
    subjects: [],
    rights: undefined,
    chapters,
    totalChapters: estimatedChapters,
    format: 'MOBI'
  };
};

// Helper function to extract MOBI metadata
const extractMobiMetadata = async (file: File): Promise<{
  title: string; 
  author: string; 
  publisher?: string;
  pubDate?: string;
  language?: string;
  identifier?: string;
  description?: string;
  subjects?: string[];
  rights?: string;
  chapters: any[]; 
  totalChapters: number; 
  format: string 
}> => {
  try {
    // MOBI files have a specific structure with PalmDOC header and EXTH headers
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Basic filename parsing as fallback - MOBI files often have good filename info
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    let title = fileName;
    let author = 'Unknown Author';
    
    // Try to extract from filename patterns first - this is often most reliable for MOBI
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
      // Try to detect common author patterns in the filename
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

    // Clean up common filename artifacts
    title = title.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    author = author.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Try to parse MOBI header for actual metadata using proper binary parsing
    try {
      // Convert to DataView for binary operations
      const dataView = new DataView(arrayBuffer);
      
      // Step 1: Read Palm Header - get number of records at byte 78
      if (arrayBuffer.byteLength < 84) {
        throw new Error('File too small for MOBI header');
      }
      
      const numRecords = safeReadUint16(dataView, 78, false);

      // Step 2: Find Record 0 to get MOBI Header position
      // Try both endianness - some MOBI files use little-endian
      let mobiHeaderStart = safeReadUint32(dataView, 80, false); // big-endian first

      // If the offset is unreasonable or null, try little-endian
      if (!mobiHeaderStart || mobiHeaderStart > arrayBuffer.byteLength || mobiHeaderStart < 100) {
        const littleEndianOffset = safeReadUint32(dataView, 80, true);
        if (littleEndianOffset && littleEndianOffset < arrayBuffer.byteLength && littleEndianOffset >= 100) {
          mobiHeaderStart = littleEndianOffset;
        }
      }
      
      // If still unreasonable or null, search for MOBI header manually
      if (!mobiHeaderStart || mobiHeaderStart > arrayBuffer.byteLength || mobiHeaderStart < 100) {
        mobiHeaderStart = -1;

        // Search for 'MOBI' string in the file (expand search to 20KB)
        const searchLimit = Math.min(arrayBuffer.byteLength - 4, 20000);
        for (let i = 0; i < searchLimit; i++) {
          if (uint8Array[i] === 77 && uint8Array[i + 1] === 79 && uint8Array[i + 2] === 66 && uint8Array[i + 3] === 73) {
            // Found 'MOBI', now look for 'BOOK' before it
            if (i >= 8 && uint8Array[i - 8] === 66 && uint8Array[i - 7] === 79 &&
                uint8Array[i - 6] === 79 && uint8Array[i - 5] === 75) {
              mobiHeaderStart = i - 8;
              break;
            }
            // Also try if MOBI is at the start (no BOOK prefix)
            if (i < 100) {
              mobiHeaderStart = i;
              break;
            }
          }
        }

        if (mobiHeaderStart === -1) {
          throw new Error('Could not locate MOBI header in file');
        }
      }

      // Step 3: Confirm MOBI header exists (more flexible validation)
      // Check for 'MOBI' at Start + 16 (more flexible)
      const mobiCheckOffset = mobiHeaderStart + 16;
      let isMobi = false;
      
      if (mobiCheckOffset + 4 <= arrayBuffer.byteLength) {
        isMobi = uint8Array[mobiCheckOffset] === 77 && uint8Array[mobiCheckOffset + 1] === 79 && 
                uint8Array[mobiCheckOffset + 2] === 66 && uint8Array[mobiCheckOffset + 3] === 73;
      }
      
      // If not found at +16, try other common offsets
      if (!isMobi && mobiHeaderStart + 4 <= arrayBuffer.byteLength) {
        // Try at the very start
        isMobi = uint8Array[mobiHeaderStart] === 77 && uint8Array[mobiHeaderStart + 1] === 79 &&
                uint8Array[mobiHeaderStart + 2] === 66 && uint8Array[mobiHeaderStart + 3] === 73;
      }

      // Try at +8 (some variations)
      if (!isMobi && mobiHeaderStart + 12 <= arrayBuffer.byteLength) {
        isMobi = uint8Array[mobiHeaderStart + 8] === 77 && uint8Array[mobiHeaderStart + 9] === 79 &&
                uint8Array[mobiHeaderStart + 10] === 66 && uint8Array[mobiHeaderStart + 11] === 73;
      }

      // isMobi may be false - continue anyway (some files have incorrect signatures)
      
      // Step 4: Read EXTH Flags at Start + 128
      const exthFlagsOffset = mobiHeaderStart + 128;
      const exthFlags = safeReadUint32(dataView, exthFlagsOffset, false);
      const hasExthFlag = exthFlags ? (exthFlags & 0x40) !== 0 : false; // Check bit 6

      // Step 5: Find EXTH Header (try even if flag is false - some files have incorrect flags)
      
      // Read header length at Start + 20
      const headerLength = safeReadUint32(dataView, mobiHeaderStart + 20, false);
      
      // EXTH should be at the end of MOBI header, but expand search area
      const exthSearchStart = headerLength ? mobiHeaderStart + headerLength : mobiHeaderStart + 232; // 232 is typical MOBI header size
      const exthSearchEnd = Math.min(exthSearchStart + 5000, arrayBuffer.byteLength - 4); // Expanded from 1000 to 5000
      
      let exthOffset = -1;
      for (let i = exthSearchStart; i < exthSearchEnd; i++) {
        if (uint8Array[i] === 69 && uint8Array[i + 1] === 88 && uint8Array[i + 2] === 84 && uint8Array[i + 3] === 72) {
          exthOffset = i;
          break;
        }
      }

      // If not found in expected location, try searching from beginning of file
      if (exthOffset === -1) {
        const broadSearchLimit = Math.min(arrayBuffer.byteLength - 4, 50000);
        for (let i = 0; i < broadSearchLimit; i++) {
          if (uint8Array[i] === 69 && uint8Array[i + 1] === 88 && uint8Array[i + 2] === 84 && uint8Array[i + 3] === 72) {
            exthOffset = i;
            break;
          }
        }
      }

      if (exthOffset === -1) {
        throw new Error('EXTH header not found');
      }
      
      // Step 6: Parse EXTH Tags with improved error handling
      const exthStart = exthOffset + 4; // skip 'EXTH'
      const exthHeaderLength = safeReadUint32(dataView, exthStart, false);
      const tagCount = safeReadUint32(dataView, exthStart + 4, false);
      
      if (!exthHeaderLength || !tagCount) {
        throw new Error('EXTH header corrupted');
      }
      
      let currentOffset = exthStart + 8; // after header length and tag count
      let extractedAuthor = '';
      let extractedPublisher = '';
      let extractedDescription = '';
      let description = ''; // Initialize description variable
      let tagsProcessed = 0;
      let tagsFailed = 0;
      
      // Parse tags with error recovery
      for (let i = 0; i < tagCount && currentOffset < exthStart + exthHeaderLength; i++) {
        try {
          const tagId = safeReadUint32(dataView, currentOffset, false);
          const tagLength = safeReadUint32(dataView, currentOffset + 4, false);
          
          if (!tagId || !tagLength) {
            tagsFailed++;
            currentOffset += 8; // Move past corrupted tag
            continue;
          }
          
          const tagDataOffset = currentOffset + 8;
          
          // Validate tag length is reasonable
          if (tagLength > 10000 || tagLength < 8 || tagDataOffset + tagLength - 8 > arrayBuffer.byteLength) {
            tagsFailed++;
            currentOffset += 8;
            continue;
          }
          
          const actualDataLength = tagLength - 8; // Tag length includes the 8-byte header
          const tagBytes = new Uint8Array(arrayBuffer, tagDataOffset, actualDataLength);
          let tagText = new TextDecoder('utf-8', { fatal: false }).decode(tagBytes);
          
          // Clean up text using helper function
          tagText = cleanExtractedText(tagText);
          
          // Only use text if it's valid
          if (isValidText(tagText)) {
            if (tagId === 100) { // Author
              extractedAuthor = tagText;
              tagsProcessed++;
            } else if (tagId === 101) { // Publisher
              extractedPublisher = tagText;
              tagsProcessed++;
            } else if (tagId === 103) { // Description
              extractedDescription = tagText;
              tagsProcessed++;
            }
          } else {
            tagsFailed++;
          }

          // Move to next tag (align to 4-byte boundary)
          currentOffset = tagDataOffset + ((actualDataLength + 3) & ~3);
        } catch (tagError) {
          tagsFailed++;
          currentOffset += 8; // Try to continue with next tag
        }
      }
      
      // Use extracted metadata if found (preserve partial metadata)
      if (extractedAuthor) {
        author = extractedAuthor;
      }
      if (extractedDescription) {
        description = extractedDescription;
      }
      
      // MOBI chapter estimation (rough approximation)
      const estimatedChapters = Math.max(1, Math.floor(file.size / 75000)); // Adjusted for MOBI
      const chapters = Array.from({ length: estimatedChapters }, (_, i) => ({
        label: `Chapter ${i + 1}`,
        href: `chapter-${i + 1}`,
        index: i
      }));
      
      // Extract cover image
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
        chapters,
        totalChapters: estimatedChapters,
        format: 'MOBI',
        coverImage
      };
      
    } catch (parseError) {
      // Fallback to filename-based extraction
      const description = `A MOBI book by ${author}.`;

      // Try to extract cover even if metadata parsing failed
      let coverImage = '';
      try {
        coverImage = await extractMobiCover(arrayBuffer);
      } catch (coverError) {
        // Cover extraction failed in fallback - proceed without cover
      }
      
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
  } catch (error) {
    console.error('Failed to extract MOBI metadata:', error);
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      author: 'Unknown Author',
      publisher: undefined,
      pubDate: undefined,
      language: undefined,
      identifier: undefined,
      description: undefined,
      subjects: [],
      rights: undefined,
      chapters: [],
      totalChapters: 0,
      format: 'MOBI',
      coverImage: ''
    };
  }
};

async function getStoredTrackerData(): Promise<StoredBookData> {
  try {
    const data = await storageService.getItem(TRACKER_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save books to storage
const saveStoredBooks = async (books: Book[]) => {
  try {
    await storageService.setItem('tome-reader-books', JSON.stringify(books));
  } catch (error) {
    console.error('Failed to save books:', error);
  }
};

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [trackerUpdateTick, setTrackerUpdateTick] = useState(0);
  const [trackerData, setTrackerData] = useState<StoredBookData>({});

  // Load tracker data on mount
  useEffect(() => {
    const loadTrackerData = async () => {
      const data = await getStoredTrackerData();
      setTrackerData(data);
    };
    loadTrackerData();
  }, []);

  // Subscribe to library service changes
  useEffect(() => {
    const updateBooks = () => {
      const libraryBooks = libraryService.getBooks();
      setBooks(libraryBooks);
    };
    
    const unsubscribe = libraryService.subscribe(updateBooks);
    updateBooks(); // Initial load
    
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleUpdate = () => setTrackerUpdateTick(t => t + 1);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("book-updated", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("book-updated", handleUpdate);
    };
  }, []);

  const sortedAndFilteredBooks = useMemo(() => {
    // First filter
    let result = books.filter(
      (book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Then sort
    switch (sortBy) {
      case "recent":
        result = [...result].sort((a, b) => {
          const aDate = trackerData[a.id]?.lastReadDate;
          const bDate = trackerData[b.id]?.lastReadDate;
          // Books with no read date go to the end
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
        break;
      case "title":
        result = [...result].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        result = [...result].sort((a, b) => a.author.localeCompare(b.author));
        break;
      case "progress":
        result = [...result].sort((a, b) => b.progress - a.progress);
        break;
    }

    return result;
  }, [books, searchQuery, sortBy, trackerUpdateTick]);

  const importBooks = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".epub,.mobi";
    input.multiple = true;
    
    input.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files) return;
      
      for (const file of files) {
        try {
          const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
          
          // Generate unique ID for the book
          const bookId = uuidv4();
          
          // Extract metadata from book (EPUB or MOBI)
          const { title, author, publisher, pubDate, language, identifier, description, subjects, rights, chapters, totalChapters, format, coverImage } = await extractBookMetadata(file);

          // Calculate reading metrics
          const { readingTime, pageCount } = calculateReadingMetrics(file.size);

          // FIX #2: Save metadata FIRST as "commit marker"
          // This ensures if file save fails, we don't orphan metadata
          
          const newBook: Book = {
            id: bookId,
            title: title || fileName,
            author: author,
            publisher: publisher,
            pubDate: pubDate,
            language: language,
            identifier: identifier,
            description: description || `Imported ${format}: ${fileName}`,
            subjects: subjects,
            rights: rights,
            coverImage: coverImage || '',
            filePath: '', // Temporary, will be updated after file is stored
            progress: 0,
            chapters: chapters,
            totalChapters: totalChapters,
            fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            estimatedReadingTime: readingTime,
            pageCount: pageCount,
          };

          // Save metadata with temporary filePath
          const updatedBooksWithTemp = [...books, newBook];
          libraryService.updateBooks(updatedBooksWithTemp);
          
          try {
            await saveStoredBooks(updatedBooksWithTemp);
          } catch (metadataError) {
            console.error(`❌ Failed to save metadata:`, metadataError);
            // Revert library state since metadata save failed
            libraryService.updateBooks(books);
            throw new Error(`Failed to save book metadata: ${metadataError}`);
          }

          // FIX #2: Now store the actual file
          let fileUrl: string;

          try {
            fileUrl = await fileStorage.storeFile(file, bookId);
          } catch (fileError) {
            console.error(`Failed to store file:`, fileError);

            // FIX #2: Clean up metadata entry on file storage failure
            // Remove the book we just added to metadata
            const cleanedBooks = books.filter(b => b.id !== bookId);
            libraryService.updateBooks(cleanedBooks);
            await saveStoredBooks(cleanedBooks);
            
            throw new Error(`Failed to store book file: ${fileError}`);
          }

          // FIX #2: Update book with actual file path and save metadata again
          const finalBook: Book = {
            ...newBook,
            filePath: fileUrl
          };
          
          const finalBooks = [...books, finalBook];
          libraryService.updateBooks(finalBooks);
          await saveStoredBooks(finalBooks);

          toast.success(`Successfully imported "${title}"`);
          
         } catch (error) {
           console.error(`❌ Failed to import ${file.name}:`, error);
           
           // Provide helpful, specific error messages
           const errorMessage = error instanceof Error ? error.message : String(error);
           let userMessage = `Failed to import "${file.name}"`;
           
           // Check for specific error types and provide guidance
           if (errorMessage.includes('Insufficient storage') || errorMessage.includes('storage') || errorMessage.toLowerCase().includes('quota')) {
             const requiredMB = /(\d+)MB/.exec(errorMessage)?.[1];
             userMessage = `⚠️ Storage full: Need ${requiredMB || 'more'}MB available. Delete some books to free up space.`;
           } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
             userMessage = `❌ Connection failed. Check your internet and try again.`;
           } else if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
             userMessage = `❌ File may be corrupted. Try a different book.`;
           } else if (errorMessage.includes('unsupported') || errorMessage.includes('format')) {
             userMessage = `❌ File format not supported. Only EPUB and MOBI files are supported.`;
           } else if (errorMessage.includes('metadata')) {
             userMessage = `❌ Could not read book information. The file might be corrupted.`;
           }
           
           toast.error(userMessage);
         }
      }
    };
    
    // Trigger file picker
    input.click();
  }, [books]);

  const addBook = useCallback(async (bookData: Omit<Book, 'id'>) => {
    const newBook: Book = {
      ...bookData,
      id: uuidv4(),
      progress: 0,
    };
    const updatedBooks = [...books, newBook];
    libraryService.updateBooks(updatedBooks);
    await saveStoredBooks(updatedBooks);
    return newBook;
  }, [books]);

  const updateProgress = useCallback(async (bookId: string, progress: number) => {
    // Only update library service silently - don't notify listeners to prevent loops
    const currentBooks = libraryService.getBooks();
    const updatedBooks = currentBooks.map(book => 
      book.id === bookId 
        ? { ...book, progress: Math.min(100, Math.max(0, progress)) }
        : book
    );
    
    // Update library service silently and save to storage
    libraryService.updateBooksSilent(updatedBooks);
    await saveStoredBooks(updatedBooks);
  }, []); // Remove books dependency to prevent loops

  const removeBook = useCallback(async (bookId: string) => {
    try {
      // Delete the file from storage
      await fileStorage.deleteFile(bookId);
      
      // Remove from library service
      const updatedBooks = books.filter((book) => book.id !== bookId);
      libraryService.updateBooks(updatedBooks);
      await saveStoredBooks(updatedBooks);
      
      // Clean up tracking data
      const storedData = await storageService.getItem('book-tracker-data');
      if (storedData) {
        const trackerData = JSON.parse(storedData);
        delete trackerData[bookId];
        await storageService.setItem('book-tracker-data', JSON.stringify(trackerData));
      }
      
      // Clean up any other stored data for this book
      await storageService.removeItem(`tome-reader-book-${bookId}`);
    } catch (error) {
      console.error('Failed to remove book:', error);
    }
  }, [books]);

  const lastReadBook = useMemo(() => {
    if (searchQuery !== "") return null;
    
    // Only show books that have actual reading progress (> 0%)
    const booksWithProgress = books.map(book => ({
      ...book,
      lastReadDate: trackerData[book.id]?.lastReadDate ? new Date(trackerData[book.id].lastReadDate) : null,
      progress: trackerData[book.id]?.progress ?? 0
    })).filter(book => book.progress > 0 && book.lastReadDate !== null);

    if (booksWithProgress.length > 0) {
      return booksWithProgress.sort((a, b) => 
        (b.lastReadDate?.getTime() ?? 0) - (a.lastReadDate?.getTime() ?? 0)
      )[0];
    }

    // No books with actual progress - don't show continue reading
    return null;
  }, [books, searchQuery, trackerUpdateTick, trackerData]);

  return {
    books: sortedAndFilteredBooks,
    allBooks: books,
    lastReadBook,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    importBooks,
    addBook,
    updateProgress,
    removeBook,
    isEmpty: books.length === 0,
    isLoading: false, // Always false after app initialization
  };
}
