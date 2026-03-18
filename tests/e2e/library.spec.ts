import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');
const MOBI_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.mobi');
const BAD_FILE_PATH = path.resolve(__dirname, '../books/bad-file.epub');

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

  test('deletes a book from the library', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    await page.locator('h3').filter({ hasText: /alice/i }).click();
    await expect(page).toHaveURL(/\/book\//);

    await page.getByRole('button', { name: /remove from device/i }).click();
    await page.getByRole('button', { name: /^Remove Book$/ }).click();

    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator('h3').filter({ hasText: /alice/i })).not.toBeVisible();
  });

  test('search filters books by title', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /search/i }).click();
    await page.getByPlaceholder('Search books...').fill('alice');
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible();

    await page.getByPlaceholder('Search books...').fill('xyznotabook');
    await expect(page.locator('h3').filter({ hasText: /alice/i })).not.toBeVisible();
  });

  test('sort changes the selected sort option', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /sort by/i }).click();
    await page.getByRole('menuitem', { name: /title/i }).click();
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible();

    await page.getByRole('button', { name: /sort by title/i }).click();
    await page.getByRole('menuitem', { name: /author/i }).click();
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible();
  });

  test('rejects invalid epub and shows an error', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(BAD_FILE_PATH);

    // Should show an error — not add the file to the library
    await expect(page.getByText(/corrupted|invalid|not supported/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h3').filter({ hasText: /bad-file/i })).not.toBeVisible();
  });
});
