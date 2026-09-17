import { test, expect } from '@playwright/test';
import {
  APP_VERSION,
  EPUB_PATH,
  MOBI_PATH,
  PDF_PATH,
  AZW3_PATH,
  FB2_PATH,
  CBZ_PATH,
  importAndOpenReader,
  waitForReaderReady,
  openReaderOverlay,
} from './helpers';

const FORMAT_CASES = [
  { label: 'EPUB', path: EPUB_PATH, title: /alice/i },
  { label: 'MOBI', path: MOBI_PATH, title: /alice/i },
  { label: 'PDF', path: PDF_PATH, title: /minimal/i },
  { label: 'AZW3', path: AZW3_PATH, title: /alice/i },
  { label: 'FB2', path: FB2_PATH, title: /test-book/i },
  { label: 'CBZ', path: CBZ_PATH, title: /test-comic/i },
] as const;

for (const { label, path, title } of FORMAT_CASES) {
  test.describe(`${label} reader`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.evaluate((version) => {
        localStorage.setItem('CapacitorStorage.offreader-last-visit', new Date().toISOString());
        localStorage.setItem('CapacitorStorage.offreader-last-seen-version', version);
        localStorage.setItem('CapacitorStorage.offreader-tour-completed', new Date().toISOString());
      }, APP_VERSION);
      await page.reload();
      await importAndOpenReader(page, path, title);
    });

    test('loads in the reader without errors', async ({ page }) => {
      await expect(page).toHaveURL(/\/reader/);
      await waitForReaderReady(page);
      await expect(page.getByText(/error loading book|failed to load/i)).not.toBeVisible();
    });

    test('back button returns to library', async ({ page }) => {
      await waitForReaderReady(page);
      await openReaderOverlay(page);
      await page.getByRole('button', { name: /back to library/i }).click();
      await expect(page).toHaveURL('/');
    });
  });
}
