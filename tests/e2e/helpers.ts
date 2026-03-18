import { Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');
export const MOBI_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.mobi');
export const BAD_FILE_PATH = path.resolve(__dirname, '../books/bad-file.epub');

export async function importBook(page: Page, filePath: string): Promise<void> {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import book/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
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

export async function openReaderOverlay(page: Page): Promise<void> {
  await page.locator('.reader-container').click();
}
