import { Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const APP_VERSION = createRequire(import.meta.url)('../../package.json').version as string;

export const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');
export const MOBI_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.mobi');
export const PDF_PATH = path.resolve(__dirname, '../books/minimal-document.pdf');
export const AZW3_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.azw3');
export const FB2_PATH = path.resolve(__dirname, '../books/test-book.fb2');
export const CBZ_PATH = path.resolve(__dirname, '../books/test-comic.cbz');
export const BAD_FILE_PATH = path.resolve(__dirname, '../books/bad-file.epub');

export async function importBook(page: Page, filePath: string): Promise<void> {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import book/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
  await page.getByRole('button', { name: /^done$/i }).click();
}

export async function importAndOpenDetail(
  page: Page,
  filePath: string,
  titlePattern: RegExp,
): Promise<void> {
  await importBook(page, filePath);
  await page.locator('h3').filter({ hasText: titlePattern }).waitFor({ timeout: 10000 });
  await page.locator('h3').filter({ hasText: titlePattern }).click();
}

export async function importAndOpenReader(
  page: Page,
  filePath: string,
  titlePattern: RegExp,
): Promise<void> {
  await importAndOpenDetail(page, filePath, titlePattern);
  await page.getByRole('button', { name: /start reading|continue reading|read again/i }).click();
}

export async function waitForReaderReady(page: Page): Promise<void> {
  await page.locator('foliate-view').waitFor({ state: 'attached', timeout: 15000 });
  await page.getByText(/loading book/i).waitFor({ state: 'hidden', timeout: 15000 });
}

async function tapReaderToToggleOverlay(page: Page): Promise<void> {
  const backButton = page.getByRole('button', { name: /back to library/i });
  const wasVisible = await backButton.isVisible().catch(() => false);

  await page.locator('.reader-container').click();
  const isVisible = await backButton.isVisible().catch(() => false);
  if (isVisible === wasVisible) {
    // Container tap can miss on mobile; tap foliate content as a fallback.
    await page.locator('foliate-view').click({ position: { x: 200, y: 400 } });
  }
}

export async function openReaderOverlay(page: Page): Promise<void> {
  const backButton = page.getByRole('button', { name: /back to library/i });
  if (await backButton.isVisible().catch(() => false)) return;

  await tapReaderToToggleOverlay(page);
  await backButton.waitFor({ state: 'visible', timeout: 5000 });
}

export async function closeReaderOverlay(page: Page): Promise<void> {
  const backButton = page.getByRole('button', { name: /back to library/i });
  if (!(await backButton.isVisible().catch(() => false))) return;

  await tapReaderToToggleOverlay(page);
  await backButton.waitFor({ state: 'hidden', timeout: 5000 });
}
