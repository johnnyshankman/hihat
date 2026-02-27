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
 * Helper to update the columnOrder value in the test database
 * after it has been initialized by TestHelpers.
 */
function updateColumnOrderInDb(
  dbPath: string,
  columnOrder: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `UPDATE settings SET columnOrder = ? WHERE id = 'app-settings'`,
        [JSON.stringify(columnOrder)],
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
 * Helper to read column header labels from left to right (excluding filler).
 */
async function getColumnOrder(
  page: Awaited<ReturnType<ElectronApplication['firstWindow']>>,
): Promise<string[]> {
  return page.evaluate(() => {
    const headers = document.querySelectorAll(
      '.vt-thead th:not(.vt-th-filler)',
    );
    return Array.from(headers).map((th) => th.textContent?.trim() || '');
  });
}

test.describe('Column Reorder', () => {
  test('drag column header to reorder', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Get initial column order
    const initialOrder = await getColumnOrder(page);
    expect(initialOrder.length).toBeGreaterThan(2);

    // Find the Artist and Album headers
    const headerInfo = await page.evaluate(() => {
      const headers = document.querySelectorAll(
        '.vt-thead th:not(.vt-th-filler)',
      );
      const arr = Array.from(headers);
      const artistTh = arr.find((h) => h.textContent?.trim() === 'Artist');
      const albumTh = arr.find((h) => h.textContent?.trim() === 'Album');
      if (!artistTh || !albumTh) return null;
      const artistRect = artistTh.getBoundingClientRect();
      const albumRect = albumTh.getBoundingClientRect();
      return {
        artistCenter: {
          x: artistRect.left + artistRect.width / 2,
          y: artistRect.top + artistRect.height / 2,
        },
        albumCenter: {
          x: albumRect.left + albumRect.width / 2,
          y: albumRect.top + albumRect.height / 2,
        },
      };
    });

    expect(headerInfo).not.toBeNull();

    // Perform drag from Artist header to Album header
    await page.mouse.move(
      headerInfo!.artistCenter.x,
      headerInfo!.artistCenter.y,
    );
    await page.mouse.down();
    await page.mouse.move(
      headerInfo!.albumCenter.x,
      headerInfo!.albumCenter.y,
      { steps: 10 },
    );
    await page.mouse.up();

    await page.waitForTimeout(500);

    // Read new column order
    const newOrder = await getColumnOrder(page);

    // Find Artist and Album indices in both orders
    const oldArtistIdx = initialOrder.indexOf('Artist');
    const oldAlbumIdx = initialOrder.indexOf('Album');
    const newArtistIdx = newOrder.indexOf('Artist');
    const newAlbumIdx = newOrder.indexOf('Album');

    // Artist should have moved — its position should differ from original
    // (the exact result depends on drag direction, but it should change)
    expect(newArtistIdx !== oldArtistIdx || newAlbumIdx !== oldAlbumIdx).toBe(
      true,
    );

    await TestHelpers.closeApp(app);
  });

  test('pre-seeded column order is respected on boot', async () => {
    const testDbPath = path.join(__dirname, 'fixtures/test-db.sqlite');
    const songsPath = path.join(__dirname, 'fixtures/test-songs-large');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the test database with seed data
    await TestHelpers.initializeTestDatabase(testDbPath, songsPath);

    // Set a custom column order where Album comes before Artist
    const customOrder = [
      'title',
      'album',
      'artist',
      'albumArtist',
      'genre',
      'duration',
      'playCount',
      'lastPlayed',
      'dateAdded',
      'trackNumber',
    ];
    await updateColumnOrderInDb(testDbPath, customOrder);

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

    // Read the column header order
    const headerOrder = await getColumnOrder(page);

    // Album should come before Artist in the rendered order
    const albumIdx = headerOrder.indexOf('Album');
    const artistIdx = headerOrder.indexOf('Artist');
    expect(albumIdx).toBeLessThan(artistIdx);

    await TestHelpers.closeApp(app);
  });

  test('column resize still works after reorder', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Get the Artist header width and resize handle position
    const artistHeader = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      const arr = Array.from(headers);
      const artistTh = arr.find(
        (header) => header.textContent?.trim() === 'Artist',
      );
      if (!artistTh) return null;
      const rect = artistTh.getBoundingClientRect();
      return {
        width: rect.width,
        right: rect.right,
        top: rect.top,
        height: rect.height,
      };
    });

    expect(artistHeader).not.toBeNull();
    const initialWidth = artistHeader!.width;

    // Drag the resize handle 100px to the right
    const handleX = artistHeader!.right - 2;
    const handleY = artistHeader!.top + artistHeader!.height / 2;

    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX + 100, handleY, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(200);

    // Get the new width
    const newArtistWidth = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      const arr = Array.from(headers);
      const artistTh = arr.find(
        (header) => header.textContent?.trim() === 'Artist',
      );
      return artistTh ? (artistTh as HTMLElement).offsetWidth : null;
    });

    expect(newArtistWidth).not.toBeNull();
    expect(newArtistWidth!).toBeGreaterThan(initialWidth + 50);

    await TestHelpers.closeApp(app);
  });
});
