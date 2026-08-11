/* eslint-disable import/prefer-default-export */
import {
  _electron as electron,
  expect,
  ElectronApplication,
  Locator,
  Page,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';

// All tests use the consolidated test library (200 tracks)
const TEST_SONGS_DIR = 'test-songs-large';
const TEST_DB_SQL = 'test-db.sql';

// Generous ceiling for "the app should have settled by now" waits. These are
// upper bounds on retrying assertions, not sleeps — a healthy app resolves them
// in tens of milliseconds, so raising the ceiling costs nothing when passing and
// only buys headroom on a loaded CI machine.
const READY_TIMEOUT = 20000;

export class TestHelpers {
  static async initializeTestDatabase(
    dbPath: string,
    testSongsPath: string,
  ): Promise<void> {
    const sqlFilePath = path.join(__dirname, `../fixtures/${TEST_DB_SQL}`);
    let sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    // Replace placeholder with actual test songs path
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

  static async initializeNewUserDatabase(
    dbPath: string,
    testSongsPath: string,
  ): Promise<void> {
    const sqlFilePath = path.join(__dirname, '../fixtures/new-user-db.sql');
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

  static async initializeMigrationDatabase(
    dbPath: string,
    testSongsPath: string,
  ): Promise<void> {
    const sqlFilePath = path.join(__dirname, '../fixtures/migration-db.sql');
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

  static async launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
    const testDbPath = path.join(__dirname, '../fixtures/test-db.sqlite');
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the test database with seed data
    await this.initializeTestDatabase(testDbPath, songsPath);

    // Path to the built application
    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    const app = await electron.launch({
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
    // The seeded library is the readiness signal: once rows are in the DOM the
    // renderer has booted, queries have resolved and the virtual table has laid
    // out. No arbitrary sleep required.
    await this.waitForTracks(page);

    const rootContent = await page.locator('#root').innerHTML();
    if (rootContent.length < 100) {
      throw new Error('Application did not render properly');
    }

    return { app, page };
  }

  static async launchAppAsBrandNewUser(): Promise<{
    app: ElectronApplication;
    page: Page;
  }> {
    const testDbPath = path.join(__dirname, '../fixtures/new-user-db.sqlite');
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    await this.initializeNewUserDatabase(testDbPath, songsPath);

    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    const app = await electron.launch({
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
    // A brand new user has no tracks, so the empty-state CTA is the readiness
    // signal. MainLayout only renders it once the tracks/playlists queries have
    // settled, so seeing it means the renderer is fully booted.
    await page.waitForSelector('text=Your library is empty', {
      timeout: READY_TIMEOUT,
    });

    const rootContent = await page.locator('#root').innerHTML();
    if (rootContent.length < 100) {
      throw new Error('Application did not render properly');
    }

    return { app, page };
  }

  static async closeApp(app: ElectronApplication): Promise<void> {
    await app.close();
  }

  static async takeScreenshot(page: Page, name: string): Promise<void> {
    await page.screenshot({
      path: path.join(__dirname, `../screenshots/${name}.png`),
      fullPage: true,
    });
  }

  /**
   * Wait until the track table has rendered at least one row.
   *
   * This is the canonical "the library is on screen" signal — the virtual table
   * only emits `data-track-id` rows after the tracks query has resolved and the
   * virtualizer has measured the container.
   */
  static async waitForTracks(
    page: Page,
    timeout = READY_TIMEOUT,
  ): Promise<void> {
    await page.waitForSelector('[data-track-id]', { timeout });
  }

  /**
   * Wait until the rendered track row count settles on `expected`.
   *
   * Prefer this over `count()`-after-a-sleep: it retries until the DOM agrees,
   * so it returns the moment the table has re-rendered rather than after a
   * guessed delay.
   */
  static async waitForTrackCount(
    page: Page,
    expected: number,
    timeout = READY_TIMEOUT,
  ): Promise<void> {
    await expect(page.locator('[data-track-id]')).toHaveCount(expected, {
      timeout,
    });
  }

  static async waitForLibraryLoad(page: Page): Promise<void> {
    await this.waitForTracks(page);
  }

  /** Locator for the transport button's "currently playing" state. */
  static pauseIcon(page: Page): Locator {
    return page.locator('button svg[data-testid="PauseIcon"]');
  }

  /** Locator for the transport button's "currently paused/stopped" state. */
  static playIcon(page: Page): Locator {
    return page.locator('button svg[data-testid="PlayArrowIcon"]');
  }

  /** Wait until the transport reports playing. */
  static async waitForPlaying(page: Page, timeout = READY_TIMEOUT) {
    await expect(this.pauseIcon(page)).toBeVisible({ timeout });
  }

  /** Wait until the transport reports paused. */
  static async waitForPaused(page: Page, timeout = READY_TIMEOUT) {
    await expect(this.playIcon(page)).toBeVisible({ timeout });
  }

  /**
   * Double-click a track row and wait until it is the current track and the
   * transport reports playing. Replaces the `dblclick` + `waitForTimeout(1000)`
   * pattern: playback state flips in tens of milliseconds, so waiting on the
   * state itself is both faster and immune to a slow machine.
   */
  static async startPlayback(page: Page, row: Locator): Promise<void> {
    await row.dblclick();
    await expect(row).toHaveClass(/vt-row-playing/, { timeout: READY_TIMEOUT });
    await this.waitForPlaying(page);
  }

  /** The title currently shown in the player's now-playing slot. */
  static async nowPlayingTitle(page: Page): Promise<string> {
    return (
      (await page.locator('[data-testid="now-playing-title"]').textContent()) ??
      ''
    );
  }

  /** Wait until the player's now-playing title equals `title`. */
  static async waitForNowPlaying(
    page: Page,
    title: string,
    timeout = READY_TIMEOUT,
  ): Promise<void> {
    await expect(page.locator('[data-testid="now-playing-title"]')).toHaveText(
      title,
      { timeout },
    );
  }

  /**
   * Wait until the now-playing title is something other than `previous`.
   * Used after skip/next/autoplay transitions where the destination track isn't
   * known up front.
   */
  static async waitForNowPlayingChange(
    page: Page,
    previous: string,
    timeout = READY_TIMEOUT,
  ): Promise<void> {
    await expect(
      page.locator('[data-testid="now-playing-title"]'),
    ).not.toHaveText(previous, { timeout });
  }

  /**
   * Wait until the player's elapsed-time readout reaches at least `seconds`.
   *
   * Tests that need real playback to elapse (play-count thresholds, autoplay
   * roll-over) should gate on the clock the app actually shows rather than
   * sleeping for a guessed duration.
   */
  static async waitForElapsedAtLeast(
    page: Page,
    seconds: number,
    timeout = 30000,
  ): Promise<void> {
    await expect
      .poll(
        async () => {
          const text = await page
            .locator('[data-testid="player-elapsed-time"]')
            .textContent();
          const [mins, secs] = (text ?? '0:00').split(':');
          return parseInt(mins, 10) * 60 + parseInt(secs, 10);
        },
        { timeout },
      )
      .toBeGreaterThanOrEqual(seconds);
  }

  static async importSongs(page: Page): Promise<void> {
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);

    await page.evaluate(async (folderPath) => {
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, songsPath);

    // The scan resolves in the main process, then `scanCompleteInvalidator`
    // refreshes the tracks query — wait for the rows, not a fixed delay.
    await this.waitForTracks(page, 30000);
  }

  static async navigateToView(
    page: Page,
    view: 'library' | 'settings',
  ): Promise<void> {
    await page.click(`[data-testid="nav-${view}"]`);
    if (view === 'settings') {
      await page.waitForSelector('[data-testid="settings-view"]', {
        timeout: READY_TIMEOUT,
      });
    } else {
      await this.waitForTracks(page);
    }
  }

  /**
   * Prepare a userConfig.json fixture for migration testing
   */
  static prepareMigrationFixture(
    fixtureConfigPath: string,
    testSongsPath: string,
  ): void {
    const templatePath = path.join(__dirname, '../fixtures/userConfig.json');
    let configContent = fs.readFileSync(templatePath, 'utf-8');

    configContent = configContent.replace(
      /\{\{TEST_SONGS_PATH\}\}/g,
      testSongsPath,
    );

    fs.writeFileSync(fixtureConfigPath, configContent, 'utf-8');
  }

  /**
   * Clean up migration-related files
   */
  static cleanupMigrationFiles(configPath: string): void {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    const migratedPath = `${configPath}.migrated`;
    if (fs.existsSync(migratedPath)) {
      fs.unlinkSync(migratedPath);
    }
  }

  /**
   * Unmark a migration (rename .migrated back to .json)
   */
  static unmarkMigration(configPath: string): void {
    const migratedPath = `${configPath}.migrated`;
    if (fs.existsSync(migratedPath)) {
      fs.renameSync(migratedPath, configPath);
    }
  }

  /**
   * Launch the app with v1 to v2 migration mode enabled
   */
  static async launchAppWithMigration(): Promise<{
    app: ElectronApplication;
    page: Page;
  }> {
    const testDbPath = path.join(
      __dirname,
      '../fixtures/migration-test-db.sqlite',
    );
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);
    const legacyConfigPath = path.join(
      __dirname,
      '../fixtures/test-userConfig.json',
    );

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    this.cleanupMigrationFiles(legacyConfigPath);

    this.prepareMigrationFixture(legacyConfigPath, songsPath);
    await this.initializeMigrationDatabase(testDbPath, songsPath);

    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    const app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_MODE: 'true',
        TEST_DB_PATH: testDbPath,
        TEST_SONGS_PATH: songsPath,
        TEST_LEGACY_CONFIG_PATH: legacyConfigPath,
      },
      timeout: 30000,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    // Either the migration dialog took over the window, or the app booted
    // straight into the library — whichever happens first means we're ready.
    await page.waitForSelector(
      '[data-testid="migration-dialog"], [data-track-id]',
      {
        timeout: READY_TIMEOUT,
      },
    );

    const rootContent = await page.locator('#root').innerHTML();
    if (rootContent.length < 100) {
      throw new Error('Application did not render properly');
    }

    return { app, page };
  }

  /**
   * Check if a migration marker file exists
   */
  static isMigrationMarked(configPath: string): boolean {
    const migratedPath = `${configPath}.migrated`;
    return fs.existsSync(migratedPath);
  }
}
