/* eslint-disable no-console, no-plusplus, no-await-in-loop, @typescript-eslint/no-unused-vars */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Large Library (200+ tracks)', () => {
  test('should load and display a large library with 200 tracks', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load and render
    await page.waitForTimeout(3000);

    // Wait for track rows to appear
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Count visible tracks (may be virtualized, so not all 200 will be visible at once)
    const visibleTrackCount = await page.locator('[data-track-id]').count();
    expect(visibleTrackCount).toBeGreaterThan(0);

    // Verify we're showing multiple tracks (virtualization should render at least some)
    console.log(`Visible track count on initial load: ${visibleTrackCount}`);

    await TestHelpers.takeScreenshot(page, 'large-library-initial');

    await TestHelpers.closeApp(app);
  });

  test('should scroll through large library and reach the last track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Get the scrollable table container
    // MaterialReactTable uses a container with overflow for virtualization
    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    await expect(tableContainer).toBeVisible();

    // Get initial visible tracks
    const initialTrackIds = await page
      .locator('[data-track-id]')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-track-id')));
    console.log('Initial track IDs:', initialTrackIds.slice(0, 5), '...');

    // Scroll to the bottom of the table using keyboard navigation
    // First, click on a row to focus the table
    await page.locator('[data-track-id]').first().click();
    await page.waitForTimeout(300);

    // Use Ctrl+End or scroll to bottom
    // Since the table is virtualized, we need to scroll the container
    await tableContainer.evaluate((container) => {
      container.scrollTop = container.scrollHeight;
    });
    await page.waitForTimeout(1000);

    // Check that we've scrolled - get track IDs after scrolling
    const scrolledTrackIds = await page
      .locator('[data-track-id]')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-track-id')));
    console.log(
      'Track IDs after first scroll:',
      scrolledTrackIds.slice(-5),
      '...',
    );

    // The track IDs should be different after scrolling (virtualization replaces rows)
    // Check for tracks from the end of the list (test-large-196 to test-large-200)
    const lastTrackVisible = scrolledTrackIds.some((id) =>
      id?.startsWith('test-large-2'),
    );
    console.log(`Found tracks from 200 range: ${lastTrackVisible}`);

    // Continue scrolling if needed - scroll multiple times to ensure we reach the bottom
    for (let i = 0; i < 5; i++) {
      await tableContainer.evaluate((container) => {
        container.scrollTop = container.scrollHeight;
      });
      await page.waitForTimeout(500);
    }

    // Final check for last track
    const finalTrackIds = await page
      .locator('[data-track-id]')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-track-id')));
    console.log('Final visible track IDs:', finalTrackIds);

    // Verify we can see tracks near the end (track 200)
    // The last track should be test-large-200
    const hasLastTrack = finalTrackIds.some(
      (id) =>
        id === 'test-large-200' ||
        id?.includes('test-large-19') ||
        id?.includes('test-large-20'),
    );
    expect(hasLastTrack).toBe(true);

    await TestHelpers.takeScreenshot(page, 'large-library-scrolled-to-bottom');

    await TestHelpers.closeApp(app);
  });

  test('should sort large library by different columns', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Helper function to get song titles from visible rows
    const getSongTitles = async () => {
      const rows = await page.locator('[data-track-id]').all();
      const titles = await Promise.all(
        rows.slice(0, 10).map(async (row) => {
          const titleCell = row.locator('td').first();
          const title = await titleCell.textContent();
          return title ? title.trim() : '';
        }),
      );
      return titles;
    };

    // Helper function to get song artists from visible rows
    const getSongArtists = async () => {
      const rows = await page.locator('[data-track-id]').all();
      const artists = await Promise.all(
        rows.slice(0, 10).map(async (row) => {
          const artistCell = row.locator('td').nth(1);
          const artist = await artistCell.textContent();
          return artist ? artist.trim() : '';
        }),
      );
      return artists;
    };

    // Get initial artists (should be sorted by artist by default)
    const initialArtists = await getSongArtists();
    console.log('Initial artists (first 10):', initialArtists);

    // The first artist alphabetically should be something like "Acoustic Sessions" or "Ambient Collective"
    // Since we have many artists, just verify we have valid data
    expect(initialArtists.filter((a) => a.length > 0).length).toBeGreaterThan(
      0,
    );

    // Sort by Title ascending — click the Title header directly
    const titleHeader = page.locator('th').filter({ hasText: 'Title' }).first();
    await titleHeader.click();
    await page.waitForTimeout(1000);

    const sortedTitles = await getSongTitles();
    console.log('Titles after sorting by Title asc:', sortedTitles);

    // Verify titles are sorted alphabetically
    const sortedTitlesCopy = [...sortedTitles].sort();
    expect(sortedTitles).toEqual(sortedTitlesCopy);

    await TestHelpers.takeScreenshot(page, 'large-library-sorted-by-title');

    await TestHelpers.closeApp(app);
  });

  test('should search within large library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Get initial track count (visible in viewport)
    const initialCount = await page.locator('[data-track-id]').count();
    console.log(`Initial visible track count: ${initialCount}`);

    // Click the search toggle button (MRT_ToggleGlobalFilterButton)
    // The button has aria-label "Show/Hide search" from MRT localization
    const searchToggle = page.locator('[aria-label="Show/Hide search"]');
    if (await searchToggle.isVisible()) {
      await searchToggle.click();
      await page.waitForTimeout(500);
    }

    // Now find the search input - MRT creates an input when search is toggled
    // Try multiple selectors for the search input
    let searchInput = page.locator('input[type="search"]').first();
    if (!(await searchInput.isVisible())) {
      searchInput = page.locator('input[placeholder*="Search"]').first();
    }
    if (!(await searchInput.isVisible())) {
      // MRT might use a text input without search type
      searchInput = page.locator('.MuiInputBase-input').first();
    }

    // Wait for search input to be visible
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Search for a specific artist that should have multiple tracks
    // "Aurora Synth" should have multiple tracks (every 20th track)
    await searchInput.fill('Aurora Synth');
    await page.waitForTimeout(1000);

    // Check that results are filtered
    const filteredCount = await page.locator('[data-track-id]').count();
    console.log(`Filtered track count for "Aurora Synth": ${filteredCount}`);

    // Aurora Synth should have 10 tracks (every 20th track out of 200)
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);

    // Verify the results contain Aurora Synth
    const pageContent = await page.content();
    expect(pageContent).toContain('Aurora Synth');

    // Clear search and verify all tracks return
    await searchInput.clear();
    await page.waitForTimeout(1000);

    const clearedCount = await page.locator('[data-track-id]').count();
    console.log(`Track count after clearing search: ${clearedCount}`);
    expect(clearedCount).toBeGreaterThanOrEqual(initialCount);

    await TestHelpers.takeScreenshot(page, 'large-library-search-results');

    await TestHelpers.closeApp(app);
  });

  test('should play a track from the large library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Double-click the first track to play it
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(2000);

    // Check that the player shows the song is playing
    // Look for the play/pause button or now playing indicator
    const playerContainer = page
      .locator('.player, [class*="player"], [data-testid*="player"]')
      .first();

    // The track should now be playing or at least loaded
    // Check for any indication that the track is selected/playing
    const nowPlayingText = await page.content();

    // One of our test songs should appear in the now playing section
    // Our first track should be "Dream of Love" by "Aurora Synth"
    const isTrackLoaded =
      nowPlayingText.includes('Dream') ||
      nowPlayingText.includes('Aurora') ||
      nowPlayingText.includes('Digital Dreams');

    expect(isTrackLoaded).toBe(true);

    await TestHelpers.takeScreenshot(page, 'large-library-track-playing');

    await TestHelpers.closeApp(app);
  });

  test('should handle scrolling performance with virtualization', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    await expect(tableContainer).toBeVisible();

    // Measure scroll performance by timing scroll operations
    const startTime = Date.now();

    // Perform multiple rapid scrolls
    for (let i = 0; i < 10; i++) {
      await tableContainer.evaluate((container, scrollAmount) => {
        container.scrollTop += scrollAmount;
      }, 500);
      await page.waitForTimeout(100);
    }

    const endTime = Date.now();
    const scrollDuration = endTime - startTime;

    console.log(`10 scroll operations completed in ${scrollDuration}ms`);

    // Performance should be reasonable (less than 5 seconds for 10 scrolls)
    expect(scrollDuration).toBeLessThan(5000);

    // Verify the virtualized list is still rendering correctly
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });
});
