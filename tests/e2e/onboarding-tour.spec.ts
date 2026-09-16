import { test, expect, Page } from '@playwright/test';

// Tests in this file use an explicit baseURL so they can run against any
// locally-running dev server (5173, 5000, or whatever Playwright starts).
// The webServer config in playwright.config.ts will launch its own if none
// is running, on port 5000.
test.use({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:5000' });

async function clearStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
  });
}

test.describe('Onboarding tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    // Reload after clearing so the app boots with a clean state.
    await page.goto('/');
  });

  test('auto-launches on first load with the welcome step (fully dimmed)', async ({ page }) => {
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.driver-popover-title')).toContainText(/welcome to offreader/i);
    await expect(page.locator('.driver-popover-progress-text')).toContainText('1 of 6');

    // The welcome step uses driver.js's centered welcome mode — the overlay
    // path is fully visible (no cutout equals body). The popover sits
    // centred with the title visible.
    const overlay = page.locator('svg.driver-overlay');
    await expect(overlay).toBeVisible();
  });

  test('advances through all 6 steps and closes the tour', async ({ page }) => {
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });

    // Step 1 -> 2 (Add a book). Step 2's Next click also opens the demo
    // dialog via onNextClick -> startDemoImport.
    await page.locator('.driver-popover-next-btn').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.driver-popover-title')).toContainText(/add a book/i);
    await expect(page.locator('.driver-popover-progress-text')).toContainText('2 of 6');

    // Step 2 -> 3 (Edit the new book). The demo dialog is now open.
    await page.locator('.driver-popover-next-btn').click();
    await page.waitForTimeout(600);
    await expect(page.locator('.driver-popover-title')).toContainText(/edit the new book/i);
    await expect(page.locator('.driver-popover-progress-text')).toContainText('3 of 6');
    await expect(page.locator('[data-tour="import-dialog-metadata"]')).toBeVisible();

    // Step 3 -> 4 (Shelf and label). Both metadata and shelf steps
    // confirm the demo import and advance.
    await page.locator('.driver-popover-next-btn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.driver-popover-title')).toContainText(/set a shelf and a label/i);
    await expect(page.locator('.driver-popover-progress-text')).toContainText('4 of 6');
    await expect(page.locator('[data-tour="import-dialog-shelf"]')).toBeVisible();

    // Step 4 -> 5 (Open a book). Demo card appears, dialog gone.
    await page.locator('.driver-popover-next-btn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.driver-popover-title')).toContainText(/open a book/i);
    await expect(page.locator('.driver-popover-progress-text')).toContainText('5 of 6');
    await expect(page.locator('[data-tour="demo-book-card"]')).toBeVisible();

    // Step 5 -> 6 (Settings).
    await page.locator('.driver-popover-next-btn').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.driver-popover-title')).toContainText(/settings/i);
    await expect(page.locator('.driver-popover-progress-text')).toContainText('6 of 6');

    // Step 6 -> Done. Tour closes, demo state cleared.
    await page.locator('.driver-popover-next-btn').click();
    await expect(page.locator('.driver-popover')).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-tour="demo-book-card"]')).not.toBeVisible();
    await expect(page.locator('[data-tour="import-dialog-metadata"]')).not.toBeVisible();

    // Completion marker persisted.
    const completed = await page.evaluate(() =>
      localStorage.getItem('CapacitorStorage.offreader-tour-completed'),
    );
    expect(completed).toBeTruthy();
  });

  test('does not auto-launch after completion', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'CapacitorStorage.offreader-tour-completed',
        new Date().toISOString(),
      );
    });

    await page.goto('/');
    await page.waitForTimeout(1500);

    await expect(page.locator('.driver-popover')).not.toBeVisible();
  });

  test('replay launches tour from the About page', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'CapacitorStorage.offreader-tour-completed',
        new Date().toISOString(),
      );
      localStorage.setItem(
        'CapacitorStorage.offreader-last-visit',
        new Date().toISOString(),
      );
      localStorage.setItem(
        'CapacitorStorage.offreader-last-seen-version',
        '0.9.0',
      );
    });

    await page.goto('/about');
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByText(/take the tour/i)).toBeVisible();

    await page.getByText(/take the tour/i).click();

    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });
  });

  test('clicking outside the popover shows the exit-confirm bubble', async ({ page }) => {
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });

    // Click outside the popover (top-left corner of viewport). Use the
    // mouse directly so we land on the overlay, not on the popover's
    // own click area.
    await page.mouse.click(50, 50);
    await page.waitForTimeout(400);

    const exitConfirm = page.locator('[data-testid="tour-exit-confirm"]');
    await expect(exitConfirm).toBeAttached();
    await expect(exitConfirm).toContainText(/end the tour\?/i);

    // "Stay on tour" dismisses the bubble without ending the tour.
    await page.locator('[data-testid="tour-stay"]').click();
    await page.waitForTimeout(300);
    await expect(exitConfirm).not.toBeAttached();
    await expect(page.locator('.driver-popover')).toBeVisible();
  });

  test('clicking outside the popover and confirming "End tour" closes the tour', async ({ page }) => {
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });
    await page.mouse.click(50, 50);
    await page.waitForTimeout(400);

    await expect(page.locator('[data-testid="tour-exit-confirm"]')).toBeAttached();

    await page.locator('[data-testid="tour-end"]').click();
    await expect(page.locator('.driver-popover')).not.toBeVisible({ timeout: 3000 });
  });

  test('welcome popover is centered on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 800 });

    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 5000 });

    // Step 1 (welcome) uses driver.js centered mode. The popover sits at
    // the middle of the screen within the viewport bounds.
    const box = await page.locator('.driver-popover').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(412);
  });
});