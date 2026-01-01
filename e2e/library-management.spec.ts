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

    // Verify we have the expected number of test songs (7 songs)
    const songElements = await page
      .locator('tr, .song-row, .track-row, tbody tr')
      .count();
    expect(songElements).toBeGreaterThanOrEqual(7);

    // Verify specific test songs are present
    const pageContent = await page.content();
    expect(pageContent).toContain('Undying');
    expect(pageContent).toContain('A. G. Cook');
    expect(pageContent).toContain('King Kunta');
    expect(pageContent).toContain('Kendrick Lamar');
    expect(pageContent).toContain('Bill Evans');
    expect(pageContent).toContain('Bladee');

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

      // Get all title cells in parallel
      const titles = await Promise.all(
        rows.map(async (row) => {
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

      // Get all artist cells in parallel
      const artists = await Promise.all(
        rows.map(async (row) => {
          const artistCell = row.locator('td').nth(1);
          const artist = await artistCell.textContent();
          return artist ? artist.trim() : '';
        }),
      );

      return artists;
    };

    // Check initial sort order (should be by artist ascending based on Library.tsx)
    let titles = await getSongTitles();
    let artists = await getSongArtists();

    // Verify initial sort is by Artist ascending
    expect(artists[0]).toBe('A. G. Cook');
    expect(artists[1]).toBe('A. G. Cook');
    expect(artists[2]).toBe('Bill Evans');
    expect(artists[6]).toBe('Kendrick Lamar');

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
    titles = await getSongTitles();
    // Expected order by title ascending:
    // Alice In Wonderland, All Of You, King Kunta, Undying, Waltz For Debby, White Meadow, Windows
    expect(titles[0]).toBe('Alice In Wonderland (Live)');
    expect(titles[1]).toBe('All Of You (Live)');
    expect(titles[2]).toBe('King Kunta');
    expect(titles[3]).toBe('Undying');
    expect(titles[4]).toBe('Waltz For Debby (Live)');
    expect(titles[5]).toBe('White Meadow');
    expect(titles[6]).toBe('Windows');

    // Test sorting by Title column - descending
    // Open the Title column menu again
    await titleHeaderButton.click();
    await page.waitForTimeout(500);

    // Click "Sort by Title descending" menu item
    await page.locator('text=Sort by Title descending').click();
    await page.waitForTimeout(1000);

    titles = await getSongTitles();
    // Expected order by title descending (reverse of ascending)
    expect(titles[0]).toBe('Windows');
    expect(titles[1]).toBe('White Meadow');
    expect(titles[2]).toBe('Waltz For Debby (Live)');
    expect(titles[3]).toBe('Undying');
    expect(titles[4]).toBe('King Kunta');
    expect(titles[5]).toBe('All Of You (Live)');
    expect(titles[6]).toBe('Alice In Wonderland (Live)');

    // Test sorting by Artist column - descending
    // (It's currently ascending from the initial state, so let's test descending)
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
    // Expected order by artist descending (reverse of ascending)
    expect(artists[0]).toBe('Kendrick Lamar');
    expect(artists[1]).toBe('Bladee');
    expect(artists[2]).toBe('Bill Evans');
    expect(artists[3]).toBe('Bill Evans');
    expect(artists[4]).toBe('Bill Evans');
    expect(artists[5]).toBe('A. G. Cook');
    expect(artists[6]).toBe('A. G. Cook');

    await TestHelpers.takeScreenshot(page, 'library-sorted-by-artist-desc');

    await TestHelpers.closeApp(app);
  });

  test('should not duplicate files when rescanning library', async () => {
    const { app, page } = await TestHelpers.launchApp();
    const fs = require('fs');
    const path = require('path');

    // Get the test songs directory path
    const testSongsDir = path.join(__dirname, 'fixtures', 'test-songs');

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
    console.log('Initial files:', initialFiles);

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
      await page.waitForSelector('text=Scan Complete', { timeout: 30000 });
    } catch {
      // Alternative: wait for the progress indicator to disappear
      try {
        await page.waitForSelector('[role="progressbar"]', { state: 'hidden', timeout: 30000 });
      } catch {
        // Fallback: just wait a reasonable amount of time
        await page.waitForTimeout(10000);
      }
    }

    // Count files after rescan
    const finalFileCount = getFileCount(testSongsDir);
    const finalFiles = getFileList(testSongsDir);

    console.log(`Final file count: ${finalFileCount}`);
    console.log('Final files:', finalFiles);

    // Verify no files were duplicated
    expect(finalFileCount).toBe(initialFileCount);
    expect(finalFiles).toEqual(initialFiles);

    // Also verify the song count in the UI hasn't changed
    // Navigate back to library
    const libraryButton = page.locator('[data-testid="nav-library"]');
    await libraryButton.click();
    await page.waitForTimeout(1000);

    // Count songs in the UI
    const songCount = await page.locator('[data-track-id]').count();
    expect(songCount).toBe(7); // We have 7 test songs

    await TestHelpers.takeScreenshot(page, 'library-after-rescan');

    await TestHelpers.closeApp(app);
  });
});
