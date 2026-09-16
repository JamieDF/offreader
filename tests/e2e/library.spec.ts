import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_VERSION } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');
const MOBI_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.mobi');
const BAD_FILE_PATH = path.resolve(__dirname, '../books/bad-file.epub');

// Helper to click the import FAB and set files
async function importBook(page: Page, filePath: string) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import book/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Pre-seed storage so the welcome dialog and onboarding tour don't
    // appear during these tests. They're tested separately in
    // onboarding-tour.spec.ts.
    await page.evaluate((version) => {
      localStorage.setItem(
        'CapacitorStorage.offreader-last-visit',
        new Date().toISOString(),
      );
      localStorage.setItem('CapacitorStorage.offreader-last-seen-version', version);
      localStorage.setItem(
        'CapacitorStorage.offreader-tour-completed',
        new Date().toISOString(),
      );
    }, APP_VERSION);
    await page.reload();
  });

  test('shows empty library on first load', async ({ page }) => {
    await expect(page.getByText('OffReader')).toBeVisible();
    await expect(page.getByText(/no books|import|add/i).first()).toBeVisible();
  });

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

test.describe('Shelves and Labels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('creates a shelf via Manage Library', async ({ page }) => {
    // Open Manage Library
    await page.getByRole('button', { name: /manage library/i }).click();
    await expect(page.getByText('Manage Library')).toBeVisible();

    // Create new shelf
    await page.getByRole('button', { name: /add shelf/i }).click();
    await page.getByPlaceholder('Shelf name').fill('My Test Shelf');
    await page.getByRole('button', { name: /create/i }).click();

    // Verify shelf appears
    await expect(page.getByText('My Test Shelf')).toBeVisible();
  });

  test('creates a label via Manage Library', async ({ page }) => {
    // Open Manage Library
    await page.getByRole('button', { name: /manage library/i }).click();
    await expect(page.getByText('Manage Library')).toBeVisible();

    // Create new label
    await page.getByRole('button', { name: /add label/i }).click();
    await page.getByPlaceholder('Label name').fill('Fiction');
    await page.getByRole('button', { name: /create/i }).click();

    // Verify label appears
    await expect(page.getByText('Fiction')).toBeVisible();
  });

  test('assigns shelf to book via import dialog', async ({ page }) => {
    // Import a book
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    // Wait for import dialog to appear
    await expect(page.getByText('Assign to shelf')).toBeVisible({ timeout: 5000 });

    // Create a new shelf in the dialog
    await page.getByText('Create new shelf').click();
    await page.getByPlaceholder('Shelf name').fill('Reading List');
    await page.getByRole('button', { name: /create/i }).click();

    // Apply the import
    await page.getByRole('button', { name: /done/i }).click();

    // Verify book appears in library
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Verify shelf badge appears on BookCard
    await expect(page.getByText('Reading List').first()).toBeVisible();
  });

  test('assigns label to book via import dialog', async ({ page }) => {
    // Import a book
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    // Wait for import dialog to appear
    await expect(page.getByText('Assign labels')).toBeVisible({ timeout: 5000 });

    // Create a new label in the dialog
    await page.getByText('Create new label').click();
    await page.getByPlaceholder('Label name').fill('Sci-Fi');
    await page.getByRole('button', { name: /create/i }).click();

    // Apply the import
    await page.getByRole('button', { name: /done/i }).click();

    // Verify book appears in library
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Verify label pill appears on BookCard
    await expect(page.getByText('Sci-Fi').first()).toBeVisible();
  });

  test('filters books by shelf via FilterToolbar', async ({ page }) => {
    // Import book and assign to a shelf
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    await expect(page.getByText('Assign to shelf')).toBeVisible({ timeout: 5000 });
    await page.getByText('Create new shelf').click();
    await page.getByPlaceholder('Shelf name').fill('Favorites');
    await page.getByRole('button', { name: /create/i }).click();
    await page.getByRole('button', { name: /done/i }).click();

    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Import a second book without shelf
    const fileChooserPromise2 = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser2 = await fileChooserPromise2;
    await fileChooser2.setFiles(MOBI_PATH);
    await expect(page.getByText('Assign to shelf')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /done/i }).click();

    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Filter by shelf
    await page.getByRole('button', { name: /shelf/i }).click();
    await page.getByText('Favorites').click();

    // Verify only the book with shelf is shown
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible();
    // Should only see 1 book (the one with shelf)
    const bookCards = page.locator('button:has(h3)');
    await expect(bookCards).toHaveCount(1);
  });

  test('filters books by label via FilterToolbar', async ({ page }) => {
    // Import book and assign a label
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    await expect(page.getByText('Assign labels')).toBeVisible({ timeout: 5000 });
    await page.getByText('Create new label').click();
    await page.getByPlaceholder('Label name').fill('Adventure');
    await page.getByRole('button', { name: /create/i }).click();
    await page.getByRole('button', { name: /done/i }).click();

    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Filter by label
    await page.getByRole('button', { name: /labels/i }).click();
    await page.getByText('Adventure').click();

    // Verify the book with label is shown
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible();
  });

  test('clear button resets filters', async ({ page }) => {
    // Import book and assign a shelf
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    await expect(page.getByText('Assign to shelf')).toBeVisible({ timeout: 5000 });
    await page.getByText('Create new shelf').click();
    await page.getByPlaceholder('Shelf name').fill('Reading');
    await page.getByRole('button', { name: /create/i }).click();
    await page.getByRole('button', { name: /done/i }).click();

    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Apply a filter
    await page.getByRole('button', { name: /shelf/i }).click();
    await page.getByText('Reading').click();

    // Verify filter is applied (book count shows something)
    await expect(page.getByText('Reading')).toBeVisible();

    // Click clear
    await page.getByRole('button', { name: /clear/i }).click();

    // Verify all books are shown again
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible();
  });

  test('deleting label removes it from books', async ({ page }) => {
    // Import book and assign label
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /import book/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(EPUB_PATH);

    await expect(page.getByText('Assign labels')).toBeVisible({ timeout: 5000 });
    await page.getByText('Create new label').click();
    await page.getByPlaceholder('Label name').fill('To Read');
    await page.getByRole('button', { name: /create/i }).click();
    await page.getByRole('button', { name: /done/i }).click();

    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({ timeout: 10000 });

    // Open Manage Library
    await page.getByRole('button', { name: /manage library/i }).click();

    // Delete the label
    await page.getByText('To Read').hover();
    await page.getByRole('button', { name: /delete/i }).click();

    // Close Manage Library
    await page.getByRole('button', { name: /close/i }).click();

    // Verify label is no longer shown on BookCard
    await expect(page.getByText('To Read')).not.toBeVisible();
  });
});