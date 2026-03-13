/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Dynamic Playcount Threshold', () => {
  /**
   * Test that the play count increments after listening to more than 20% of a track.
   *
   * The dynamic threshold formula is: min(30 seconds, 20% of track duration)
   * For a 10-second track (our test fixtures), the threshold is 2 seconds.
   *
   * This test:
   * 1. Launches the app and waits for the library to load
   * 2. Gets the first visible track
   * 3. Notes the initial play count
   * 4. Double-clicks to play the track
   * 5. Waits for more than 20% of the track duration (>2 seconds for 10-second tracks)
   * 6. Pauses the track
   * 7. Verifies the play count has incremented by 1
   */
  test('should increment play count after listening to more than 20% of track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load with fixture data
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Get the first visible track
    const trackRow = page.locator('[data-track-id]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    // Get the track ID for later verification
    const trackId = await trackRow.getAttribute('data-track-id');
    expect(trackId).toBeTruthy();

    // Find the Plays column index by looking at the header row
    const headers = page.locator('thead th');
    const headerCount = await headers.count();
    let playsColumnIndex = -1;

    for (let i = 0; i < headerCount; i += 1) {
      const headerText = await headers.nth(i).textContent();
      if (headerText?.includes('Plays')) {
        playsColumnIndex = i;
        break;
      }
    }

    expect(playsColumnIndex).toBeGreaterThan(-1);

    // Get the initial play count value from the cell
    const playCountCell = trackRow.locator('td').nth(playsColumnIndex);
    const initialPlayCountText = await playCountCell.textContent();
    const initialPlayCount =
      initialPlayCountText?.trim() === '-'
        ? 0
        : parseInt(initialPlayCountText?.trim() || '0', 10);

    // Double-click the track to start playing
    await trackRow.dblclick();

    // Wait for the track to start playing
    await page.waitForTimeout(1000);

    // Verify play icon changed to pause icon (song is playing)
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Wait for more than 20% of the track duration
    // Track duration is 10 seconds, so 20% = 2 seconds
    // We wait 4 seconds to be safe (accounting for any startup delays)
    await page.waitForTimeout(4000);

    // Click the play/pause button to pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(500);

    // Verify pause icon changed to play icon (song is paused)
    const playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Wait a moment for the UI to update with the new play count
    await page.waitForTimeout(2000);

    // Get the updated play count value
    const updatedPlayCountText = await playCountCell.textContent();
    const updatedPlayCount =
      updatedPlayCountText?.trim() === '-'
        ? 0
        : parseInt(updatedPlayCountText?.trim() || '0', 10);

    // Verify the play count has incremented by 1
    expect(updatedPlayCount).toBe(initialPlayCount + 1);

    await TestHelpers.closeApp(app);
  });

  /**
   * Test that the play count does NOT increment if we pause before the threshold.
   *
   * This test:
   * 1. Launches the app
   * 2. Gets the first visible track
   * 3. Notes the initial play count
   * 4. Double-clicks to play the track
   * 5. Pauses BEFORE 20% of the track duration (< 2 seconds for 10-second tracks)
   * 6. Verifies the play count has NOT changed
   */
  test('should NOT increment play count if paused before 20% threshold', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load with fixture data
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Get the first visible track
    const trackRow = page.locator('[data-track-id]').first();
    await expect(trackRow).toBeVisible({ timeout: 5000 });

    // Get the track ID for later verification
    const trackId = await trackRow.getAttribute('data-track-id');
    expect(trackId).toBeTruthy();

    // Find the Plays column index by looking at the header row
    const headers = page.locator('thead th');
    const headerCount = await headers.count();
    let playsColumnIndex = -1;

    for (let i = 0; i < headerCount; i += 1) {
      const headerText = await headers.nth(i).textContent();
      if (headerText?.includes('Plays')) {
        playsColumnIndex = i;
        break;
      }
    }

    expect(playsColumnIndex).toBeGreaterThan(-1);

    // Get the initial play count value from the cell
    const playCountCell = trackRow.locator('td').nth(playsColumnIndex);
    const initialPlayCountText = await playCountCell.textContent();
    const initialPlayCount =
      initialPlayCountText?.trim() === '-'
        ? 0
        : parseInt(initialPlayCountText?.trim() || '0', 10);

    // Double-click the track to start playing
    await trackRow.dblclick();

    // Wait just a brief moment for playback to start
    await page.waitForTimeout(200);

    // Verify play icon changed to pause icon (song is playing)
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // IMMEDIATELY pause - don't wait any longer
    // The threshold is 2 seconds, so we need to pause well before that
    // Total time from dblclick to here should be < 1 second
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(500);

    // Verify pause icon changed to play icon (song is paused)
    const playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Wait a moment for any potential UI updates
    await page.waitForTimeout(2000);

    // Get the play count value - it should still be the same
    const updatedPlayCountText = await playCountCell.textContent();
    const updatedPlayCount =
      updatedPlayCountText?.trim() === '-'
        ? 0
        : parseInt(updatedPlayCountText?.trim() || '0', 10);

    // Verify the play count has NOT changed
    expect(updatedPlayCount).toBe(initialPlayCount);

    await TestHelpers.closeApp(app);
  });
});
