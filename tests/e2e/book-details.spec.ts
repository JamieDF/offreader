import { test, expect } from '@playwright/test';
import { APP_VERSION, importAndOpenDetail, EPUB_PATH } from './helpers.js';

test.describe('Book Details', () => {
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
    await importAndOpenDetail(page, EPUB_PATH, /alice/i);
    await expect(page).toHaveURL(/\/book\//);
  });

  test('shows book title and author', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: /alice/i })).toBeVisible();
    await expect(page.getByText(/lewis carroll/i).first()).toBeVisible();
  });

  test('shows initial reading progress at 0%', async ({ page }) => {
    await expect(page.getByText('0%')).toBeVisible();
  });

  test('shows start reading button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /start reading/i })).toBeVisible();
  });

  test('start reading button navigates to reader', async ({ page }) => {
    await page.getByRole('button', { name: /start reading/i }).click();
    await expect(page).toHaveURL(/\/reader/);
  });

  test('mark as finished toggle is interactable', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /mark as finished/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await expect(toggle).toBeChecked();
  });

  test('mark as finished persists after reload', async ({ page }) => {
    await page.getByRole('switch', { name: /mark as finished/i }).click();
    await expect(page.getByRole('switch', { name: /mark as finished/i })).toBeChecked();

    await page.reload();
    await expect(page.getByRole('switch', { name: /mark as finished/i })).toBeChecked();
  });

  test('remove from device returns to empty library', async ({ page }) => {
    await page.getByRole('button', { name: /remove from device/i }).click();
    await page.getByRole('button', { name: /^Remove Book$/ }).click();

    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator('h3').filter({ hasText: /alice/i })).not.toBeVisible();
  });
});
