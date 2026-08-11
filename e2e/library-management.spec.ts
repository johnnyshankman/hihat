/* eslint-disable no-console, no-plusplus, no-restricted-syntax, global-require */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Library Management', () => {
  test('should display pre-loaded songs in library', async () => {
    const { app, page } = await TestHelpers.launchApp();

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

    // Verify we have songs loaded — virtualization renders only visible rows,
    // so check that a reasonable number are in the DOM (overscan covers ~56 rows)
    const songElements = await page.locator('[data-track-id]').count();
    expect(songElements).toBeGreaterThan(20);

    // Collect unique artists by scrolling through the entire virtualized table.
    // This avoids relying on page.content() which only sees the DOM slice.
    const allArtists = await page.evaluate(async () => {
      const artists = new Set<string>();
      const container = document.querySelector(
        '[data-testid="vt-container"]',
      ) as HTMLElement;
      if (!container) return Array.from(artists);

      // Scroll through the table in steps to capture all virtualized rows
      const { scrollHeight } = container;
      const step = 400;
      for (let pos = 0; pos <= scrollHeight; pos += step) {
        container.scrollTop = pos;
        // Allow React to re-render the virtualized rows
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
        const rows = document.querySelectorAll('[data-track-id]');
        rows.forEach((row) => {
          // Artist is the second td cell (index 1)
          const artistCell = row.querySelectorAll('td')[1];
          if (artistCell?.textContent) {
            artists.add(artistCell.textContent.trim());
          }
        });
      }

      // Scroll back to top
      container.scrollTop = 0;
      return Array.from(artists);
    });

    // Verify specific test artists are present in the library
    expect(allArtists).toContain('Aurora Synth');
    expect(allArtists).toContain('The Jazz Collective');
    expect(allArtists).toContain('Rock Titans');
    expect(allArtists).toContain('Hip Hop Legends');
    expect(allArtists).toContain('Classical Masters');

    await TestHelpers.closeApp(app);
  });

  test('should sort songs by different columns', async () => {
    const { app, page } = await TestHelpers.launchApp();

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
    // Click the Title column header directly to sort ascending
    // The header's aria-sort attribute flips as soon as the table commits the
    // new sort, so it replaces every "click then sleep" pair below.
    const titleHeader = page.locator('th').filter({ hasText: 'Title' }).first();
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

    // Get titles after sorting by Title ascending
    let titles = await getSongTitles();
    // Titles should be sorted alphabetically
    const sortedTitles = [...titles].sort();
    expect(titles).toEqual(sortedTitles);

    // Test sorting by Title column - descending
    // Click the Title header again to toggle to descending
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

    titles = await getSongTitles();
    // Titles should be sorted in reverse alphabetical order
    const reverseSortedTitles = [...titles].sort().reverse();
    expect(titles).toEqual(reverseSortedTitles);

    // Test sorting by Artist column - descending
    // Click Artist header once for ascending, then again for descending
    const artistHeader = page
      .locator('th')
      .filter({ hasText: 'Artist' })
      .first();
    await artistHeader.click();
    await expect(artistHeader).toHaveAttribute('aria-sort', 'ascending');
    await artistHeader.click();
    await expect(artistHeader).toHaveAttribute('aria-sort', 'descending');

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

    // Navigate to Settings
    // Click the settings button using its data-testid
    const settingsButton = page.locator('[data-testid="nav-settings"]');
    await settingsButton.click();
    await page.waitForSelector('[data-testid="settings-view"]');

    // Find and click the "Rescan Library" button
    const rescanButton = page.locator('button:has-text("Rescan Library")');
    await expect(rescanButton).toBeVisible();
    await rescanButton.click();

    // The main process pushes `library:scanComplete` when the scan finishes,
    // which surfaces this notification. Waiting on it means the test returns
    // the instant the scan is done rather than after a fixed 30s fallback.
    await expect(
      page
        .locator('[data-testid="notification-item"]')
        .filter({ hasText: 'Library scan completed' }),
    ).toBeVisible({ timeout: 60000 });

    // The scan-progress dialog is bound to the mutation's pending state, which
    // settles a moment after the push event; wait for it to unmount so it stops
    // intercepting clicks. (The Settings panel is itself a role="dialog", so
    // match the scan dialog by its completion title rather than by role.)
    await expect(
      page.getByRole('heading', { name: 'Scan Complete' }),
    ).toBeHidden({ timeout: 60000 });

    // Count files after rescan
    const finalFileCount = getFileCount(testSongsDir);
    const finalFiles = getFileList(testSongsDir);

    console.log(`Final file count: ${finalFileCount}`);

    // Verify no files were duplicated
    expect(finalFileCount).toBe(initialFileCount);
    expect(finalFiles).toEqual(initialFiles);

    // Close the Settings drawer before navigating back
    await page.keyboard.press('Escape');

    // Navigate back to library (sidebar is still open). Playwright waits for
    // the nav button to be actionable, which covers the drawer transition.
    await page.locator('[data-testid="nav-library"]').click();

    // Verify songs are visible in the UI (virtualization limits visible rows to ~45)
    await TestHelpers.waitForTracks(page);

    await TestHelpers.takeScreenshot(page, 'library-after-rescan');

    await TestHelpers.closeApp(app);
  });
});
