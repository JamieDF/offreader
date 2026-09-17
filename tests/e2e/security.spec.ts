import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_VERSION } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTED_EPUB_PATH = path.resolve(__dirname, '../books/epub-test-scripted.epub');
const SAFE_EPUB_PATH = path.resolve(__dirname, '../books/alice-in-wonderland.epub');

async function importAndOpenBook(page: Page, filePath: string, titlePattern: RegExp) {
  await page.goto('/');
  await page.evaluate((version) => {
    localStorage.setItem('CapacitorStorage.offreader-last-visit', new Date().toISOString());
    localStorage.setItem('CapacitorStorage.offreader-last-seen-version', version);
    localStorage.setItem('CapacitorStorage.offreader-tour-completed', new Date().toISOString());
  }, APP_VERSION);
  await page.reload();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import book/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);

  await page.getByRole('button', { name: /^done$/i }).click();
  await expect(page.locator('h3').filter({ hasText: titlePattern })).toBeVisible({ timeout: 10000 });
  await page.locator('h3').filter({ hasText: titlePattern }).click();
  await page.getByRole('button', { name: /start reading|continue reading|read again/i }).click();
  await expect(page.locator('foliate-view')).toBeAttached({ timeout: 15000 });
  await expect(page.getByText(/loading book/i)).not.toBeVisible({ timeout: 15000 });
}

test.describe('Security (CSP)', () => {
  test('blocks inline scripts in scripted EPUB', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    let alertFired = false;
    page.on('dialog', async dialog => {
      alertFired = true;
      await dialog.dismiss();
    });

    await importAndOpenBook(page, SCRIPTED_EPUB_PATH, /epub test/i);

    expect(alertFired).toBe(false);
    expect(cspViolations.length).toBeGreaterThan(0);
  });

  test('CSP does not block normal EPUB rendering', async ({ page }) => {
    const cspViolations: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });

    await importAndOpenBook(page, SAFE_EPUB_PATH, /alice/i);

    expect(cspViolations).toHaveLength(0);
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });
});
