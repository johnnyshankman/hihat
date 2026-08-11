/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Skip Behaviors', () => {
  test('skip next multiple times while playing — stays playing', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Skip next 3 times, waiting for each transition to land so the clicks
    // aren't racing the store.
    for (let i = 0; i < 3; i++) {
      const previousTitle = await TestHelpers.nowPlayingTitle(page);
      await page.locator('[data-testid="skip-next-button"]').click();
      await TestHelpers.waitForNowPlayingChange(page, previousTitle);
    }

    // Verify still playing, and that we landed on the 4th track
    await TestHelpers.waitForPlaying(page);
    await expect(page.locator('[data-track-id]').nth(3)).toHaveClass(
      /vt-row-playing/,
    );

    await TestHelpers.closeApp(app);
  });

  test('skip previous while playing — stays playing', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the third track to start playback
    const thirdTrack = page.locator('[data-track-id]').nth(2);
    await TestHelpers.startPlayback(page, thirdTrack);

    // Skip previous (within 3 seconds so it goes to previous track)
    await page.locator('[data-testid="skip-previous-button"]').click();

    // Verify still playing, now on the second track
    await expect(page.locator('[data-track-id]').nth(1)).toHaveClass(
      /vt-row-playing/,
    );
    await TestHelpers.waitForPlaying(page);

    await TestHelpers.closeApp(app);
  });

  test('skip next then previous — returns to original track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the second track to start playback
    const secondTrack = page.locator('[data-track-id]').nth(1);
    await TestHelpers.startPlayback(page, secondTrack);
    const secondTrackTitle = await TestHelpers.nowPlayingTitle(page);

    // Skip next
    await page.locator('[data-testid="skip-next-button"]').click();
    await TestHelpers.waitForNowPlayingChange(page, secondTrackTitle);

    // Skip previous (within 3 seconds)
    await page.locator('[data-testid="skip-previous-button"]').click();

    // Verify still playing and back on the second track
    await TestHelpers.waitForNowPlaying(page, secondTrackTitle);
    await expect(secondTrack).toHaveClass(/vt-row-playing/);
    await TestHelpers.waitForPlaying(page);

    await TestHelpers.closeApp(app);
  });

  test('skip next while paused — stays paused on correct track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    // Skip next
    await page.locator('[data-testid="skip-next-button"]').click();

    // Verify still paused, now on the second track
    await expect(page.locator('[data-track-id]').nth(1)).toHaveClass(
      /vt-row-playing/,
    );
    await TestHelpers.waitForPaused(page);

    await TestHelpers.closeApp(app);
  });

  test('skip previous while paused — stays paused on correct track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the second track to start playback
    const secondTrack = page.locator('[data-track-id]').nth(1);
    await TestHelpers.startPlayback(page, secondTrack);

    // Pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    // Skip previous (within 3 seconds)
    await page.locator('[data-testid="skip-previous-button"]').click();

    // Verify still paused, now on the first track
    await expect(page.locator('[data-track-id]').first()).toHaveClass(
      /vt-row-playing/,
    );
    await TestHelpers.waitForPaused(page);

    await TestHelpers.closeApp(app);
  });
});
