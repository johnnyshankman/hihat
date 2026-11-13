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

/**
 * Remove a test database and the files the app keeps beside it (atomic
 * write temp file, last-known-good backup, moved-aside corrupt copies,
 * interrupted-task marker), so one spec's leftovers can't leak into the
 * next launch.
 */
function removeDatabaseAndSidecars(dbPath: string): void {
  const dir = path.dirname(dbPath);
  const base = path.basename(dbPath);
  fs.readdirSync(dir)
    .filter(
      (name) =>
        name === base ||
        name.startsWith(`${base}.`) ||
        name === 'library-task.json',
    )
    .forEach((name) => fs.rmSync(path.join(dir, name), { force: true }));
}

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

  static async launchApp(
    options: {
      /** Extra env vars for the main process (e.g. TEST_TRACKS_LOAD_DELAY_MS). */
      env?: Record<string, string>;
      /**
       * Wait for track rows before resolving. Pass false to observe the
       * renderer while the library is still loading.
       */
      waitForReady?: boolean;
    } = {},
  ): Promise<{ app: ElectronApplication; page: Page }> {
    const { env: extraEnv = {}, waitForReady = true } = options;
    const testDbPath = path.join(__dirname, '../fixtures/test-db.sqlite');
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);

    // Clean test database for fresh start
    removeDatabaseAndSidecars(testDbPath);

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
        ...extraEnv,
      },
      timeout: 30000,
    });

    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    if (!waitForReady) return { app, page };
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

  static async launchAppAsBrandNewUser(
    options: {
      /**
       * Seed the settings row with the test songs folder as libraryPath
       * (default). Pass false for a true first launch where the user has
       * never chosen a music folder.
       */
      withLibraryPath?: boolean;
    } = {},
  ): Promise<{
    app: ElectronApplication;
    page: Page;
  }> {
    const { withLibraryPath = true } = options;
    const testDbPath = path.join(__dirname, '../fixtures/new-user-db.sqlite');
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);

    removeDatabaseAndSidecars(testDbPath);

    await this.initializeNewUserDatabase(
      testDbPath,
      withLibraryPath ? songsPath : '',
    );

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
    // A brand new user has no tracks, so the welcome panel is the readiness
    // signal. Library only renders it once the tracks query has settled, so
    // seeing it means the renderer is fully booted.
    await page.waitForSelector('[data-testid="library-welcome"]', {
      timeout: READY_TIMEOUT,
    });

    const rootContent = await page.locator('#root').innerHTML();
    if (rootContent.length < 100) {
      throw new Error('Application did not render properly');
    }

    return { app, page };
  }

  /**
   * Launch against `dbPath`. With `seedLibraryPath` the database is
   * recreated as a brand-new user whose music folder is that path;
   * without it the existing database and its sidecar files are reused,
   * as on a relaunch after a quit or crash. Resolves once the DOM is
   * loaded; callers wait for their own readiness signal.
   */
  static async launchWithDatabase(options: {
    dbPath: string;
    seedLibraryPath?: string;
    env?: Record<string, string>;
  }): Promise<{ app: ElectronApplication; page: Page }> {
    const { dbPath, seedLibraryPath, env: extraEnv = {} } = options;
    if (seedLibraryPath !== undefined) {
      removeDatabaseAndSidecars(dbPath);
      await this.initializeNewUserDatabase(dbPath, seedLibraryPath);
    }

    const appPath = path.join(__dirname, '../../release/app');
    if (!fs.existsSync(path.join(appPath, 'dist/main/main.js'))) {
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
        TEST_DB_PATH: dbPath,
        ...extraEnv,
      },
      timeout: 30000,
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    return { app, page };
  }

  /**
   * Copy `count` fixture songs (starting at `offset`, in file name order)
   * into `dir`, creating it if needed. Returns the copied file names.
   */
  static copyFixtureSongs(dir: string, count: number, offset = 0): string[] {
    fs.mkdirSync(dir, { recursive: true });
    const source = this.testSongsPath();
    const names = fs
      .readdirSync(source)
      .filter((name) => name.endsWith('.mp3'))
      .sort()
      .slice(offset, offset + count);
    names.forEach((name) =>
      fs.copyFileSync(path.join(source, name), path.join(dir, name)),
    );
    return names;
  }

  /**
   * Tracks persisted in the database file on disk. Unlike
   * `tracks.getAll()`, which serves the pre-task snapshot while a scan
   * runs, this sees what has actually been written.
   */
  static async countTracksOnDisk(dbPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(err);
          return;
        }
        db.get('SELECT COUNT(*) AS n FROM tracks', (queryErr, row) => {
          db.close();
          if (queryErr) reject(queryErr);
          else resolve((row as { n: number }).n);
        });
      });
    });
  }

  /** Slow every scan/import batch from now on (0 restores full speed). */
  static async setScanBatchDelay(
    app: ElectronApplication,
    delayMs: number,
  ): Promise<void> {
    await app.evaluate((_electron, ms) => {
      process.env.TEST_SCAN_BATCH_DELAY_MS = String(ms);
    }, delayMs);
  }

  static async closeApp(app: ElectronApplication): Promise<void> {
    // Quitting while a library task runs asks for confirmation; answer
    // "Quit" so a spec that ends mid-scan can't hang on the prompt.
    await this.stubQuitPrompt(app, 'quit').catch(() => undefined);
    await app.close();
  }

  /**
   * Answer the "a library task is still running" quit prompt without UI.
   * Records each prompt shown; read them back with `quitPromptCalls`.
   */
  static async stubQuitPrompt(
    app: ElectronApplication,
    answer: 'quit' | 'keepRunning',
  ): Promise<void> {
    await app.evaluate(
      ({ dialog }, response) => {
        const g = dialog as unknown as { quitPromptCalls: string[] };
        g.quitPromptCalls = g.quitPromptCalls ?? [];
        // eslint-disable-next-line no-param-reassign
        dialog.showMessageBox = (async (...args: unknown[]) => {
          const options = args[args.length - 1] as { message?: string };
          g.quitPromptCalls.push(options.message ?? '');
          return { response, checkboxChecked: false };
        }) as unknown as typeof dialog.showMessageBox;
      },
      answer === 'quit' ? 1 : 0,
    );
  }

  /** Messages of the quit prompts shown since `stubQuitPrompt`. */
  static async quitPromptCalls(app: ElectronApplication): Promise<string[]> {
    return app.evaluate(
      ({ dialog }) =>
        (dialog as unknown as { quitPromptCalls?: string[] }).quitPromptCalls ??
        [],
    );
  }

  /** Resolve once every finite CSS animation and transition has finished. */
  static async settleAnimations(page: Page): Promise<void> {
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
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

  /**
   * Replace the native open dialog in the main process so it resolves
   * without UI: to `filePaths`, or as canceled when `filePaths` is null.
   * Each call is recorded; read them back with `openDialogCalls`.
   */
  static async stubOpenDialog(
    app: ElectronApplication,
    filePaths: string[] | null,
  ): Promise<void> {
    await app.evaluate(({ dialog }, selected) => {
      // Recorded on the dialog module itself so no globals are needed.
      const g = dialog as unknown as {
        openDialogCalls: { hasParentWindow: boolean }[];
      };
      g.openDialogCalls = [];
      // eslint-disable-next-line no-param-reassign
      dialog.showOpenDialog = (async (...args: unknown[]) => {
        // showOpenDialog(window, options) vs showOpenDialog(options)
        g.openDialogCalls.push({ hasParentWindow: args.length === 2 });
        return selected
          ? { canceled: false, filePaths: selected }
          : { canceled: true, filePaths: [] };
      }) as unknown as typeof dialog.showOpenDialog;
    }, filePaths);
  }

  /** Calls recorded by `stubOpenDialog` since it was installed. */
  static async openDialogCalls(
    app: ElectronApplication,
  ): Promise<{ hasParentWindow: boolean }[]> {
    return app.evaluate(
      ({ dialog }) =>
        (
          dialog as unknown as {
            openDialogCalls: { hasParentWindow: boolean }[];
          }
        ).openDialogCalls,
    );
  }

  /** Make the next native "choose folder" dialog resolve to `folderPath`. */
  static async stubDirectoryDialog(
    app: ElectronApplication,
    folderPath: string,
  ): Promise<void> {
    await this.stubOpenDialog(app, [folderPath]);
  }

  /** Absolute path to the fixture music folder used by every spec. */
  static testSongsPath(): string {
    return path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);
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

    removeDatabaseAndSidecars(testDbPath);
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
