/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Regression tests for the interaction between Gapless-5 auto-advance
 * and our skip-next fast path.
 *
 * After an auto-advance, Gapless-5's queue holds
 *   [finished, current, preloaded]
 * at indices [0, 1, 2]. A naive fast-path `gotoTrack(1)` lands on
 * `current` (restarts the playing song) instead of `preloaded`. The
 * store sets `currentTrack` to what *should* be playing, but Gapless-5
 * is actually playing the wrong track — UI and audio diverge.
 *
 * These tests verify the ACTUAL track Gapless-5 is playing
 * (via the `__hihat_e2e_getPlayerState` window hook), not just what
 * the store thinks is playing.
 */

interface PlayerState {
  storeCurrentTrackFilePath: string | null;
  storePreloadedTrackFilePath: string | null;
  storePreloadReady: boolean;
  playerQueueLength: number;
  playerIndex: number;
  playerCurrentFilePath: string | null;
}

async function readPlayerState(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
      (window as any).__hihat_e2e_getPlayerState() as PlayerState,
  );
}

test.describe('Autoplay → Skip regression', () => {
  test('after 1 autoplay, skip plays the next track (not the restarted current)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    await page.locator('[data-track-id]').nth(0).dblclick();
    await page.waitForTimeout(1000);

    const stateAfterPlay1 = await readPlayerState(page);
    const track1FilePath = stateAfterPlay1.storeCurrentTrackFilePath;
    expect(track1FilePath).toBeTruthy();

    // Let track 1 auto-advance to track 2 (fixtures are ~10s)
    await page.waitForTimeout(12000);

    const stateAfterAutoplay = await readPlayerState(page);
    const track2FilePath = stateAfterAutoplay.storeCurrentTrackFilePath;
    expect(track2FilePath).toBeTruthy();
    expect(track2FilePath).not.toBe(track1FilePath);

    // Gapless-5 should actually be playing track 2 (the store's view)
    expect(stateAfterAutoplay.playerCurrentFilePath).toBe(track2FilePath);

    // The scheduled cleanup (50ms) has long since fired — queue settles
    // to exactly 2 entries (current + preloaded) rather than 3.
    expect(stateAfterAutoplay.playerQueueLength).toBe(2);

    // The preloaded track is track 3 — record it so we can compare after skip
    const track3FilePath = stateAfterAutoplay.storePreloadedTrackFilePath;
    expect(track3FilePath).toBeTruthy();
    expect(track3FilePath).not.toBe(track2FilePath);

    // Hit skip — Gapless-5 should now play track 3.
    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(1500);

    const stateAfterSkip = await readPlayerState(page);

    // Both store and player should agree on track 3
    expect(stateAfterSkip.storeCurrentTrackFilePath).toBe(track3FilePath);
    // THIS is the bug-catching assertion: the player must actually be
    // playing track 3, not a restarted track 2.
    expect(stateAfterSkip.playerCurrentFilePath).toBe(track3FilePath);
    // Post-skip queue is clean (no accumulated stale).
    expect(stateAfterSkip.playerQueueLength).toBe(2);

    await TestHelpers.closeApp(app);
  });

  test('after 2 autoplays, skip plays the next track (no track skipped)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    await page.locator('[data-track-id]').nth(0).dblclick();
    await page.waitForTimeout(1000);

    // Let track 1 → track 2 → track 3 autoplay (2 auto-advances)
    await page.waitForTimeout(24000);

    const stateAfterAutoplay = await readPlayerState(page);
    const track3FilePath = stateAfterAutoplay.storeCurrentTrackFilePath;
    const track4FilePath = stateAfterAutoplay.storePreloadedTrackFilePath;
    expect(track3FilePath).toBeTruthy();
    expect(track4FilePath).toBeTruthy();

    // Store and player should agree on track 3
    expect(stateAfterAutoplay.playerCurrentFilePath).toBe(track3FilePath);
    // Queue stays bounded at 2 even after repeated auto-advances —
    // each scheduled cleanup fires before the next auto-advance.
    expect(stateAfterAutoplay.playerQueueLength).toBe(2);

    // Skip — Gapless-5 should now play track 4.
    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(1500);

    const stateAfterSkip = await readPlayerState(page);
    expect(stateAfterSkip.storeCurrentTrackFilePath).toBe(track4FilePath);
    // Bug-catching assertion:
    expect(stateAfterSkip.playerCurrentFilePath).toBe(track4FilePath);
    expect(stateAfterSkip.playerQueueLength).toBe(2);

    await TestHelpers.closeApp(app);
  });

  test('queue settles to 2 within 200ms after auto-advance', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    await page.locator('[data-track-id]').nth(0).dblclick();
    await page.waitForTimeout(1000);

    // Let track 1 auto-advance to track 2 (~10s fixtures) then wait just
    // past the 50ms scheduled cleanup.
    await page.waitForTimeout(11000);
    await page.waitForTimeout(200);

    const state = await readPlayerState(page);
    expect(state.playerQueueLength).toBe(2);
    expect(state.storeCurrentTrackFilePath).toBe(state.playerCurrentFilePath);

    await TestHelpers.closeApp(app);
  });
});
