/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Queue View', () => {
  test('empty state when nothing has been played', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Sidebar entry exists; clicking it lands on the empty queue view.
    await page.click('[data-testid="nav-queue"]');
    await page.waitForTimeout(500);

    await expect(page.getByText('Nothing playing')).toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('non-shuffle: queue view lists upcoming tracks in source order', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Capture the first 5 visible track IDs from the library before starting
    // playback. The queue view should reflect that exact order — they're the
    // current track + upcoming.
    const expectedOrder = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      return rows.slice(0, 5).map((r) => r.getAttribute('data-track-id'));
    });

    // Double-click first track to start playback.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    // Navigate to queue view.
    await page.click('[data-testid="nav-queue"]');
    await page.waitForTimeout(500);

    // Read the first 5 queue rows.
    const queueOrder = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      return rows.slice(0, 5).map((r) => r.getAttribute('data-track-id'));
    });

    expect(queueOrder).toEqual(expectedOrder);

    await TestHelpers.closeApp(app);
  });

  test('shuffle: queue view reshuffles future when toggled mid-playback', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Source order for comparison.
    const sequentialOrder = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      return rows.slice(0, 10).map((r) => r.getAttribute('data-track-id'));
    });

    // Start playback first — the shuffle button is disabled until a track
    // is loaded. After playback starts, toggling shuffle runs through the
    // store's reshuffleFuture path.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    const shuffleButton = page.locator('[data-testid="shuffle-button"]');
    await shuffleButton.click();
    await expect(shuffleButton).toHaveAttribute('data-shuffle-mode', 'on');
    await page.waitForTimeout(300);

    await page.click('[data-testid="nav-queue"]');
    await page.waitForTimeout(500);

    // Read the first 10 queue rows.
    const queueOrder = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      return rows.slice(0, 10).map((r) => r.getAttribute('data-track-id'));
    });

    // Index 0 is past+current (the track we double-clicked) and stays put
    // — past is immutable. Index 1+ is the freshly-shuffled future and
    // should not match sequential order. Odds of a shuffle reproducing
    // sequential order over 9 positions are negligible.
    expect(queueOrder.length).toBeGreaterThan(0);
    expect(queueOrder[0]).toBe(sequentialOrder[0]);
    expect(queueOrder.slice(1)).not.toEqual(sequentialOrder.slice(1));

    await TestHelpers.closeApp(app);
  });

  test('double-click an upcoming row jumps to it', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    await page.click('[data-testid="nav-queue"]');
    await page.waitForTimeout(500);

    // Pick the third track in the queue (index 2). Capture its ID, then
    // double-click it.
    const targetId = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      return rows[2]?.getAttribute('data-track-id');
    });
    expect(targetId).toBeTruthy();

    await page.locator(`[data-track-id="${targetId}"]`).dblclick();
    await page.waitForTimeout(1000);

    // The target row should now have the playing class.
    const isPlaying = await page.evaluate((id) => {
      const row = document.querySelector(`[data-track-id="${id}"]`);
      return (
        !!row &&
        (row.classList.contains('vt-row-playing') ||
          row.classList.contains('vt-row-playing-selected'))
      );
    }, targetId);
    expect(isPlaying).toBe(true);

    await TestHelpers.closeApp(app);
  });

  test('remove from queue: upcoming track disappears', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    await page.click('[data-testid="nav-queue"]');
    await page.waitForTimeout(500);

    const beforeCount = await page.locator('[data-track-id]').count();
    expect(beforeCount).toBeGreaterThan(2);

    // Right-click the second-to-last row in the visible queue. Avoid
    // clicking the current (index 0) — Remove is disabled there.
    const targetId = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      return rows[3]?.getAttribute('data-track-id');
    });
    expect(targetId).toBeTruthy();

    await page
      .locator(`[data-track-id="${targetId}"]`)
      .click({ button: 'right' });
    await page.click('[data-testid="queue-remove-track"]');
    await page.waitForTimeout(500);

    // Same row should be gone.
    const stillPresent = await page
      .locator(`[data-track-id="${targetId}"]`)
      .count();
    expect(stillPresent).toBe(0);

    await TestHelpers.closeApp(app);
  });

  test('past tracks appear above current after skipping forward', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Start playback, then skip-next twice so we have 2 past + current + future.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(800);
    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(800);

    await page.click('[data-testid="nav-queue"]');
    await page.waitForTimeout(500);

    // Find the index of the .vt-row-playing row in the rendered queue.
    // Tracks with index < that should carry the queue-past dim class.
    const layout = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[data-track-id]'));
      const playingIdx = rows.findIndex(
        (r) =>
          r.classList.contains('vt-row-playing') ||
          r.classList.contains('vt-row-playing-selected'),
      );
      const pastDimmed = rows
        .slice(0, playingIdx)
        .every((r) => r.classList.contains('vt-row-queue-past'));
      const futureNotDimmed = rows
        .slice(playingIdx + 1, playingIdx + 4)
        .every((r) => !r.classList.contains('vt-row-queue-past'));
      return { playingIdx, pastDimmed, futureNotDimmed };
    });

    // Two skips should put the playing row at index 2 — i.e. two past entries.
    expect(layout.playingIdx).toBe(2);
    expect(layout.pastDimmed).toBe(true);
    expect(layout.futureNotDimmed).toBe(true);

    await TestHelpers.closeApp(app);
  });
});
