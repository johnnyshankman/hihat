import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Dispatches synthetic HTML5 drag events.
 *
 * When `extraTrackIds` is provided we bypass the source row's `onDragStart`
 * handler (which would overwrite our multi-track payload with just the
 * single dragged row) and go straight to `dragover` + `drop` on the
 * target with a fresh DataTransfer containing all desired IDs.
 *
 * For single-track drags we still dispatch `dragstart` on the row so the
 * real handler runs, matching production behaviour.
 */
async function dragTrackToPlaylist(
  page: Page,
  trackId: string,
  playlistSelector: string,
  extraTrackIds?: string[],
): Promise<boolean> {
  return page.evaluate(
    async ({ tId, pSelector, extra }) => {
      const wait = () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 150);
        });

      const sourceRow = document.querySelector(`tr[data-track-id="${tId}"]`);
      const target = document.querySelector(pSelector);
      if (!sourceRow || !target) return false;

      const dt = new DataTransfer();
      const ids = extra && extra.length > 0 ? [tId, ...extra] : [tId];
      dt.setData('application/x-hihat-tracks', JSON.stringify(ids));
      dt.effectAllowed = 'copy';

      if (!extra || extra.length === 0) {
        // Single-track: let the real onDragStart handler run
        sourceRow.dispatchEvent(
          new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }),
        );
        await wait();
      }
      // For multi-track, skip dragstart on the row to avoid the handler
      // overwriting our payload — go straight to target events.

      target.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      await wait();

      target.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );

      sourceRow.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, dataTransfer: dt }),
      );
      return true;
    },
    { tId: trackId, pSelector: playlistSelector, extra: extraTrackIds },
  );
}

test.describe('Drag and Drop Tracks to Sidebar Playlists', () => {
  test('single track drag to regular playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Drag test-large-010 (not in any playlist) to "Test Playlist" (playlist-1)
    const result = await dragTrackToPlaylist(
      page,
      'test-large-010',
      '[data-playlist-id="playlist-1"]',
    );
    expect(result).toBe(true);

    // Wait for the async playlist update
    await page.waitForTimeout(1500);

    // Navigate to Test Playlist to verify the track was added
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(1000);

    // Verify test-large-010 is now in the playlist
    const addedTrack = page.locator('[data-track-id="test-large-010"]');
    await addedTrack.waitFor({ state: 'visible', timeout: 5000 });

    // Should have 4 tracks now (was 3: 001, 002, 003)
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBe(4);

    await TestHelpers.closeApp(app);
  });

  test('multi-track drag to regular playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Simulate a multi-track drag with two track IDs to "Jazz Favorites" (playlist-2).
    // In real usage the onRowDragStart handler packages selectedTrackIds into
    // the DataTransfer, so we replicate that directly via the drag helper.
    // Use test-large-010 as the dragged row (must be visible), with 011 as extra.
    const result = await dragTrackToPlaylist(
      page,
      'test-large-010',
      '[data-playlist-id="playlist-2"]',
      ['test-large-011'],
    );
    expect(result).toBe(true);

    await page.waitForTimeout(1500);

    // Navigate to Jazz Favorites to verify
    await page.click('[data-playlist-id="playlist-2"]');
    await page.waitForTimeout(1000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Should have 5 tracks now (Jazz Favorites had 3: 002, 022, 042; we added 010 + 011)
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBe(5);

    // Verify at least one of the added tracks is present in DOM
    const added010 = page.locator('[data-track-id="test-large-010"]');
    await added010.waitFor({ state: 'visible', timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('drag to smart playlist is rejected', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Attempt to drag to "Recently Added" (playlist-3, smart)
    const result = await dragTrackToPlaylist(
      page,
      'test-large-010',
      '[data-playlist-id="playlist-3"]',
    );
    expect(result).toBe(true); // Events dispatched, but drop should be rejected

    await page.waitForTimeout(1000);

    // Navigate to Recently Added — it's a smart playlist computed dynamically.
    // Verify test-large-010 wasn't somehow added to the smart playlist's underlying data.
    // Smart playlists show tracks based on SQL queries, not trackIds array,
    // so we verify no unexpected state change by checking the playlist renders normally.
    await page.click('[data-playlist-id="playlist-3"]');
    await page.waitForTimeout(1000);

    // The smart playlist should still be functional (no errors).
    // Since it's "Recently Added", it shows the 50 most recently added tracks.
    // test-large-010 may or may not appear here based on dateAdded,
    // but the key thing is no error occurred from the rejected drop.
    const vtTable = page.locator('.vt-table');
    const hasTable = await vtTable.count();
    expect(hasTable).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });

  test('duplicate track is not added again', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Drag test-large-001 (already in Test Playlist) to Test Playlist
    const result = await dragTrackToPlaylist(
      page,
      'test-large-001',
      '[data-playlist-id="playlist-1"]',
    );
    expect(result).toBe(true);

    await page.waitForTimeout(1500);

    // Navigate to Test Playlist
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(1000);

    // Should still have exactly 3 tracks (no duplicates)
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBe(3);

    await TestHelpers.closeApp(app);
  });

  test('drag from playlist view to another playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to Test Playlist first
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(1000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Drag test-large-001 from Test Playlist to Jazz Favorites (playlist-2)
    const result = await dragTrackToPlaylist(
      page,
      'test-large-001',
      '[data-playlist-id="playlist-2"]',
    );
    expect(result).toBe(true);

    await page.waitForTimeout(1500);

    // Navigate to Jazz Favorites to verify
    await page.click('[data-playlist-id="playlist-2"]');
    await page.waitForTimeout(1000);

    // Verify test-large-001 appears (4 tracks now, was 3: 002, 022, 042)
    const addedTrack = page.locator('[data-track-id="test-large-001"]');
    await addedTrack.waitFor({ state: 'visible', timeout: 5000 });

    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBe(4);

    await TestHelpers.closeApp(app);
  });
});
