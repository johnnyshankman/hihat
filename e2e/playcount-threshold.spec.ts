/* eslint-disable no-await-in-loop */
import { test, expect, Locator, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/** Index of the "Plays" column in the header row. */
async function playsColumnIndex(page: Page): Promise<number> {
  const headers = page.locator('thead th');
  const headerCount = await headers.count();
  for (let i = 0; i < headerCount; i += 1) {
    const headerText = await headers.nth(i).textContent();
    if (headerText?.includes('Plays')) return i;
  }
  return -1;
}

/** Parse a play-count cell, treating the '-' placeholder as zero. */
async function readPlayCount(cell: Locator): Promise<number> {
  const text = (await cell.textContent())?.trim() ?? '';
  return text === '-' ? 0 : parseInt(text || '0', 10);
}

test.describe('Dynamic Playcount Threshold', () => {
  /**
   * Test that the play count increments after listening to more than 20% of a track.
   *
   * The dynamic threshold formula is: min(30 seconds, 20% of track duration)
   * For a 10-second track (our test fixtures), the threshold is 2 seconds.
   *
   * The increment is driven by playback position ticks, not by the pause, so
   * the test polls the rendered cell until it lands rather than sleeping past
   * an estimated threshold.
   */
  test('should increment play count after listening to more than 20% of track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get the first visible track
    const trackRow = page.locator('[data-track-id]').first();
    await expect(trackRow).toBeVisible();

    const columnIndex = await playsColumnIndex(page);
    expect(columnIndex).toBeGreaterThan(-1);

    const playCountCell = trackRow.locator('td').nth(columnIndex);
    const initialPlayCount = await readPlayCount(playCountCell);

    // Double-click the track to start playing
    await TestHelpers.startPlayback(page, trackRow);

    // The threshold for a 10s fixture track is 2s of listening. Poll the cell
    // until the increment lands instead of sleeping for a padded 4 seconds.
    await expect
      .poll(() => readPlayCount(playCountCell), { timeout: 30000 })
      .toBe(initialPlayCount + 1);

    // Click the play/pause button to pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    await TestHelpers.closeApp(app);
  });

  /**
   * Test that the play count does NOT increment if we pause before the threshold.
   *
   * The threshold is 2 seconds for a 10-second fixture track, and the counting
   * happens on playback position ticks — so once playback is paused below the
   * threshold, no further increment can be queued.
   */
  test('should NOT increment play count if paused before 20% threshold', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get the first visible track
    const trackRow = page.locator('[data-track-id]').first();
    await expect(trackRow).toBeVisible();

    const trackId = await trackRow.getAttribute('data-track-id');
    expect(trackId).toBeTruthy();

    const columnIndex = await playsColumnIndex(page);
    expect(columnIndex).toBeGreaterThan(-1);

    const playCountCell = trackRow.locator('td').nth(columnIndex);
    const initialPlayCount = await readPlayCount(playCountCell);

    // Double-click the track to start playing
    await trackRow.dblclick();

    // Verify play icon changed to pause icon (song is playing)
    await TestHelpers.waitForPlaying(page);

    // IMMEDIATELY pause — the threshold is 2 seconds, so everything from the
    // dblclick to here must stay well inside that window. Retrying assertions
    // (rather than sleeps) are what keep this path fast enough to be valid.
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    // Sanity-check that we really did pause before the threshold.
    const elapsed = await page
      .locator('[data-testid="player-elapsed-time"]')
      .textContent();
    expect(elapsed?.trim()).toMatch(/^0:0[01]$/);

    // Read the persisted count straight from the database. The IPC round-trip
    // is ordered behind any write the tracker could already have issued, so a
    // matching value here means no increment happened — no settle sleep needed.
    const persistedPlayCount = await page.evaluate(async (id) => {
      const tracks = await (window as any).electron.tracks.getAll();
      return tracks.find((t: { id: string }) => t.id === id)?.playCount ?? 0;
    }, trackId);
    expect(persistedPlayCount).toBe(initialPlayCount);

    // And the rendered cell agrees.
    expect(await readPlayCount(playCountCell)).toBe(initialPlayCount);

    await TestHelpers.closeApp(app);
  });
});
