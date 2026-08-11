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

/**
 * Wait for a single auto-advance away from `fromFilePath` and return the
 * settled state. Fixture tracks are ~10s, so this resolves the moment
 * Gapless-5 hands off instead of sleeping past the end of the track.
 */
async function waitForAutoAdvance(
  page: import('@playwright/test').Page,
  fromFilePath: string | null,
): Promise<PlayerState> {
  await expect
    .poll(async () => (await readPlayerState(page)).storeCurrentTrackFilePath, {
      timeout: 30000,
    })
    .not.toBe(fromFilePath);
  return readPlayerState(page);
}

test.describe('Autoplay → Skip regression', () => {
  test('after 1 autoplay, skip plays the next track (not the restarted current)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').nth(0),
    );

    const stateAfterPlay1 = await readPlayerState(page);
    const track1FilePath = stateAfterPlay1.storeCurrentTrackFilePath;
    expect(track1FilePath).toBeTruthy();

    // Let track 1 auto-advance to track 2
    const stateAfterAutoplay = await waitForAutoAdvance(page, track1FilePath);
    const track2FilePath = stateAfterAutoplay.storeCurrentTrackFilePath;
    expect(track2FilePath).toBeTruthy();

    // Gapless-5 should actually be playing track 2 (the store's view)
    expect(stateAfterAutoplay.playerCurrentFilePath).toBe(track2FilePath);

    // The preloaded track is track 3 — record it so we can compare after skip
    const track3FilePath = stateAfterAutoplay.storePreloadedTrackFilePath;
    expect(track3FilePath).toBeTruthy();
    expect(track3FilePath).not.toBe(track2FilePath);

    // Hit skip — Gapless-5 should now play track 3.
    await page.locator('[data-testid="skip-next-button"]').click();

    // Both store and player must land on track 3. Polling on the player's own
    // view is the bug-catching assertion: it must actually be playing track 3,
    // not a restarted track 2.
    await expect
      .poll(async () => {
        const state = await readPlayerState(page);
        return {
          store: state.storeCurrentTrackFilePath,
          player: state.playerCurrentFilePath,
        };
      })
      .toEqual({ store: track3FilePath, player: track3FilePath });

    await TestHelpers.closeApp(app);
  });

  test('after 2 autoplays, skip plays the next track (no track skipped)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').nth(0),
    );

    const track1FilePath = (await readPlayerState(page))
      .storeCurrentTrackFilePath;

    // Let track 1 → track 2 → track 3 autoplay (2 auto-advances)
    const afterFirst = await waitForAutoAdvance(page, track1FilePath);
    const stateAfterAutoplay = await waitForAutoAdvance(
      page,
      afterFirst.storeCurrentTrackFilePath,
    );

    const track3FilePath = stateAfterAutoplay.storeCurrentTrackFilePath;
    const track4FilePath = stateAfterAutoplay.storePreloadedTrackFilePath;
    expect(track3FilePath).toBeTruthy();
    expect(track4FilePath).toBeTruthy();

    // Store and player should agree on track 3
    expect(stateAfterAutoplay.playerCurrentFilePath).toBe(track3FilePath);

    // Skip — Gapless-5 should now play track 4.
    await page.locator('[data-testid="skip-next-button"]').click();

    await expect
      .poll(async () => {
        const state = await readPlayerState(page);
        return {
          store: state.storeCurrentTrackFilePath,
          player: state.playerCurrentFilePath,
        };
      })
      .toEqual({ store: track4FilePath, player: track4FilePath });

    await TestHelpers.closeApp(app);
  });
});
