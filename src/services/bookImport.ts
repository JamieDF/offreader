import { v4 as uuidv4 } from "uuid";
import { toast } from "@/components/ui/toast";
import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { fileStorage } from "@/services/fileStorage";
import { calculateReadingMetrics } from "@/utils/readingMetrics";
import { extractBookMetadata } from "@/parsers/bookMetadataParser";
import { PdfMetadata } from "@/parsers/pdfParser";
import { EpubMetadata } from "@/parsers/epubParser";
import { MobiMetadata } from "@/parsers/mobiParser";
import { Azw3Metadata } from "@/parsers/azw3Parser";
import { Fb2Metadata } from "@/parsers/fb2Parser";
import { CbzMetadata } from "@/parsers/cbzParser";
import { saveStoredBooks } from "@/services/bookPersistence";
import { sha256Hex } from "@/utils/hash";
import { ImportMode } from "@/utils/importMode";

export interface ImportItem {
  file: File;
  /** Absolute source path for Electron imports: linked books keep reading
   *  from it; managed books record it as provenance. */
  sourcePath?: string;
  /** Pre-computed hash: folder sync hashes while scanning to detect moved
   *  files, so it passes the result through instead of hashing twice. */
  contentHash?: string;
}

export type ImportCallback = ((importedBooks: Book[]) => void) | undefined;

export function toastImportError(fileName: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  let userMessage = `Failed to import "${fileName}"`;

  if (errorMessage.includes('Insufficient storage') || errorMessage.includes('storage') || errorMessage.toLowerCase().includes('quota')) {
    const requiredMB = /(\d+)MB/.exec(errorMessage)?.[1];
    userMessage = `⚠️ Storage full: Need ${requiredMB || 'more'}MB available. Delete some books to free up space.`;
  } else if (errorMessage.includes('network') || errorMessage.includes('offline')) {
    userMessage = `❌ Connection failed. Check your internet and try again.`;
  } else if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
    userMessage = `❌ File may be corrupted. Try a different book.`;
  } else if (errorMessage.includes('unsupported') || errorMessage.includes('format')) {
    userMessage = `❌ File format not supported. Only EPUB, MOBI, AZW3, FB2, PDF, and CBZ files are supported.`;
  } else if (errorMessage.includes('metadata')) {
    userMessage = `❌ Could not read book information. The file might be corrupted.`;
  }

  toast.error(userMessage);
}

/**
 * Shared pipeline for every import path: hash → dedup → metadata → Book
 * record → (managed only) copy bytes into the content-addressed store.
 * Linked items keep their bytes at `sourcePath`: nothing is stored.
 */
export async function importFileItems(
  items: ImportItem[],
  source: ImportMode,
  onImportComplete?: ImportCallback,
  /** When provided, per-file failures are reported here instead of toasted , 
   *  folder sync uses this to dedupe failure notifications across rescans. */
  onFileError?: (item: ImportItem, error: unknown) => void,
): Promise<Book[]> {
  const newlyImportedBooks: Book[] = [];

  for (const { file, sourcePath, contentHash: precomputedHash } of items) {
    try {
      const fileName = file.name.replace(/\.[^/.]+$/, "");

      // Content-hash first: identical bytes never get a second book.
      const contentHash = precomputedHash ?? await sha256Hex(file);
      const existing = libraryService.getBooks().find(b => b.contentHash === contentHash);
      if (existing) {
        toast.info(`"${existing.title}" is already in your library`);
        continue;
      }

      const bookId = uuidv4();

      const extractedMeta = await extractBookMetadata(file);
      const { title, author, publisher, pubDate, language, identifier, description, subjects, rights, chapters, totalChapters, format, coverImage } = extractedMeta as { title: string; author: string; publisher?: string; pubDate?: string; language?: string; identifier?: string; description?: string; subjects?: string[]; rights?: string; chapters: { label: string; href: string; index: number }[]; totalChapters: number; format: string; coverImage?: string };

      const pdfMeta = format === 'PDF' ? (extractedMeta as PdfMetadata) : null;
      const epubMeta = format === 'EPUB' ? (extractedMeta as EpubMetadata) : null;
      const mobiMeta = format === 'MOBI' ? (extractedMeta as MobiMetadata) : null;
      const azw3Meta = format === 'AZW3' ? (extractedMeta as Azw3Metadata) : null;
      const fb2Meta = format === 'FB2' ? (extractedMeta as Fb2Metadata) : null;
      const cbzMeta = format === 'CBZ' ? (extractedMeta as CbzMetadata) : null;
      const { readingTime: calcReadingTime, pageCount: calcPageCount } = calculateReadingMetrics(file.size);
      const readingTime = pdfMeta?.readingTime ?? epubMeta?.readingTime ?? mobiMeta?.readingTime
        ?? azw3Meta?.readingTime ?? fb2Meta?.readingTime ?? cbzMeta?.readingTime ?? calcReadingTime;
      const pageCount = pdfMeta?.pageCount ?? epubMeta?.pageCount ?? mobiMeta?.pageCount
        ?? azw3Meta?.pageCount ?? fb2Meta?.pageCount ?? cbzMeta?.pageCount ?? calcPageCount;

      const newBook: Book = {
        id: bookId,
        title: title || fileName,
        author: author,
        format: (format as Book['format']) ?? 'EPUB',
        publisher: publisher,
        pubDate: pubDate,
        language: language,
        identifier: identifier,
        description: description || `Imported ${format}: ${fileName}`,
        subjects: subjects,
        rights: rights,
        coverImage: coverImage || '',
        filePath: '',
        progress: 0,
        chapters: chapters,
        totalChapters: totalChapters,
        fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        estimatedReadingTime: readingTime,
        pageCount: pageCount,
        shelfId: null,
        labelIds: [],
        contentHash,
        source,
        sourcePath,
      };

      // Always build from the live book list: `books` state is stale within
      // a multi-file import loop.
      const updatedBooksWithTemp = [...libraryService.getBooks(), newBook];
      libraryService.updateBooks(updatedBooksWithTemp);

      try {
        await saveStoredBooks(updatedBooksWithTemp);
      } catch (metadataError) {
        console.error(`❌ Failed to save metadata:`, metadataError);
        libraryService.updateBooks(libraryService.getBooks().filter(b => b.id !== bookId));
        throw new Error(`Failed to save book metadata: ${metadataError}`);
      }

      if (source === 'managed') {
        try {
          await fileStorage.storeFile(file, contentHash);
        } catch (fileError) {
          console.error(`Failed to store file:`, fileError);

          const cleanedBooks = libraryService.getBooks().filter(b => b.id !== bookId);
          libraryService.updateBooks(cleanedBooks);
          await saveStoredBooks(cleanedBooks);

          throw new Error(`Failed to store book file: ${fileError}`);
        }
      }

      const finalBook: Book = {
        ...newBook,
        filePath: ''
      };

      const finalBooks = [...libraryService.getBooks().filter(b => b.id !== bookId), finalBook];
      libraryService.updateBooks(finalBooks);
      await saveStoredBooks(finalBooks);

      newlyImportedBooks.push(finalBook);

     } catch (error) {
        console.error(`❌ Failed to import ${file.name}:`, error);
        if (onFileError) {
          onFileError({ file, sourcePath, contentHash: precomputedHash }, error);
        } else {
          toastImportError(file.name, error);
        }
      }
  }

  // After all files processed, call the callback if provided
  if (newlyImportedBooks.length > 0) {
    toast.success(`Successfully imported ${newlyImportedBooks.length} book${newlyImportedBooks.length > 1 ? 's' : ''}`);
    onImportComplete?.(newlyImportedBooks);
  }

  return newlyImportedBooks;
}
