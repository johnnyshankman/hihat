import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/** Sort the library by Title descending and wait for the header to report it. */
async function sortByTitleDescending(page: Page) {
  const titleHeader = page.locator('th').filter({ hasText: 'Title' }).first();
  await titleHeader.click();
  await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
  await titleHeader.click();
  await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');
}

/** Id of the topmost rendered row — changes whenever the virtualizer re-ranges. */
async function firstRenderedTrackId(page: Page) {
  return page.locator('[data-track-id]').first().getAttribute('data-track-id');
}

test.describe('Scroll to Song', () => {
  test('should scroll to correct song after navigating away and back', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // 1. Change sort order to Title descending
    await sortByTitleDescending(page);

    // 2. Scroll down to find a track about 20 rows into the library (not at the top)
    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    const topRowBeforeScroll = await firstRenderedTrackId(page);
    await tableContainer.evaluate((c) => {
      c.scrollTop = 800; // Scroll down ~20 rows
    });
    // The virtualizer re-renders a new row range on the next frame; waiting for
    // the top row to change is the signal that it has.
    await expect
      .poll(() => firstRenderedTrackId(page))
      .not.toBe(topRowBeforeScroll);

    // Get a track from the middle of the visible area and play it
    const allVisibleTracks = page.locator('[data-track-id]');
    const trackCount = await allVisibleTracks.count();
    const middleTrack = allVisibleTracks.nth(Math.floor(trackCount / 2));
    const targetTrackId = await middleTrack.getAttribute('data-track-id');

    // Get the song title before playing, then double-click to play the track
    const trackTitle = await middleTrack.locator('td').first().textContent();
    await TestHelpers.startPlayback(page, middleTrack);

    // 3. Scroll far away to the end so target track is not visible
    await tableContainer.evaluate((c) => {
      c.scrollTop = c.scrollHeight;
    });

    // Verify track is NOT visible after scrolling
    await expect(
      page.locator(`[data-track-id="${targetTrackId}"]`),
    ).not.toBeVisible();

    // 4. Navigate to playlist view
    await page.click('[data-playlist-id="playlist-1"]');
    await TestHelpers.waitForTrackCount(page, 3);

    // 5. Click on the track title in Player to scroll back to library
    // Find the song title displayed in the player (use the actual track title we captured)
    const songTitleInPlayer = page
      .getByText(trackTitle!.trim(), { exact: true })
      .last();
    await expect(songTitleInPlayer).toBeVisible();
    await songTitleInPlayer.click();

    // 6. Verify the correct track is now visible (the bug causes wrong scroll
    // position). This should pass on FIRST click - not require a second click.
    await expect(
      page.locator(`[data-track-id="${targetTrackId}"]`),
    ).toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('should maintain sort order after navigating away and back to library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Helper to get first few track IDs
    const getFirstTrackIds = async () => {
      const rows = await page.locator('[data-track-id]').all();
      const ids = await Promise.all(
        rows.slice(0, 5).map(async (row) => {
          return row.getAttribute('data-track-id');
        }),
      );
      return ids;
    };

    // 1. Change sort order to Title descending
    await sortByTitleDescending(page);

    // Record the track order after sorting
    const trackOrderAfterSort = await getFirstTrackIds();

    // 2. Navigate to playlist view
    await page.click('[data-playlist-id="playlist-1"]');
    await TestHelpers.waitForTrackCount(page, 3);

    // 3. Re-open sidebar (it auto-closes after clicking a nav item)
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }

    // Navigate back to library view
    await page.click('[data-testid="nav-library"]');

    // 4. Verify the sort order is maintained
    await expect.poll(getFirstTrackIds).toEqual(trackOrderAfterSort);

    await TestHelpers.closeApp(app);
  });
});
