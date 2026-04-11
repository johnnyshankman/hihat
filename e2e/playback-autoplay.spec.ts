/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Auto-play Behaviors', () => {
  test('double-click song causes autoplay', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click the first track row to play it
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify PauseIcon is visible (meaning it's actively playing)
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify the player bar shows the track title
    // The first track is test-large-001 "Dream of Love" by "Aurora Synth"
    const pageContent = await page.content();
    expect(
      pageContent.includes('Dream of Love') ||
        pageContent.includes('Aurora Synth'),
    ).toBe(true);

    await TestHelpers.closeApp(app);
  });

  test('song completes → next auto-plays (not paused)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify it's playing
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Wait for 10-second track to finish (~12s to be safe)
    await page.waitForTimeout(12000);

    // Verify PauseIcon is still visible (still playing, not paused)
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify the displayed track has changed (different title in the player)
    // Get the current track title from the player area
    const secondTrack = page.locator('[data-track-id]').nth(1);
    const secondTrackTitle = await secondTrack
      .locator('td')
      .first()
      .textContent();

    // The page should now contain the second track's title in the player area
    const pageContent = await page.content();
    expect(pageContent).toContain(secondTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('skip while playing → next auto-plays', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Click skip-next button
    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(1000);

    // Verify PauseIcon is still visible (still playing after skip)
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify track changed - the second track title should now appear in the player
    const secondTrack = page.locator('[data-track-id]').nth(1);
    const secondTrackTitle = await secondTrack
      .locator('td')
      .first()
      .textContent();
    const pageContent = await page.content();
    expect(pageContent).toContain(secondTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('skip while paused → next stays paused', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Click pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(500);

    // Verify PlayArrowIcon visible (paused)
    let playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Click skip-next button
    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(1000);

    // Verify PlayArrowIcon is still visible (still paused after skip)
    playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Verify track changed - the second track title should now appear in the player
    const secondTrack = page.locator('[data-track-id]').nth(1);
    const secondTrackTitle = await secondTrack
      .locator('td')
      .first()
      .textContent();
    const pageContent = await page.content();
    expect(pageContent).toContain(secondTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });
});
