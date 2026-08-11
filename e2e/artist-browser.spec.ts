/* eslint-disable no-await-in-loop */
import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

const BROWSER_TOGGLE = '[data-testid="browser-toggle"]';
const BROWSER_PANEL = '[data-testid="browser-panel"]';

/** Open the browser panel and wait for it to render. */
async function openBrowser(page: Page) {
  await page.locator(BROWSER_TOGGLE).click();
  await expect(page.locator(BROWSER_PANEL)).toBeVisible();
}

/**
 * Select an artist in the browser's left column and wait for the track table to
 * settle on that artist's rows — the filtered table is the signal, so there's
 * nothing to guess at.
 */
async function selectArtist(page: Page, artist: string, trackCount: number) {
  const item = page.locator(`[data-artist="${artist}"]`);
  await expect(item).toBeVisible();
  await item.click();
  await expect(item).toHaveClass(/browser-item-selected/);
  await TestHelpers.waitForTrackCount(page, trackCount);
}

test.describe('Browser Panel Filtering', () => {
  test('browser toggle shows and hides the panel', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Browser panel should NOT be visible by default
    await expect(page.locator(BROWSER_PANEL)).toBeHidden();

    // Click browser toggle button in Player bar
    await openBrowser(page);

    // Browser panel should now be visible with two columns
    await expect(
      page.locator('[data-testid="browser-artist-column"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="browser-album-column"]'),
    ).toBeVisible();

    // Click toggle again to hide
    await page.locator(BROWSER_TOGGLE).click();
    await expect(page.locator(BROWSER_PANEL)).toBeHidden();

    await TestHelpers.closeApp(app);
  });

  test('selecting an album artist filters albums and tracks', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);

    // Click "Aurora Synth" in left column — the table should show only that
    // artist's 10 tracks
    await selectArtist(page, 'Aurora Synth', 10);

    // Verify each visible row contains "Aurora Synth" in the artist column
    const trackRows = page.locator('[data-track-id]');
    const filteredCount = await trackRows.count();
    for (let i = 0; i < filteredCount; i += 1) {
      const artistCell = trackRows.nth(i).locator('td').nth(1);
      expect((await artistCell.textContent())?.trim()).toBe('Aurora Synth');
    }

    await TestHelpers.closeApp(app);
  });

  test('closing browser clears all filters', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get initial track count
    const initialCount = await page.locator('[data-track-id]').count();
    expect(initialCount).toBeGreaterThan(0);

    // Open browser, select an artist
    await openBrowser(page);
    await selectArtist(page, 'Aurora Synth', 10);
    expect(await page.locator('[data-track-id]').count()).toBeLessThan(
      initialCount,
    );

    // Close browser — track table should show all tracks again
    await page.locator(BROWSER_TOGGLE).click();
    await expect(page.locator(BROWSER_PANEL)).toBeHidden();
    await expect
      .poll(() => page.locator('[data-track-id]').count())
      .toBeGreaterThanOrEqual(initialCount);

    await TestHelpers.closeApp(app);
  });

  test('artist filter context preserved through skip', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);

    // Select "Aurora Synth" to filter
    await selectArtist(page, 'Aurora Synth', 10);

    // Double-click first visible track to start playback
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').first(),
    );
    const playingTitle = await TestHelpers.nowPlayingTitle(page);

    // Now change the artist browser to a different artist (10 tracks)
    await selectArtist(page, 'The Jazz Collective', 10);

    // Click skip-next — playback should follow the queue it started from
    await page.locator('[data-testid="skip-next-button"]').click();
    await TestHelpers.waitForNowPlayingChange(page, playingTitle);

    // Verify the now-playing track is still from Aurora Synth
    await expect
      .poll(() =>
        page.evaluate(() => {
          const body2Elements = Array.from(
            document.querySelectorAll('.MuiTypography-body2'),
          );
          const match = body2Elements.find(
            (el) => el.textContent && el.textContent.includes('•'),
          );
          return match?.textContent || '';
        }),
      )
      .toContain('Aurora Synth');

    await TestHelpers.closeApp(app);
  });
});
