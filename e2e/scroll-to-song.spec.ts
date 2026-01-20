import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Scroll to Song', () => {
  test('should scroll to correct song after navigating away and back', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load and tracks to appear
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // 1. Change sort order to Title descending
    const titleHeaderButton = page
      .locator('th')
      .filter({ hasText: 'Title' })
      .locator('button')
      .first();
    await titleHeaderButton.click();
    await page.waitForTimeout(500);

    await page.locator('text=Sort by Title descending').click();
    await page.waitForTimeout(1000);

    // 2. Scroll down to find a track about 20 rows into the library (not at the top)
    const tableContainer = page.locator('.MuiTableContainer-root').first();
    await tableContainer.evaluate((c) => {
      c.scrollTop = 800; // Scroll down ~20 rows
    });
    await page.waitForTimeout(500);

    // Get a track from the middle of the visible area and play it
    const allVisibleTracks = page.locator('[data-track-id]');
    const trackCount = await allVisibleTracks.count();
    const middleTrack = allVisibleTracks.nth(Math.floor(trackCount / 2));
    const targetTrackId = await middleTrack.getAttribute('data-track-id');
    console.log('Playing track:', targetTrackId);

    // Double-click to play the track
    await middleTrack.dblclick();
    await page.waitForTimeout(1500);

    // Get the song title for later clicking in the player
    const trackTitle = await middleTrack.locator('td').first().textContent();
    console.log('Track title:', trackTitle);

    // 3. Scroll far away to the end so target track is not visible
    await tableContainer.evaluate((c) => {
      c.scrollTop = c.scrollHeight;
    });
    await page.waitForTimeout(500);

    // Verify track is NOT visible after scrolling
    await expect(
      page.locator(`[data-track-id="${targetTrackId}"]`),
    ).not.toBeVisible();

    // 4. Navigate to playlist view
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(1000);

    // 5. Click on the track title in Player to scroll back to library
    // Find the song title displayed in the player (use the actual track title we captured)
    const songTitleInPlayer = page.getByText(trackTitle!.trim(), { exact: true }).last();
    await expect(songTitleInPlayer).toBeVisible({ timeout: 5000 });
    await songTitleInPlayer.click();

    // Wait for the view to change and scroll to happen
    // The scroll function now polls until the table is ready (up to 2000ms)
    await page.waitForTimeout(2500);

    // 6. Verify the correct track is now visible (the bug causes wrong scroll position)
    // This should pass on FIRST click - not require a second click
    await expect(
      page.locator(`[data-track-id="${targetTrackId}"]`),
    ).toBeVisible({ timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('should maintain sort order after navigating away and back to library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

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
    const titleHeaderButton = page
      .locator('th')
      .filter({ hasText: 'Title' })
      .locator('button')
      .first();
    await titleHeaderButton.click();
    await page.waitForTimeout(500);
    await page.locator('text=Sort by Title descending').click();
    await page.waitForTimeout(1000);

    // Record the track order after sorting
    const trackOrderAfterSort = await getFirstTrackIds();
    console.log('Track order after sorting by Title desc:', trackOrderAfterSort);

    // 2. Navigate to playlist view
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(1000);

    // 3. Navigate back to library view
    await page.click('[data-testid="nav-library"]');
    await page.waitForTimeout(1000);

    // 4. Verify the sort order is maintained
    const trackOrderAfterReturn = await getFirstTrackIds();
    console.log('Track order after returning to library:', trackOrderAfterReturn);

    // The order should be the same
    expect(trackOrderAfterReturn).toEqual(trackOrderAfterSort);

    await TestHelpers.closeApp(app);
  });
});
