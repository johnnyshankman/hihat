import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Music Playback', () => {
  test('should play and pause songs', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get the first track from fixture data and double-click to play
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Click the play/pause button to pause (find button containing the pause icon)
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();

    // Verify pause icon changed to play icon (song is paused)
    await expect(TestHelpers.playIcon(page)).toBeVisible();

    // Click the play/pause button to resume (find button containing the play icon)
    await page.locator('button:has(svg[data-testid="PlayArrowIcon"])').click();

    // Verify play icon changed back to pause icon (song is playing again)
    await expect(TestHelpers.pauseIcon(page)).toBeVisible();

    await TestHelpers.closeApp(app);
  });
});
