import { storageService } from '@/services/storage';
import { Book } from '@/types/book';

export type ImportMode = NonNullable<Book['source']>;

const IMPORT_MODE_KEY = 'offreader-import-mode';

/**
 * Desktop default is 'linked' — read books in place from their source path
 * rather than duplicating them into app storage. Only consulted on Electron;
 * other platforms always import managed copies. Returns 'managed' on
 * web/Android anyway so a stray stored value can't surprise anyone.
 */
export async function getImportMode(): Promise<ImportMode> {
  if (!window.offreaderFiles) return 'managed';
  const stored = await storageService.getItem(IMPORT_MODE_KEY);
  return stored === 'managed' ? 'managed' : 'linked';
}

export async function setImportMode(mode: ImportMode): Promise<void> {
  await storageService.setItem(IMPORT_MODE_KEY, mode);
}
