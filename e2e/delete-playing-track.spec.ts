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

  // Regression for the end-of-source desync: auto-advancing onto the LAST track
  // of a source (repeat off) used to leave currentTrack on the previous song and
  // preloadedTrack on the track actually playing, so deleting that playing track
  // mis-routed through removePreloadedTrack and restarted the previous one. The
  // fix commits the auto-advanced track as now-playing.
  //
  // Needs REAL-TIME gapless auto-advance (like playback-autoplay*.spec.ts): only
  // progresses on a focused/audible runner (CI), not a headless sandbox where the
  // Web Audio clock stalls. CI-verified.
  test('auto-advance to the last track then delete it: clears now-playing instead of resurrecting the previous track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await page.waitForTimeout(3000);
      await page.click('[data-testid="nav-library"]');
      await page.waitForTimeout(500);
      await page.waitForSelector('[data-track-id]', { timeout: 5000 });

      // Filter the library to a tiny source via search: "Digital Dreams" is an
      // album shared by 4 Aurora Synth tracks, giving a source with a real END
      // where findNextSong returns null (repeat off) — the desync trigger.
      // Staying in the library view (not a playlist) keeps "Remove from Library"
      // available, and all 4 matched rows render so nth() lookups are safe.
      await page.locator('[aria-label="Show/Hide search"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="search-input"]').fill('Digital Dreams');
      await page.waitForTimeout(800);

      const rows = page.locator('[data-track-id]');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const secondToLastRow = rows.nth(count - 2);
      const lastRow = rows.nth(count - 1);
      const secondTitle = (
        await secondToLastRow.locator('td').first().textContent()
      )?.trim();
      const lastTitle = (
        await lastRow.locator('td').first().textContent()
      )?.trim();
      const lastTrackId = await lastRow.getAttribute('data-track-id');
      expect(secondTitle).toBeTruthy();
      expect(lastTitle).toBeTruthy();
      expect(lastTitle).not.toEqual(secondTitle);

      // Play the SECOND-TO-LAST filtered track so the next natural finish
      // auto-advances onto the LAST one.
      await secondToLastRow.dblclick();
      await page.waitForTimeout(1000);
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toContainText(secondTitle!);

      // Let the ~10s track finish and auto-advance to the last track: the player
      // must now report the LAST track as now-playing (the crux of the fix).
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toContainText(lastTitle!, { timeout: 30000 });
      await expect(page.locator('svg[data-testid="PauseIcon"]')).toBeVisible();

      // Delete the now-playing last track (still rendered in the 4-row filtered
      // view) via the right-click "Remove from Library" menu item.
      const targetRow = page.locator(`[data-track-id="${lastTrackId}"]`);
      await targetRow.click({ button: 'right' });
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();
      await menu.getByText('Remove from Library', { exact: true }).click();

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await page.waitForTimeout(1500);

      // Deleting the playing track clears the now-playing UI instead of
      // resurrecting the previous track (pre-fix: removePreloadedTrack restarted
      // the second-to-last track, leaving now-playing populated).
      await expect(
        page.locator('[data-testid="now-playing-title"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="skip-next-button"]'),
      ).toBeDisabled();
    } finally {
      await TestHelpers.closeApp(app);
    }
  });
});
