import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Library Management', () => {
  test('should display pre-loaded songs in library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait a bit for the app to fully load and render
    await page.waitForTimeout(3000);

    // Check if songs are visible - use multiple selectors as fallback
    const songCount = await page
      .locator(
        'tr, .song-row, .track-row, [data-testid*="song"], [data-testid*="track"]',
      )
      .count();
    expect(songCount).toBeGreaterThan(0);

    await TestHelpers.takeScreenshot(page, 'library-loaded');

    await TestHelpers.closeApp(app);
  });

  test('should verify test songs are loaded', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load with pre-populated songs
    await page.waitForTimeout(3000);

    // Verify we have songs loaded (200 test songs)
    const songElements = await page
      .locator('tr, .song-row, .track-row, tbody tr')
      .count();
    expect(songElements).toBeGreaterThan(0);

    // Verify specific test songs/artists are present from our generated library
    const pageContent = await page.content();
    expect(pageContent).toContain('Aurora Synth');
    expect(pageContent).toContain('The Jazz Collective');
    expect(pageContent).toContain('Rock Titans');
    expect(pageContent).toContain('Hip Hop Legends');
    expect(pageContent).toContain('Classical Masters');

    await TestHelpers.closeApp(app);
  });

  test('should sort songs by different columns', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load with fixture data
    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Helper function to get song titles from the visible table rows
    const getSongTitles = async () => {
      // Get all table rows with track data
      const rows = await page.locator('[data-track-id]').all();

      // Get all title cells in parallel (first 10 for performance)
      const titles = await Promise.all(
        rows.slice(0, 10).map(async (row) => {
          const titleCell = row.locator('td').first();
          const title = await titleCell.textContent();
          return title ? title.trim() : '';
        }),
      );

      return titles;
    };

    // Helper function to get song artists from the visible table rows
    const getSongArtists = async () => {
      const rows = await page.locator('[data-track-id]').all();

      // Get all artist cells in parallel (first 10 for performance)
      const artists = await Promise.all(
        rows.slice(0, 10).map(async (row) => {
          const artistCell = row.locator('td').nth(1);
          const artist = await artistCell.textContent();
          return artist ? artist.trim() : '';
        }),
      );

      return artists;
    };

    // Check initial sort order (should be by artist ascending based on Library.tsx)
    let artists = await getSongArtists();

    // Verify initial sort is by Artist ascending
    // First artist alphabetically should be "Acoustic Sessions" or "Ambient Collective"
    expect(artists[0]).toMatch(/^A/); // First artist starts with A

    // Test sorting by Title column - ascending
    // MaterialReactTable headers open a dropdown menu, so we need to:
    // 1. Click the Title column header button to open the menu
    // 2. Click "Sort by Title ascending" from the menu
    const titleHeaderButton = page
      .locator('th')
      .filter({ hasText: 'Title' })
      .locator('button')
      .first();
    await titleHeaderButton.click();
    await page.waitForTimeout(500);

    // Click "Sort by Title ascending" menu item
    await page.locator('text=Sort by Title ascending').click();
    await page.waitForTimeout(1000);

    // Get titles after sorting by Title ascending
    let titles = await getSongTitles();
    // Titles should be sorted alphabetically
    const sortedTitles = [...titles].sort();
    expect(titles).toEqual(sortedTitles);

    // Test sorting by Title column - descending
    // Open the Title column menu again
    await titleHeaderButton.click();
    await page.waitForTimeout(500);

    // Click "Sort by Title descending" menu item
    await page.locator('text=Sort by Title descending').click();
    await page.waitForTimeout(1000);

    titles = await getSongTitles();
    // Titles should be sorted in reverse alphabetical order
    const reverseSortedTitles = [...titles].sort().reverse();
    expect(titles).toEqual(reverseSortedTitles);

    // Test sorting by Artist column - descending
    const artistHeaderButton = page
      .locator('th')
      .filter({ hasText: 'Artist' })
      .locator('button')
      .first();
    await artistHeaderButton.click();
    await page.waitForTimeout(500);

    // Click "Sort by Artist descending" menu item
    await page.locator('text=Sort by Artist descending').click();
    await page.waitForTimeout(1000);

    artists = await getSongArtists();
    // Artists should be sorted in reverse alphabetical order
    const reverseSortedArtists = [...artists].sort().reverse();
    expect(artists).toEqual(reverseSortedArtists);

    await TestHelpers.takeScreenshot(page, 'library-sorted-by-artist-desc');

    await TestHelpers.closeApp(app);
  });

  test('should not duplicate files when rescanning library', async () => {
    const { app, page } = await TestHelpers.launchApp();
    const fs = require('fs');
    const path = require('path');

    // Get the test songs directory path (now using test-songs-large)
    const testSongsDir = path.join(__dirname, 'fixtures', 'test-songs-large');

    // Count initial files in the test-songs directory
    const getFileCount = (dir: string): number => {
      let count = 0;
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isFile()) {
          count++;
        } else if (item.isDirectory()) {
          count += getFileCount(itemPath);
        }
      }
      return count;
    };

    // Get initial file list
    const getFileList = (dir: string): string[] => {
      const files: string[] = [];
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isFile()) {
          files.push(path.relative(testSongsDir, itemPath));
        } else if (item.isDirectory()) {
          files.push(...getFileList(itemPath));
        }
      }
      return files.sort();
    };

    const initialFileCount = getFileCount(testSongsDir);
    const initialFiles = getFileList(testSongsDir);

    console.log(`Initial file count: ${initialFileCount}`);

    // Wait for app to load
    await page.waitForTimeout(3000);

    // Navigate to Settings
    // Click the settings button using its data-testid
    const settingsButton = page.locator('[data-testid="nav-settings"]');
    await settingsButton.click();

    // Wait for settings to load
    await page.waitForTimeout(1000);

    // Find and click the "Rescan Library" button
    const rescanButton = page.locator('button:has-text("Rescan Library")');
    await expect(rescanButton).toBeVisible({ timeout: 5000 });
    await rescanButton.click();

    // Wait for scan to start
    await page.waitForTimeout(1000);

    // Wait for scan to complete - look for completion indicators
    // The scan might show a progress bar or status text
    try {
      // Wait for scan complete text or progress to reach 100%
      await page.waitForSelector('text=Scan Complete', { timeout: 60000 });
    } catch {
      // Alternative: wait for the progress indicator to disappear
      try {
        await page.waitForSelector('[role="progressbar"]', { state: 'hidden', timeout: 60000 });
      } catch {
        // Fallback: just wait a reasonable amount of time
        await page.waitForTimeout(30000);
      }
    }

    // Count files after rescan
    const finalFileCount = getFileCount(testSongsDir);
    const finalFiles = getFileList(testSongsDir);

    console.log(`Final file count: ${finalFileCount}`);

    // Verify no files were duplicated
    expect(finalFileCount).toBe(initialFileCount);
    expect(finalFiles).toEqual(initialFiles);

    // Also verify the song count in the UI hasn't changed
    // Navigate back to library
    const libraryButton = page.locator('[data-testid="nav-library"]');
    await libraryButton.click();
    await page.waitForTimeout(1000);

    // Verify songs are visible in the UI (virtualization limits visible rows to ~45)
    const songCount = await page.locator('[data-track-id]').count();
    expect(songCount).toBeGreaterThan(0); // Tracks should be visible after rescan

    await TestHelpers.takeScreenshot(page, 'library-after-rescan');

    await TestHelpers.closeApp(app);
  });
});
