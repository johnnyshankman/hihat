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

/**
 * Assert which column currently owns the sort indicator, retrying until the
 * table commits. Every view transition in these tests moves the indicator to a
 * different column, so polling on it doubles as the "the new view rendered"
 * signal — no fixed delays needed.
 */
async function expectActiveSort(
  page: Awaited<ReturnType<ElectronApplication['firstWindow']>>,
  column: string,
  direction?: 'ascending' | 'descending',
): Promise<void> {
  await expect
    .poll(async () => {
      const info = await getActiveSortColumn(page);
      return info ? `${info.column}|${info.direction}` : 'none';
    })
    .toMatch(
      new RegExp(`${column}.*\\|${direction ?? '(ascending|descending)'}`),
    );
}

test.describe('Sorting Persistence', () => {
  test('in-session sorting persists across playlist navigation', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Click "Album" column header to sort library by album
    const albumHeader = page.locator('th:has-text("Album")').first();
    await albumHeader.click();

    // Verify sort indicator is on Album column
    await expectActiveSort(page, 'Album');

    // Navigate to "Test Playlist" in sidebar
    const testPlaylist = page.locator('text=Test Playlist').first();
    await testPlaylist.click();
    await TestHelpers.waitForTrackCount(page, 3);

    // Click "Title" column header in playlist view
    const titleHeader = page.locator('th:has-text("Title")').first();
    await titleHeader.click();

    // Verify sort indicator is on Title column
    await expectActiveSort(page, 'Title');

    // Navigate back to library ("All" in sidebar)
    const allNav = page.locator('[data-testid="nav-library"]');
    await allNav.click();

    // Assert: Album column still has sort indicator
    await expectActiveSort(page, 'Album');

    // Navigate back to "Test Playlist"
    await testPlaylist.click();

    // Assert: Title column still has sort indicator
    await expectActiveSort(page, 'Title');

    // Navigate to "Jazz Favorites"
    const jazzPlaylist = page.locator('text=Jazz Favorites').first();
    await jazzPlaylist.click();

    // Click "Genre" column header
    const genreHeader = page.locator('th:has-text("Genre")').first();
    await genreHeader.click();

    // Verify sort indicator is on Genre column
    await expectActiveSort(page, 'Genre');

    // Navigate back to "Test Playlist"
    await testPlaylist.click();

    // Assert: Title column still has sort indicator (not Genre)
    await expectActiveSort(page, 'Title');

    // Navigate back to "Jazz Favorites"
    await jazzPlaylist.click();

    // Assert: Genre column still has sort indicator
    await expectActiveSort(page, 'Genre');

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

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 20000 });

    // Assert: Album column has descending sort indicator
    await expectActiveSort(page, 'Album', 'descending');

    // Navigate to "Test Playlist"
    const testPlaylist = page.locator('text=Test Playlist').first();
    await testPlaylist.click();
    await TestHelpers.waitForTrackCount(page, 3);

    // Assert: Title column has ascending sort indicator
    await expectActiveSort(page, 'Title', 'ascending');

    await TestHelpers.closeApp(app);
  });
});
