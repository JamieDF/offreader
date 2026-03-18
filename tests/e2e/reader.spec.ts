import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');

test.describe('Reader', () => {
  // Import a book and navigate to reader before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Open book detail
    await page.locator('h3').filter({ hasText: /alice/i }).click();
    await expect(page).toHaveURL(/\/book\//);

    // Start reading
    await page.getByRole('button', { name: /start reading|continue reading|read again/i }).click();
    await expect(page).toHaveURL(/\/reader/);
  });

  test('reader loads without errors', async ({ page }) => {
    // foliate-view should be in the DOM
    await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
    // Loading spinner should disappear
    await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });
  });

  test('can navigate to next page', async ({ page }) => {
    await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
    await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });

    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test('shows reader overlay on tap', async ({ page }) => {
    await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
    await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });

    await page.locator('.reader-container').click();
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('displays chapter and page info in footer', async ({ page }) => {
    await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
    await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });

    await page.locator('.reader-container').click();
    await expect(page.getByText(/chapter \d+ of \d+/i)).toBeVisible({ timeout: 5000 });
  });

  test('back button returns to library', async ({ page }) => {
    await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
    await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL('/');
  });
});
