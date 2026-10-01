import { Book } from "@/types/book";
import { libraryService } from "@/services/LibraryService";
import { fileStorage } from "@/services/fileStorage";
import { version as appVersion } from "../../package.json";

/**
 * Library export (Electron): writes every book's bytes plus a metadata JSON
 * into a user-picked directory. Linked books are copied natively from their
 * source path; managed books stream out of the content-addressed store.
 * Export is a backup snapshot — it doesn't change how the books are stored.
 */

const EXT_FOR_FORMAT: Record<string, string> = {
  PDF: '.pdf', MOBI: '.mobi', AZW3: '.azw3', FB2: '.fb2', CBZ: '.cbz', EPUB: '.epub',
};

function sanitizeFilename(name: string): string {
  // Strip Windows-forbidden chars + control chars, then trailing dots/spaces.
  return name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/[. ]+$/, '')
    .trim() || 'book';
}

export interface ExportResult {
  exported: number;
  failed: number;
  destDir: string;
}

export async function exportLibrary(destDir: string): Promise<ExportResult> {
  const files = window.offreaderFiles;
  if (!files) throw new Error('Export is only supported in the desktop app');

  const books = libraryService.getBooks();
  const usedNames = new Set<string>();
  let exported = 0;
  let failed = 0;

  for (const book of books) {
    const ext = EXT_FOR_FORMAT[book.format ?? 'EPUB'];
    let base = sanitizeFilename(`${book.title} - ${book.author}`);
    // Same title+author can legitimately appear twice (different editions) —
    // disambiguate with a short id suffix rather than overwrite.
    if (usedNames.has(base)) base = `${base} (${book.id.slice(0, 8)})`;
    usedNames.add(base);
    const destPath = `${destDir}/${base}${ext}`;

    try {
      if (book.source === 'linked' && book.sourcePath && !book.missing) {
        await files.copyFileToPath(book.sourcePath, destPath);
      } else {
        const blob = await fileStorage.retrieveBookBlob(book);
        const buffer = await blob.arrayBuffer();
        await files.writeFileToPath(destPath, new Uint8Array(buffer));
      }
      exported++;
    } catch (error) {
      console.error(`Failed to export ${book.title}:`, error);
      failed++;
    }
  }

  // Metadata snapshot — enough to rebuild the library elsewhere.
  const manifest = {
    exportedAt: new Date().toISOString(),
    appVersion,
    bookCount: books.length,
    books: books.map(({ chapters, ...b }) => b), // chapters are re-derivable
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  await files.writeFileToPath(`${destDir}/offreader-library.json`, manifestBytes);

  return { exported, failed, destDir };
}
