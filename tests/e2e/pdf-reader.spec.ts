import { test, expect } from '@playwright/test';
import { APP_VERSION, PDF_PATH, importAndOpenReader, waitForReaderReady, openReaderOverlay, closeReaderOverlay } from './helpers';

test.describe('PDF Reader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate((version) => {
      localStorage.setItem('CapacitorStorage.offreader-last-visit', new Date().toISOString());
      localStorage.setItem('CapacitorStorage.offreader-last-seen-version', version);
      localStorage.setItem('CapacitorStorage.offreader-tour-completed', new Date().toISOString());
    }, APP_VERSION);
    await page.reload();
    await importAndOpenReader(page, PDF_PATH, /minimal/i);
  });

  test('PDF loads without errors', async ({ page }) => {
    await waitForReaderReady(page);
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test('zoom toolbar is hidden when overlay is closed', async ({ page }) => {
    await waitForReaderReady(page);
    // Overlay starts closed — toolbar should be in hidden state
    await expect(page.getByTestId('pdf-zoom-toolbar')).toHaveClass(/pointer-events-none/);
  });

  test('zoom toolbar is visible when overlay is open', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);
    await expect(page.getByTestId('pdf-zoom-toolbar')).not.toHaveClass(/pointer-events-none/);
  });

  test('zoom toolbar hides again when overlay is closed', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);
    await expect(page.getByTestId('pdf-zoom-toolbar')).not.toHaveClass(/pointer-events-none/);

    // Toggle overlay off
    await closeReaderOverlay(page);
    await expect(page.getByTestId('pdf-zoom-toolbar')).toHaveClass(/pointer-events-none/);
  });

  test('can switch to Fit Width zoom', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);

    await page.getByRole('button', { name: 'Fit Width' }).click();
    await expect(page.getByTestId('zoom-label')).toHaveText('Fit Width');
  });

  test('can zoom in from named mode', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-label')).toHaveText('110%');
  });

  test('can zoom out from named mode', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);

    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page.getByTestId('zoom-label')).toHaveText('90%');
  });

  test('can reset to Fit Page after numeric zoom', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.getByTestId('zoom-label')).toHaveText('110%');

    await page.getByRole('button', { name: 'Fit Page' }).click();
    await expect(page.getByTestId('zoom-label')).toHaveText('Fit Page');
  });

  test('can navigate with arrow keys', async ({ page }) => {
    await waitForReaderReady(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });

  test('back button returns to library', async ({ page }) => {
    await waitForReaderReady(page);
    await openReaderOverlay(page);
    await page.getByRole('button', { name: /back/i }).click();
    await expect(page).toHaveURL('/');
  });
});
