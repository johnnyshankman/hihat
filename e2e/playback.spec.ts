/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable radix */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Music Playback', () => {
  test('should play and pause songs', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load with fixture data
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Get the first track from fixture data and double-click to play
    const firstTrack = await page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify play icon changed to pause icon (song is playing)
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible();

    // Click the play/pause button to pause (find button containing the pause icon)
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(500);

    // Verify pause icon changed to play icon (song is paused)
    const playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible();

    // Click the play/pause button to resume (find button containing the play icon)
    await page.locator('button:has(svg[data-testid="PlayArrowIcon"])').click();
    await page.waitForTimeout(500);

    // Verify play icon changed back to pause icon (song is playing again)
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible();

    await TestHelpers.closeApp(app);
  });
});
