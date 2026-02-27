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
 * Helper to update the columnWidths value in the test database
 * after it has been initialized by TestHelpers.
 */
function updateColumnWidthsInDb(
  dbPath: string,
  columnWidths: Record<string, number>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(
        `UPDATE settings SET columnWidths = ? WHERE id = 'app-settings'`,
        [JSON.stringify(columnWidths)],
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

test.describe('Column Widths Persistence', () => {
  test('pre-seeded column widths are respected on boot', async () => {
    const testDbPath = path.join(__dirname, 'fixtures/test-db.sqlite');
    const songsPath = path.join(__dirname, 'fixtures/test-songs-large');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the test database with seed data
    await TestHelpers.initializeTestDatabase(testDbPath, songsPath);

    // Inject custom column widths into the settings row
    const customWidths = { artist: 400, album: 300 };
    await updateColumnWidthsInDb(testDbPath, customWidths);

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

    // Get the rendered width of the artist column header
    const artistWidth = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      const arr = Array.from(headers);
      const artistTh = arr.find((header) => {
        return header.textContent?.trim() === 'Artist';
      });
      return artistTh ? (artistTh as HTMLElement).offsetWidth : null;
    });

    // Assert artist column is approximately 400px (allow small tolerance)
    expect(artistWidth).not.toBeNull();
    expect(artistWidth!).toBeGreaterThanOrEqual(390);
    expect(artistWidth!).toBeLessThanOrEqual(410);

    // Get the rendered width of the title column (not in custom widths, should be default 350)
    const titleWidth = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      const arr = Array.from(headers);
      const titleTh = arr.find((header) =>
        header.textContent?.includes('Title'),
      );
      return titleTh ? (titleTh as HTMLElement).offsetWidth : null;
    });

    // Title should be at its default width (350)
    expect(titleWidth).not.toBeNull();
    expect(titleWidth!).toBeGreaterThanOrEqual(340);
    expect(titleWidth!).toBeLessThanOrEqual(360);

    await TestHelpers.closeApp(app);
  });

  test('resize interaction changes column width', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Find the artist column header and its bounding rect
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

    // The resize handle is at the right edge of the header.
    // Drag it 100px to the right to widen the column.
    const handleX = artistHeader!.right - 2;
    const handleY = artistHeader!.top + artistHeader!.height / 2;

    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX + 100, handleY, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(200);

    // Get the new width of the artist column
    const newArtistWidth = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      const arr = Array.from(headers);
      const artistTh = arr.find(
        (header) => header.textContent?.trim() === 'Artist',
      );
      return artistTh ? (artistTh as HTMLElement).offsetWidth : null;
    });

    expect(newArtistWidth).not.toBeNull();
    // The column should have gotten wider by approximately 100px
    expect(newArtistWidth!).toBeGreaterThan(initialWidth + 50);

    await TestHelpers.closeApp(app);
  });
});
