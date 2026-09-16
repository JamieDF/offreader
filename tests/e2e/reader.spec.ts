import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_VERSION } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');

async function waitForReaderReady(page: Page) {
  await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
  await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });
}

test.describe('Reader', () => {
  // Import a book and navigate to reader before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Pre-seed storage so the welcome dialog and onboarding tour don't
    // appear during these tests.
    await page.evaluate((version) => {
      localStorage.setItem('CapacitorStorage.offreader-last-visit', new Date().toISOString());
      localStorage.setItem('CapacitorStorage.offreader-last-seen-version', version);
      localStorage.setItem('CapacitorStorage.offreader-tour-completed', new Date().toISOString());
    }, APP_VERSION);
    await page.reload();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);
    await page.getByRole('button', { name: /^done$/i }).click();

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
    await expect(page.getByText(/page \d+ of \d+/i)).toBeVisible({ timeout: 5000 });
  });

  test('back button returns to library', async ({ page }) => {
    await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
    await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('can add a bookmark', async ({ page }) => {
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();

    await page.getByRole('button', { name: /bookmarks/i }).click();
    await expect(page.getByText('Bookmarks (0)')).toBeVisible();

    await page.getByRole('button', { name: /add current/i }).click();
    await expect(page.getByText('Bookmarks (1)')).toBeVisible();
  });

  test('can delete a bookmark', async ({ page }) => {
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();

    await page.getByRole('button', { name: /bookmarks/i }).click();
    await page.getByRole('button', { name: /add current/i }).click();
    await expect(page.getByText('Bookmarks (1)')).toBeVisible();

    await page.getByRole('button', { name: /delete bookmark/i }).click();
    await expect(page.getByText('Bookmarks (0)')).toBeVisible();
    await expect(page.getByText(/no bookmarks yet/i)).toBeVisible();
  });

  test('can open settings drawer', async ({ page }) => {
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();

    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Reading Settings')).toBeVisible();
  });

  test('can increase font size in settings', async ({ page }) => {
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Reading Settings')).toBeVisible();

    const fontSizeDisplay = page.getByText(/^\d+%$/).first();
    const before = await fontSizeDisplay.textContent();

    await page.getByRole('button', { name: /increase font size/i }).click();

    const after = await fontSizeDisplay.textContent();
    expect(after).not.toEqual(before);
  });

  test('can switch theme in settings', async ({ page }) => {
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Reading Settings')).toBeVisible();

    await page.locator('button[title="Night"]').click();
    await expect(page.locator('button[title="Night"]')).toHaveClass(/ring-2/);
  });

  test('theme setting persists after leaving and returning to reader', async ({ page }) => {
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Reading Settings')).toBeVisible();

    await page.locator('button[title="Night"]').click();
    await expect(page.locator('button[title="Night"]')).toHaveClass(/ring-2/);

    // Close drawer — overlay should still be visible, back button accessible
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL('/');

    // Re-open the book
    await page.locator('h3').filter({ hasText: /alice/i }).click();
    await page.getByRole('button', { name: /start reading|continue reading|read again/i }).click();
    await waitForReaderReady(page);
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /settings/i }).click();

    await expect(page.locator('button[title="Night"]')).toHaveClass(/ring-2/);
  });

  test('reading progress persists after leaving and returning', async ({ page }) => {
    await waitForReaderReady(page);

    // Navigate a few pages to build up progress
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // Go back to library
    await page.locator('.reader-container').click();
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL('/');

    // Re-open book detail — "Today" for Last Read confirms reading was tracked
    await page.locator('h3').filter({ hasText: /alice/i }).click();
    await expect(page).toHaveURL(/\/book\//);
    await expect(page.getByText('Today')).toBeVisible({ timeout: 5000 });
  });
});
