/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Skip Behaviors', () => {
  test('skip next multiple times while playing — stays playing', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click the first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Get the 4th track title for verification
    const fourthTrack = page.locator('[data-track-id]').nth(3);
    const fourthTrackTitle = await fourthTrack
      .locator('td')
      .first()
      .textContent();

    // Skip next 3 times rapidly
    for (let i = 0; i < 3; i++) {
      await page.locator('button:has(svg[data-testid="SkipNextIcon"])').click();
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(500);

    // Verify still playing (PauseIcon visible)
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify we're on the 4th track
    const pageContent = await page.content();
    expect(pageContent).toContain(fourthTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('skip previous while playing — stays playing', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click the third track to start playback
    const thirdTrack = page.locator('[data-track-id]').nth(2);
    const secondTrackTitle = await page
      .locator('[data-track-id]')
      .nth(1)
      .locator('td')
      .first()
      .textContent();
    await thirdTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Skip previous (within 3 seconds so it goes to previous track)
    await page
      .locator('button:has(svg[data-testid="SkipPreviousIcon"])')
      .click();
    await page.waitForTimeout(1000);

    // Verify still playing
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify we're on the second track
    const pageContent = await page.content();
    expect(pageContent).toContain(secondTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('skip next then previous — returns to original track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Get the second track title
    const secondTrack = page.locator('[data-track-id]').nth(1);
    const secondTrackTitle = await secondTrack
      .locator('td')
      .first()
      .textContent();

    // Double-click the second track to start playback
    await secondTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Skip next
    await page.locator('button:has(svg[data-testid="SkipNextIcon"])').click();
    await page.waitForTimeout(1000);

    // Skip previous (within 3 seconds)
    await page
      .locator('button:has(svg[data-testid="SkipPreviousIcon"])')
      .click();
    await page.waitForTimeout(1000);

    // Verify still playing
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify we're back on the second track
    const pageContent = await page.content();
    expect(pageContent).toContain(secondTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('skip next while paused — stays paused on correct track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click the first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(500);

    // Verify paused (PlayArrowIcon visible)
    let playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Skip next
    await page.locator('button:has(svg[data-testid="SkipNextIcon"])').click();
    await page.waitForTimeout(1000);

    // Verify still paused
    playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Verify we're on the second track
    const secondTrack = page.locator('[data-track-id]').nth(1);
    const secondTrackTitle = await secondTrack
      .locator('td')
      .first()
      .textContent();
    const pageContent = await page.content();
    expect(pageContent).toContain(secondTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('skip previous while paused — stays paused on correct track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click the second track to start playback
    const secondTrack = page.locator('[data-track-id]').nth(1);
    await secondTrack.dblclick();
    await page.waitForTimeout(1000);

    // Pause
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(500);

    // Verify paused
    let playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Skip previous (within 3 seconds)
    await page
      .locator('button:has(svg[data-testid="SkipPreviousIcon"])')
      .click();
    await page.waitForTimeout(1000);

    // Verify still paused
    playIcon = page.locator('button svg[data-testid="PlayArrowIcon"]');
    await expect(playIcon).toBeVisible({ timeout: 5000 });

    // Verify we're on the first track
    const firstTrack = page.locator('[data-track-id]').first();
    const firstTrackTitle = await firstTrack
      .locator('td')
      .first()
      .textContent();
    const pageContent = await page.content();
    expect(pageContent).toContain(firstTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });
});
