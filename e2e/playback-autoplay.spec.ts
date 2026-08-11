import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Auto-play Behaviors', () => {
  test('double-click song causes autoplay', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the first track row to play it
    const firstTrack = page.locator('[data-track-id]').first();
    const firstTrackTitle = await firstTrack
      .locator('td')
      .first()
      .textContent();
    await TestHelpers.startPlayback(page, firstTrack);

    // Verify the player bar shows the track we double-clicked
    await TestHelpers.waitForNowPlaying(page, firstTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('song completes → next auto-plays (not paused)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // The fixture tracks are ~10s long. Rather than sleeping past the end,
    // wait for the roll-over itself: the second row becomes the playing row
    // the instant Gapless-5 hands off.
    const secondTrack = page.locator('[data-track-id]').nth(1);
    await expect(secondTrack).toHaveClass(/vt-row-playing/, {
      timeout: 30000,
    });

    // Verify it kept playing across the transition rather than pausing.
    await TestHelpers.waitForPlaying(page);

    await TestHelpers.closeApp(app);
  });

  test('skip while playing → next auto-plays', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Click skip-next button
    await page.locator('[data-testid="skip-next-button"]').click();

    // Track changed to the second row, and playback continued.
    const secondTrack = page.locator('[data-track-id]').nth(1);
    await expect(secondTrack).toHaveClass(/vt-row-playing/);
    await TestHelpers.waitForPlaying(page);

    await TestHelpers.closeApp(app);
  });

  test('skip while paused → next stays paused', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Click pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    // Click skip-next button
    await page.locator('[data-testid="skip-next-button"]').click();

    // Track changed to the second row, and it stayed paused.
    const secondTrack = page.locator('[data-track-id]').nth(1);
    await expect(secondTrack).toHaveClass(/vt-row-playing/);
    await TestHelpers.waitForPaused(page);

    await TestHelpers.closeApp(app);
  });
});
