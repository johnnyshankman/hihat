import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Helper to update the librarySorting value in the test database
 * after it has been initialized by TestHelpers.
 */
function updateLibrarySortingInDb(
  dbPath: string,
  sorting: Array<{ id: string; desc: boolean }>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `UPDATE settings SET librarySorting = ? WHERE id = 'app-settings'`,
        [JSON.stringify(sorting)],
        (runErr) => {
          db.close();
          if (runErr) {
            reject(runErr);
          } else {
            resolve();
          }
        },
      );
    });
  });
}

/**
 * Helper to update the sortPreference value for a specific playlist
 * in the test database.
 */
function updatePlaylistSortPreferenceInDb(
  dbPath: string,
  playlistId: string,
  sorting: Array<{ id: string; desc: boolean }>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `UPDATE playlists SET sortPreference = ? WHERE id = ?`,
        [JSON.stringify(sorting), playlistId],
        (runErr) => {
          db.close();
          if (runErr) {
            reject(runErr);
          } else {
            resolve();
          }
        },
      );
    });
  });
}

/**
 * Helper to find which column header has a sort indicator (aria-sort attribute).
 * Returns the column name and sort direction, or null if none found.
 */
async function getActiveSortColumn(
  page: Awaited<ReturnType<ElectronApplication['firstWindow']>>,
): Promise<{ column: string; direction: 'ascending' | 'descending' } | null> {
  return page.evaluate(() => {
    const headers = document.querySelectorAll('th');
    // eslint-disable-next-line no-restricted-syntax
    for (const header of Array.from(headers)) {
      const sortDir = header.getAttribute('aria-sort');
      if (sortDir === 'ascending' || sortDir === 'descending') {
        const text = header.textContent?.trim() || '';
        return { column: text, direction: sortDir };
      }
    }
    return null;
  });
}

test.describe('Sorting Persistence', () => {
  test('in-session sorting persists across playlist navigation', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Click "Album" column header to sort library by album
    const albumHeader = page.locator('th:has-text("Album")').first();
    await albumHeader.click();
    await page.waitForTimeout(500);

    // Verify sort indicator is on Album column
    let sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Album');

    // Navigate to "Test Playlist" in sidebar
    const testPlaylist = page.locator('text=Test Playlist').first();
    await testPlaylist.click();
    await page.waitForTimeout(1000);

    // Click "Title" column header in playlist view
    const titleHeader = page.locator('th:has-text("Title")').first();
    await titleHeader.click();
    await page.waitForTimeout(500);

    // Verify sort indicator is on Title column
    sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Title');

    // Navigate back to library ("All" in sidebar)
    const allNav = page.locator('[data-testid="nav-library"]');
    await allNav.click();
    await page.waitForTimeout(1000);

    // Assert: Album column still has sort indicator
    sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Album');

    // Navigate back to "Test Playlist"
    await testPlaylist.click();
    await page.waitForTimeout(1000);

    // Assert: Title column still has sort indicator
    sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Title');

    // Navigate to "Jazz Favorites"
    const jazzPlaylist = page.locator('text=Jazz Favorites').first();
    await jazzPlaylist.click();
    await page.waitForTimeout(1000);

    // Click "Genre" column header
    const genreHeader = page.locator('th:has-text("Genre")').first();
    await genreHeader.click();
    await page.waitForTimeout(500);

    // Verify sort indicator is on Genre column
    sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Genre');

    // Navigate back to "Test Playlist"
    await testPlaylist.click();
    await page.waitForTimeout(1000);

    // Assert: Title column still has sort indicator (not Genre)
    sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Title');

    // Navigate back to "Jazz Favorites"
    await jazzPlaylist.click();
    await page.waitForTimeout(1000);

    // Assert: Genre column still has sort indicator
    sortInfo = await getActiveSortColumn(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column).toContain('Genre');

    await TestHelpers.closeApp(app);
  });

  test('pre-seeded sorting preferences respected on boot', async () => {
    const testDbPath = path.join(__dirname, 'fixtures/test-db.sqlite');
    const songsPath = path.join(__dirname, 'fixtures/test-songs-large');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the test database with seed data
    await TestHelpers.initializeTestDatabase(testDbPath, songsPath);

    // Inject library sorting preference: album descending
    await updateLibrarySortingInDb(testDbPath, [{ id: 'album', desc: true }]);

    // Inject playlist sorting preference for Test Playlist: title ascending
    await updatePlaylistSortPreferenceInDb(testDbPath, 'playlist-1', [
      { id: 'title', desc: false },
    ]);

    // Launch the app with the pre-seeded database
    const appPath = path.join(__dirname, '../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    const app: ElectronApplication = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_MODE: 'true',
        TEST_DB_PATH: testDbPath,
        TEST_SONGS_PATH: songsPath,
      },
      timeout: 30000,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Assert: Album column has descending sort indicator
    const librarySortInfo = await getActiveSortColumn(page);
    expect(librarySortInfo).not.toBeNull();
    expect(librarySortInfo!.column).toContain('Album');
    expect(librarySortInfo!.direction).toBe('descending');

    // Navigate to "Test Playlist"
    const testPlaylist = page.locator('text=Test Playlist').first();
    await testPlaylist.click();
    await page.waitForTimeout(1000);

    // Assert: Title column has ascending sort indicator
    const playlistSortInfo = await getActiveSortColumn(page);
    expect(playlistSortInfo).not.toBeNull();
    expect(playlistSortInfo!.column).toContain('Title');
    expect(playlistSortInfo!.direction).toBe('ascending');

    await TestHelpers.closeApp(app);
  });
});
