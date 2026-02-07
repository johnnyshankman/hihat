/* eslint-disable no-console, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Artist Browser Filtering', () => {
  test('artist browser filters songs correctly', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Get the initial track count (all tracks)
    const initialCount = await page.locator('[data-track-id]').count();
    expect(initialCount).toBeGreaterThan(0);

    // Open the artist browser by clicking the PeopleIcon toggle button
    await page.locator('button:has(svg[data-testid="PeopleIcon"])').click();
    await page.waitForTimeout(1000);

    // Click on "Aurora Synth" in the artist browser
    const auroraItem = page.locator('[data-artist="Aurora Synth"]');
    await expect(auroraItem).toBeVisible({ timeout: 5000 });
    await auroraItem.click();
    await page.waitForTimeout(1000);

    // Verify all visible track rows show "Aurora Synth" in the artist column
    const trackRows = page.locator('[data-track-id]');
    const filteredCount = await trackRows.count();

    // Aurora Synth should have 10 tracks (tracks 001, 021, 041, ...)
    expect(filteredCount).toBe(10);

    // Verify each visible row contains "Aurora Synth" in the artist column (2nd td)
    for (let i = 0; i < filteredCount; i += 1) {
      const row = trackRows.nth(i);
      const artistCell = row.locator('td').nth(1);
      const artistText = await artistCell.textContent();
      expect(artistText?.trim()).toBe('Aurora Synth');
    }

    // Click "All Artists" to clear the filter
    await page.getByText('All Artists').click();
    await page.waitForTimeout(1000);

    // Verify more tracks are now visible
    const clearedCount = await page.locator('[data-track-id]').count();
    expect(clearedCount).toBeGreaterThan(filteredCount);

    await TestHelpers.closeApp(app);
  });

  test('artist filter context preserved through skip', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open artist browser
    await page.locator('button:has(svg[data-testid="PeopleIcon"])').click();
    await page.waitForTimeout(1000);

    // Select "Aurora Synth" to filter
    const auroraItem = page.locator('[data-artist="Aurora Synth"]');
    await expect(auroraItem).toBeVisible({ timeout: 5000 });
    await auroraItem.click();
    await page.waitForTimeout(1000);

    // Double-click first visible track to start playback
    // This captures playbackContextArtistFilter = "Aurora Synth"
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

    // Click skip-next — the next track should still be from Aurora Synth
    // because playbackContextArtistFilter was locked to "Aurora Synth"
    await page.locator('button:has(svg[data-testid="SkipNextIcon"])').click();
    await page.waitForTimeout(1000);

    // Verify the now-playing track is from Aurora Synth by checking page content
    // The player shows "{artist} • {album}" in body2 typography elements
    const playerArtistText = await page.evaluate(() => {
      // Find all body2 typography elements — the player shows artist • album
      const body2Elements = Array.from(
        document.querySelectorAll('.MuiTypography-body2'),
      );
      // Look for one that contains the bullet separator (artist • album format)
      const match = body2Elements.find(
        (el) => el.textContent && el.textContent.includes('•'),
      );
      return match?.textContent || '';
    });

    expect(playerArtistText).toContain('Aurora Synth');

    await TestHelpers.closeApp(app);
  });
});
