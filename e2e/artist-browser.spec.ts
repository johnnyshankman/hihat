/* eslint-disable no-console, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Browser Panel Filtering', () => {
  test('browser toggle shows and hides the panel', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Browser panel should NOT be visible by default
    await expect(
      page.locator('[data-testid="browser-panel"]'),
    ).not.toBeVisible();

    // Click browser toggle button in Player bar
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Browser panel should now be visible with two columns
    await expect(page.locator('[data-testid="browser-panel"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="browser-artist-column"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="browser-album-column"]'),
    ).toBeVisible();

    // Click toggle again to hide
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    await expect(
      page.locator('[data-testid="browser-panel"]'),
    ).not.toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('selecting an album artist filters albums and tracks', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click "Aurora Synth" in left column
    const auroraItem = page.locator('[data-artist="Aurora Synth"]');
    await expect(auroraItem).toBeVisible({ timeout: 5000 });
    await auroraItem.click();
    await page.waitForTimeout(1000);

    // Track table should show only Aurora Synth tracks (10 tracks)
    const trackRows = page.locator('[data-track-id]');
    const filteredCount = await trackRows.count();
    expect(filteredCount).toBe(10);

    // Verify each visible row contains "Aurora Synth" in the artist column
    for (let i = 0; i < filteredCount; i += 1) {
      const row = trackRows.nth(i);
      const artistCell = row.locator('td').nth(1);
      const artistText = await artistCell.textContent();
      expect(artistText?.trim()).toBe('Aurora Synth');
    }

    await TestHelpers.closeApp(app);
  });

  test('closing browser clears all filters', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Get initial track count
    const initialCount = await page.locator('[data-track-id]').count();
    expect(initialCount).toBeGreaterThan(0);

    // Open browser, select an artist
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    const auroraItem = page.locator('[data-artist="Aurora Synth"]');
    await expect(auroraItem).toBeVisible({ timeout: 5000 });
    await auroraItem.click();
    await page.waitForTimeout(1000);

    // Should be filtered (fewer tracks)
    const filteredCount = await page.locator('[data-track-id]').count();
    expect(filteredCount).toBeLessThan(initialCount);

    // Close browser
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(1000);

    // Track table should show all tracks again
    const clearedCount = await page.locator('[data-track-id]').count();
    expect(clearedCount).toBeGreaterThanOrEqual(initialCount);

    await TestHelpers.closeApp(app);
  });

  test('artist filter context preserved through skip', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Select "Aurora Synth" to filter
    const auroraItem = page.locator('[data-artist="Aurora Synth"]');
    await expect(auroraItem).toBeVisible({ timeout: 5000 });
    await auroraItem.click();
    await page.waitForTimeout(1000);

    // Double-click first visible track to start playback
    const firstFilteredTrack = page.locator('[data-track-id]').first();
    await firstFilteredTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify it's playing
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Now change the artist browser to a different artist
    const jazzItem = page.locator('[data-artist="The Jazz Collective"]');
    await expect(jazzItem).toBeVisible({ timeout: 5000 });
    await jazzItem.click();
    await page.waitForTimeout(1000);

    // Click skip-next
    await page.locator('[data-testid="skip-next-button"]').click();
    await page.waitForTimeout(1000);

    // Verify the now-playing track is from Aurora Synth
    const playerArtistText = await page.evaluate(() => {
      const body2Elements = Array.from(
        document.querySelectorAll('.MuiTypography-body2'),
      );
      const match = body2Elements.find(
        (el) => el.textContent && el.textContent.includes('\u2022'),
      );
      return match?.textContent || '';
    });

    expect(playerArtistText).toContain('Aurora Synth');

    await TestHelpers.closeApp(app);
  });
});
