import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

// Regression coverage for issue #140:
// deleting the song that is currently loaded in the player must clear
// the "now playing" UI and remove the track from the gapless-5 queue so it can
// no longer be heard or reached via Next.
test.describe('Issue #140 — deleting the playing song clears the now-playing UI', () => {
  test('single delete: clears now-playing UI and disables Next when the current song is removed', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await page.waitForTimeout(3000);
      await page.click('[data-testid="nav-library"]');
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-track-id]', { timeout: 5000 });

      const firstRow = page.locator('[data-track-id]').first();
      const trackId = await firstRow.getAttribute('data-track-id');
      const title = (
        await firstRow.locator('td').first().textContent()
      )?.trim();
      expect(title).toBeTruthy();

      // 1. Start playing the first song.
      await firstRow.dblclick();
      await page.waitForTimeout(1000);
      await expect(page.locator('svg[data-testid="PauseIcon"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toContainText(title!);

      // 2. Pause it (matches the issue's reproduction steps).
      await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
      await page.waitForTimeout(300);
      await expect(
        page.locator('svg[data-testid="PlayArrowIcon"]'),
      ).toBeVisible();

      // 3. Delete it via the right-click "Remove from Library" menu item.
      await firstRow.click({ button: 'right' });
      await page.waitForTimeout(500);
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();
      await menu.getByText('Remove from Library', { exact: true }).click();

      // 4. Confirm the deletion dialog.
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(1500);

      // 5. The now-playing UI is cleared back to the empty "nothing playing"
      // state (the `---` placeholder has no `now-playing-title` element).
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toHaveCount(0);

      // Next is disabled because nothing is loaded — the deleted track can't
      // be reached via the Next button.
      await expect(
        page.locator('[data-testid="skip-next-button"]'),
      ).toBeDisabled();

      // The deleted track is gone from the library.
      await expect(page.locator(`[data-track-id="${trackId}"]`)).toHaveCount(0);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('bulk delete: clears now-playing UI when the current song is in a multi-select deletion', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await page.waitForTimeout(3000);
      await page.click('[data-testid="nav-library"]');
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-track-id]', { timeout: 5000 });

      const rows = page.locator('[data-track-id]');
      const firstRow = rows.nth(0);
      const secondRow = rows.nth(1);
      const title = (
        await firstRow.locator('td').first().textContent()
      )?.trim();
      expect(title).toBeTruthy();

      // Play the first song (this selects it).
      await firstRow.dblclick();
      await page.waitForTimeout(1000);
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toContainText(title!);

      // Extend the selection to a second row so the multi-select menu shows.
      await secondRow.click({ modifiers: ['ControlOrMeta'] });
      await page.waitForTimeout(300);

      // Right-click a selected row -> multi-select context menu.
      await firstRow.click({ button: 'right' });
      await page.waitForTimeout(500);
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();
      await menu.getByText(/Remove From Library/i).click();

      // Confirm the bulk delete dialog.
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(1500);

      // Now-playing UI is cleared because the playing song was deleted.
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toHaveCount(0);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });
});
