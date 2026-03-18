import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');
const MOBI_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.mobi');

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows empty library on first load', async ({ page }) => {
    await expect(page.getByText('TomeReader')).toBeVisible();
    await expect(page.getByText(/no books|import|add/i).first()).toBeVisible();
  });

  // Helper to click the import FAB and set files
  async function importBook(page: Page, filePath: string) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  test('imports an EPUB book', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });
  });

  test('imports a MOBI book', async ({ page }) => {
    await importBook(page, MOBI_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });
  });

  test('shows book in library after import', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Reload and check book persists
    await page.reload();
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 5000 });
  });

  test('opens book detail page on click', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await page.locator('h3').filter({ hasText: /alice/i }).click();
    await expect(page).toHaveURL(/\/book\//);
  });
});
