import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { APP_VERSION, importBook, EPUB_PATH, PDF_PATH } from './helpers.js';

/** Read all keys from the content-addressed blob store. */
function getBlobStoreKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('offreader-files');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('books')) {
            db.close();
            resolve([]);
            return;
          }
          const tx = db.transaction('books');
          const keysReq = tx.objectStore('books').getAllKeys();
          keysReq.onsuccess = () => resolve(keysReq.result as string[]);
          keysReq.onerror = () => reject(keysReq.error);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}

/** Pick files via the import dialog without clicking PostImportDialog's Done , 
 *  for flows where nothing new imports (e.g. duplicates). */
async function pickImportFiles(page: Page, filePaths: string[]): Promise<void> {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /import book/i }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePaths);
}

/** Duplicate a fixture so the same bytes import under a different filename. */
function duplicateFixture(srcPath: string, name: string): string {
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'offreader-')), name);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

test.describe('Content-addressed storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

  test('stores imported books as hash-keyed blobs in IndexedDB', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({
      timeout: 10000,
    });

    const keys = await getBlobStoreKeys(page);
    expect(keys.length).toBe(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{64}\.epub$/);
  });

  test('rejects a duplicate import and does not store bytes twice', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({
      timeout: 10000,
    });

    await pickImportFiles(page, [EPUB_PATH]);

    await expect(page.getByText(/already in your library/i)).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toHaveCount(1);
    expect(await getBlobStoreKeys(page)).toHaveLength(1);
  });

  test('rejects identical bytes under a different filename', async ({ page }) => {
    const renamed = duplicateFixture(EPUB_PATH, 'alice-again.epub');
    await importBook(page, EPUB_PATH);
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toBeVisible({
      timeout: 10000,
    });

    await pickImportFiles(page, [renamed]);

    // Dedup is by content hash, so a renamed copy is still a duplicate.
    await expect(page.getByText(/already in your library/i)).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: /alice/i })).toHaveCount(1);
    expect(await getBlobStoreKeys(page)).toHaveLength(1);
  });

  test('deletes the blob when its last referencing book is removed', async ({ page }) => {
    await importBook(page, EPUB_PATH);
    await page.locator('h3').filter({ hasText: /alice/i }).waitFor({ timeout: 10000 });
    expect(await getBlobStoreKeys(page)).toHaveLength(1);

    await page.locator('h3').filter({ hasText: /alice/i }).click();
    await page.getByRole('button', { name: /remove from device/i }).click();
    await page.getByRole('button', { name: /^Remove Book$/ }).click();

    await expect(page.getByText(/no books|import|add/i).first()).toBeVisible();
    await expect.poll(() => getBlobStoreKeys(page)).toHaveLength(0);
  });

  test('persists hash-keyed blobs across reload', async ({ page }) => {
    await importBook(page, PDF_PATH);
    await page.locator('h3').first().waitFor({ timeout: 10000 });
    const keysBefore = await getBlobStoreKeys(page);
    expect(keysBefore.length).toBe(1);

    await page.reload();

    await expect(page.locator('h3').first()).toBeVisible({ timeout: 10000 });
    expect(await getBlobStoreKeys(page)).toEqual(keysBefore);
  });
});
