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
 * Helper to read column header labels from left to right (excluding filler).
 */
async function getColumnHeaders(
  page: Awaited<ReturnType<ElectronApplication['firstWindow']>>,
): Promise<string[]> {
  return page.evaluate(() => {
    const headers = document.querySelectorAll(
      '.vt-thead th:not(.vt-th-filler)',
    );
    return Array.from(headers).map((th) => th.textContent?.trim() || '');
  });
}

/**
 * Helper to update a column visibility value in the test database.
 */
function updateColumnVisibilityInDb(
  dbPath: string,
  columnId: string,
  visible: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Read current columns JSON, update the target key, and write back
      db.get(
        `SELECT columns FROM settings WHERE id = 'app-settings'`,
        (getErr, row: { columns: string } | undefined) => {
          if (getErr) {
            db.close();
            reject(getErr);
            return;
          }

          const columns = row?.columns ? JSON.parse(row.columns) : {};
          columns[columnId] = visible;

          db.run(
            `UPDATE settings SET columns = ? WHERE id = 'app-settings'`,
            [JSON.stringify(columns)],
            (runErr) => {
              db.close();
              if (runErr) {
                reject(runErr);
              } else {
                resolve();
              }
            },
          );
        },
      );
    });
  });
}

test.describe('Column Visibility', () => {
  test('right-click header opens column visibility menu', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Right-click on the first header cell
    const firstHeader = page.locator('.vt-thead th:not(.vt-th-filler)').first();
    await firstHeader.click({ button: 'right' });

    // Wait for the MUI menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });

    // Verify menu items exist with checkboxes
    const menuItems = page.locator('[role="menu"] [role="menuitem"]');
    const count = await menuItems.count();
    expect(count).toBeGreaterThan(3);

    // Verify expected column names appear in the menu
    const menuText = await page.evaluate(() => {
      const items = document.querySelectorAll(
        '[role="menu"] [role="menuitem"]',
      );
      return Array.from(items).map((item) => item.textContent?.trim() || '');
    });

    expect(menuText).toContain('Title');
    expect(menuText).toContain('Artist');
    expect(menuText).toContain('Album');
    expect(menuText).toContain('Genre');

    await TestHelpers.closeApp(app);
  });

  test('unchecking a column hides it', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Get initial headers
    const initialHeaders = await getColumnHeaders(page);
    expect(initialHeaders).toContain('Genre');

    // Right-click a header to open the menu
    const firstHeader = page.locator('.vt-thead th:not(.vt-th-filler)').first();
    await firstHeader.click({ button: 'right' });
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });

    // Click "Genre" menu item to uncheck it
    const genreMenuItem = page.locator('[role="menuitem"]', {
      hasText: 'Genre',
    });
    await genreMenuItem.click();

    // Wait for the column to disappear
    await page.waitForTimeout(500);

    // Verify Genre header is no longer visible
    const updatedHeaders = await getColumnHeaders(page);
    expect(updatedHeaders).not.toContain('Genre');

    await TestHelpers.closeApp(app);
  });

  test('re-checking a column shows it', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // First hide Genre
    const header1 = page.locator('.vt-thead th:not(.vt-th-filler)').first();
    await header1.click({ button: 'right' });
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });

    const genreItem1 = page.locator('[role="menuitem"]', { hasText: 'Genre' });
    await genreItem1.click();
    await page.waitForTimeout(500);

    // Close the menu by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify Genre is hidden
    let headers = await getColumnHeaders(page);
    expect(headers).not.toContain('Genre');

    // Right-click again and re-check Genre
    const header2 = page.locator('.vt-thead th:not(.vt-th-filler)').first();
    await header2.click({ button: 'right' });
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });

    const genreItem2 = page.locator('[role="menuitem"]', { hasText: 'Genre' });
    await genreItem2.click();
    await page.waitForTimeout(500);

    // Verify Genre is visible again
    headers = await getColumnHeaders(page);
    expect(headers).toContain('Genre');

    await TestHelpers.closeApp(app);
  });

  test('column visibility persists across app restart', async () => {
    const testDbPath = path.join(__dirname, 'fixtures/test-db.sqlite');
    const songsPath = path.join(__dirname, 'fixtures/test-songs-large');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the test database with seed data
    await TestHelpers.initializeTestDatabase(testDbPath, songsPath);

    // Pre-hide Genre column in the database
    await updateColumnVisibilityInDb(testDbPath, 'genre', false);

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

    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Verify Genre column is hidden on boot
    const headers = await getColumnHeaders(page);
    expect(headers).not.toContain('Genre');

    // Other columns should still be visible
    expect(headers).toContain('Title');
    expect(headers).toContain('Artist');
    expect(headers).toContain('Album');

    await TestHelpers.closeApp(app);
  });
});
