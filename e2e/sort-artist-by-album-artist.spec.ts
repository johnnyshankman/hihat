import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { TestHelpers } from './helpers/test-helpers';

const FIXTURE_SQL = 'album-artist-sort-db.sql';
const TEST_DB_FILENAME = 'album-artist-sort-db.sqlite';
const TEST_DB_FILENAME_OFF = 'album-artist-sort-db-toggle-off.sqlite';
const TEST_SONGS_DIR = 'test-songs-large';

/**
 * Initialize the album-artist sort fixture database. Mirrors
 * TestHelpers.initializeTestDatabase but loads our small custom fixture.
 */
function initializeAlbumArtistSortDatabase(
  dbPath: string,
  testSongsPath: string,
): Promise<void> {
  const sqlFilePath = path.join(__dirname, `fixtures/${FIXTURE_SQL}`);
  let sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
  sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      db.exec(sqlContent, (execErr) => {
        db.close();
        if (execErr) {
          reject(execErr);
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Update the sortArtistByAlbumArtist value in the seeded test database
 * before launch, so each test starts from a known toggle state without
 * relying on cross-test ordering.
 */
function setSortArtistByAlbumArtistInDb(
  dbPath: string,
  value: 0 | 1,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      db.run(
        `UPDATE settings SET sortArtistByAlbumArtist = ? WHERE id = 'app-settings'`,
        [value],
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

async function launchWithFixture(
  dbPath: string,
  songsPath: string,
): Promise<{ app: ElectronApplication; page: Page }> {
  const appPath = path.join(__dirname, '../release/app');
  const mainJsPath = path.join(appPath, 'dist/main/main.js');
  if (!fs.existsSync(mainJsPath)) {
    throw new Error('Application not built. Please run "npm run build" first.');
  }

  const app: ElectronApplication = await electron.launch({
    args: [appPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_MODE: 'true',
      TEST_DB_PATH: dbPath,
      TEST_SONGS_PATH: songsPath,
    },
    timeout: 30000,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  return { app, page };
}

/**
 * Read the visible track-id order from the rendered virtual table.
 * Returns ids in DOM order, which equals sorted/visible order for the
 * fixture sizes used here (well below the virtualization threshold).
 */
async function getRenderedTrackIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('[data-track-id]');
    return Array.from(rows).map(
      (el) => (el as HTMLElement).dataset.trackId || '',
    );
  });
}

test.describe('Artist column — sort by album artist (toggle on)', () => {
  test('groups featured-artist tracks under their album artist', async () => {
    const testDbPath = path.join(__dirname, `fixtures/${TEST_DB_FILENAME}`);
    const songsPath = path.join(__dirname, `fixtures/${TEST_SONGS_DIR}`);

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    await initializeAlbumArtistSortDatabase(testDbPath, songsPath);
    await setSortArtistByAlbumArtistInDb(testDbPath, 1);

    const { app, page } = await launchWithFixture(testDbPath, songsPath);

    // Library table renders our 6 fixture tracks.
    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id="sas-001"]', { timeout: 10000 });

    // Click the Artist header to apply ascending sort.
    const artistHeader = page.locator('th:has-text("Artist")').first();
    await artistHeader.click();
    await page.waitForTimeout(500);

    // Confirm the sort indicator landed on Artist (not Album Artist) and is
    // ascending — guards against the locator picking up the wrong header.
    const sortInfo = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      // eslint-disable-next-line no-restricted-syntax
      for (const header of Array.from(headers)) {
        const dir = header.getAttribute('aria-sort');
        if (dir === 'ascending' || dir === 'descending') {
          return { column: (header.textContent || '').trim(), direction: dir };
        }
      }
      return null;
    });
    expect(sortInfo).not.toBeNull();
    // Header text includes a trailing ▲/▼ sort glyph; assert by prefix and
    // explicitly rule out 'Album Artist' so a regression that targets the
    // wrong column would fail loudly here.
    expect(sortInfo!.column.startsWith('Artist')).toBe(true);
    expect(sortInfo!.column.startsWith('Album')).toBe(false);
    expect(sortInfo!.direction).toBe('ascending');

    // With the toggle ON, primary sort key is `albumArtist || artist`. Frank
    // Ocean (album artist 'Frank Ocean') sorts before Kendrick Lamar; within
    // each album artist, the secondary keys are album then trackNumber. The
    // 'feat. Drake' / 'feat. SZA' / 'feat. Rihanna' rows must stay grouped
    // with the rest of the Kendrick Lamar tracks rather than scattering.
    const orderedIds = await getRenderedTrackIds(page);
    expect(orderedIds).toEqual([
      'sas-001', // Frank Ocean / Blonde / 1
      'sas-002', // Frank Ocean / Channel Orange / 2
      'sas-003', // Kendrick Lamar / DAMN / 1
      'sas-004', // Kendrick Lamar feat. Rihanna / DAMN / 2
      'sas-005', // Kendrick Lamar feat. Drake / good kid m.A.A.d city / 3
      'sas-006', // Kendrick Lamar feat. SZA / good kid m.A.A.d city / 4
    ]);

    await TestHelpers.takeScreenshot(page, 'sort-artist-toggle-on');
    await TestHelpers.closeApp(app);
  });
});

test.describe('Artist column — sort by raw artist (toggle off)', () => {
  test('flipping the toggle off scatters featured-artist tracks by raw artist', async () => {
    const testDbPath = path.join(__dirname, `fixtures/${TEST_DB_FILENAME_OFF}`);
    const songsPath = path.join(__dirname, `fixtures/${TEST_SONGS_DIR}`);

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Seed default-on so the test exercises the round-trip through the UI
    // (Settings switch -> useUpdateSettings mutation -> settings:update IPC ->
    // db -> renderer query cache invalidation -> column-defs useMemo rebuild).
    await initializeAlbumArtistSortDatabase(testDbPath, songsPath);
    await setSortArtistByAlbumArtistInDb(testDbPath, 1);

    const { app, page } = await launchWithFixture(testDbPath, songsPath);

    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id="sas-001"]', { timeout: 10000 });

    // Flip the toggle off via the Settings UI.
    await page.click('[data-testid="nav-settings"]');
    await page.waitForTimeout(500);

    const toggle = page.locator(
      '[data-testid="sort-artist-by-album-artist-toggle"]',
    );
    await expect(toggle).toBeVisible();
    expect(await toggle.isChecked()).toBe(true);
    await toggle.click();
    await page.waitForTimeout(300);
    expect(await toggle.isChecked()).toBe(false);

    // Confirm the value is persisted via IPC, not just the local switch state.
    const persistedAfterOff = await page.evaluate(() =>
      (window as Window & { electron?: any }).electron.settings
        .get()
        .then((s: { sortArtistByAlbumArtist: boolean }) =>
          Boolean(s.sortArtistByAlbumArtist),
        ),
    );
    expect(persistedAfterOff).toBe(false);

    // Settings opens as a temporary MUI Drawer that overlays the library
    // and intercepts pointer events for everything underneath. Press Escape
    // to dismiss it before re-targeting the table — the underlying library
    // state is preserved across the drawer toggle.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.waitForSelector('.vt-table', { timeout: 10000 });
    await page.waitForSelector('[data-track-id="sas-001"]', { timeout: 10000 });

    const artistHeader = page.locator('th:has-text("Artist")').first();
    await artistHeader.click();
    await page.waitForTimeout(500);

    const sortInfo = await page.evaluate(() => {
      const headers = document.querySelectorAll('th');
      // eslint-disable-next-line no-restricted-syntax
      for (const header of Array.from(headers)) {
        const dir = header.getAttribute('aria-sort');
        if (dir === 'ascending' || dir === 'descending') {
          return { column: (header.textContent || '').trim(), direction: dir };
        }
      }
      return null;
    });
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column.startsWith('Artist')).toBe(true);
    expect(sortInfo!.column.startsWith('Album')).toBe(false);
    expect(sortInfo!.direction).toBe('ascending');

    // With the toggle OFF, sort by raw `artist` (lowercased, leading 'the '
    // stripped). Tie-break is album then trackNumber. Expected ordering:
    //   sas-001 'Frank Ocean'                  / Blonde         / 1
    //   sas-002 'Frank Ocean'                  / Channel Orange / 2
    //   sas-003 'Kendrick Lamar'               / DAMN           / 1
    //   sas-005 'Kendrick Lamar feat. Drake'   / good kid m...  / 3
    //   sas-004 'Kendrick Lamar feat. Rihanna' / DAMN           / 2
    //   sas-006 'Kendrick Lamar feat. SZA'     / good kid m...  / 4
    //
    // This DIFFERS from the toggle-on order at positions 4-5: sas-004 (the
    // 'feat. Rihanna' track on DAMN) drifts AWAY from its album group and
    // lands between sas-005 ('feat. Drake') and sas-006 ('feat. SZA'). That
    // divergence is the proof the toggle actually flips behavior.
    const orderedIds = await getRenderedTrackIds(page);
    expect(orderedIds).toEqual([
      'sas-001',
      'sas-002',
      'sas-003',
      'sas-005',
      'sas-004',
      'sas-006',
    ]);

    // Sanity check: the toggle-on order is NOT this order — guards against a
    // future regression where the comparator stops differentiating.
    expect(orderedIds).not.toEqual([
      'sas-001',
      'sas-002',
      'sas-003',
      'sas-004',
      'sas-005',
      'sas-006',
    ]);

    await TestHelpers.takeScreenshot(page, 'sort-artist-toggle-off');
    await TestHelpers.closeApp(app);
  });
});
