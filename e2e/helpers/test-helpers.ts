/* eslint-disable import/prefer-default-export */
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';

export class TestHelpers {
  static async initializeTestDatabase(
    dbPath: string,
    testSongsPath: string,
  ): Promise<void> {
    const sqlFilePath = path.join(__dirname, '../fixtures/test-db.sql');
    let sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    // Replace placeholder with actual test songs path
    // This ensures file paths in the database point to actual test fixture files
    sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Execute the SQL file to create tables and insert test data
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

    // Replace placeholder with actual test songs path
    sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Execute the SQL file to create tables with empty tracks
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

    // Replace placeholder with actual test songs path (though not used in migration-db.sql)
    sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Execute the SQL file to create tables with empty libraryPath
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

  static async initializeLargeTestDatabase(
    dbPath: string,
    testSongsPath: string,
  ): Promise<void> {
    const sqlFilePath = path.join(__dirname, '../fixtures/test-db-large.sql');
    let sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    // Replace placeholder with actual test songs path for large library
    sqlContent = sqlContent.replace(
      /\{\{TEST_SONGS_LARGE_PATH\}\}/g,
      testSongsPath,
    );

    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Execute the SQL file to create tables and insert large test data
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
    const songsPath = path.join(__dirname, '../fixtures/test-songs');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the test database with seed data and proper file paths
    await this.initializeTestDatabase(testDbPath, songsPath);

    // Path to the built application
    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    // Check if the app is built
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    // Launch the built Electron application with TEST_MODE environment variables
    // These env vars ensure the app uses test fixtures instead of real user data
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

    // Wait for the first window
    const page = await app.firstWindow();

    // Wait for the app to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give React time to render

    // Verify the app has loaded by checking for root content
    const rootContent = await page.locator('#root').innerHTML();
    if (rootContent.length < 100) {
      throw new Error('Application did not render properly');
    }

    return { app, page };
  }

  static async launchAppWithLargeLibrary(): Promise<{
    app: ElectronApplication;
    page: Page;
  }> {
    const testDbPath = path.join(
      __dirname,
      '../fixtures/test-db-large.sqlite',
    );
    const songsPath = path.join(__dirname, '../fixtures/test-songs-large');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the large test database with 200 tracks
    await this.initializeLargeTestDatabase(testDbPath, songsPath);

    // Path to the built application
    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    // Check if the app is built
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    // Launch the built Electron application with TEST_MODE environment variables
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

    // Wait for the first window
    const page = await app.firstWindow();

    // Wait for the app to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Give more time for large library to render

    // Verify the app has loaded by checking for root content
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
    const songsPath = path.join(__dirname, '../fixtures/test-songs');

    // Clean test database for fresh start
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize the new user database with empty library
    await this.initializeNewUserDatabase(testDbPath, songsPath);

    // Path to the built application
    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    // Check if the app is built
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    // Launch the built Electron application with TEST_MODE environment variables
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

    // Wait for the first window
    const page = await app.firstWindow();

    // Wait for the app to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Give React time to render

    // Verify the app has loaded by checking for root content
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

  static async waitForLibraryLoad(page: Page): Promise<void> {
    // Wait for the library to load by checking that:
    // 1. The "Your library is empty" message is NOT visible (meaning we have tracks)
    // 2. OR a Material-UI table with rows exists
    try {
      // First wait a bit for the app to render
      await page.waitForTimeout(1000);

      // Check if library is NOT empty
      const emptyMessage = page.getByText('Your library is empty');
      const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

      if (isEmptyVisible) {
        throw new Error('Library is empty - no tracks loaded');
      }

      // If not empty, library should have loaded successfully
      console.log('Library loaded successfully - tracks present');
    } catch (error) {
      console.error('Error waiting for library to load:', error);
      throw error;
    }
  }

  static async importSongs(page: Page): Promise<void> {
    const songsPath = path.join(__dirname, '../fixtures/test-songs');

    // Use the correct API exposed by the preload script
    await page.evaluate(async (folderPath) => {
      // The preload script exposes the API as window.electron
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, songsPath);

    await page.waitForTimeout(3000); // Give time for songs to be imported
  }

  static async createPlaylist(page: Page, name: string): Promise<void> {
    await page.click('[data-testid="create-playlist-button"]');
    await page.fill('[data-testid="playlist-name-input"]', name);
    await page.click('[data-testid="save-playlist-button"]');
    await page.waitForTimeout(500);
  }

  static async selectSong(page: Page, songTitle: string): Promise<void> {
    await page.click(`[data-testid="song-row-${songTitle}"]`);
  }

  static async playSong(page: Page, songTitle: string): Promise<void> {
    await this.selectSong(page, songTitle);
    await page.dblclick(`[data-testid="song-row-${songTitle}"]`);
    await page.waitForTimeout(1000);
  }

  static async getPlayerState(page: Page): Promise<{
    isPlaying: boolean;
    currentSong: string | null;
    currentTime: number;
    duration: number;
  }> {
    return page.evaluate(() => {
      const player = document.querySelector('[data-testid="player"]');
      if (!player)
        return {
          isPlaying: false,
          currentSong: null,
          currentTime: 0,
          duration: 0,
        };

      const playButton = player.querySelector(
        '[data-testid="play-pause-button"]',
      );
      const isPlaying = playButton?.getAttribute('aria-label') === 'Pause';
      const songTitle =
        player.querySelector('[data-testid="now-playing-title"]')
          ?.textContent || null;
      const currentTime = parseFloat(
        player.querySelector('[data-testid="current-time"]')?.textContent ||
          '0',
      );
      const duration = parseFloat(
        player.querySelector('[data-testid="duration"]')?.textContent || '0',
      );

      return { isPlaying, currentSong: songTitle, currentTime, duration };
    });
  }

  static async searchLibrary(page: Page, query: string): Promise<void> {
    await page.fill('[data-testid="search-input"]', query);
    await page.waitForTimeout(500);
  }

  static async navigateToView(
    page: Page,
    view: 'library' | 'playlists' | 'settings',
  ): Promise<void> {
    await page.click(`[data-testid="nav-${view}"]`);
    await page.waitForTimeout(500);
  }

  static async toggleShuffle(page: Page): Promise<void> {
    await page.click('[data-testid="shuffle-button"]');
  }

  static async toggleRepeat(page: Page): Promise<void> {
    await page.click('[data-testid="repeat-button"]');
  }

  static async skipToNext(page: Page): Promise<void> {
    await page.click('[data-testid="next-button"]');
    await page.waitForTimeout(500);
  }

  static async skipToPrevious(page: Page): Promise<void> {
    await page.click('[data-testid="previous-button"]');
    await page.waitForTimeout(500);
  }

  static async setVolume(page: Page, volume: number): Promise<void> {
    const slider = await page.locator('[data-testid="volume-slider"]');
    await slider.fill(volume.toString());
  }

  static async addToPlaylist(
    page: Page,
    songTitle: string,
    playlistName: string,
  ): Promise<void> {
    await page.click(`[data-testid="song-row-${songTitle}"]`, {
      button: 'right',
    });
    await page.click('[data-testid="add-to-playlist-menu"]');
    await page.click(`[data-testid="playlist-option-${playlistName}"]`);
    await page.waitForTimeout(500);
  }

  static async likeSong(page: Page, songTitle: string): Promise<void> {
    await page.click(`[data-testid="like-button-${songTitle}"]`);
    await page.waitForTimeout(300);
  }

  static async getSongCount(page: Page): Promise<number> {
    const count = await page
      .locator('[data-testid="song-count"]')
      .textContent();
    return parseInt(count || '0', 10);
  }

  /**
   * Prepare a userConfig.json fixture for migration testing
   * This replaces the {{TEST_SONGS_PATH}} placeholder with the actual test songs path
   */
  static prepareMigrationFixture(
    fixtureConfigPath: string,
    testSongsPath: string,
  ): void {
    const templatePath = path.join(__dirname, '../fixtures/userConfig.json');
    let configContent = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholder with actual test songs path
    configContent = configContent.replace(
      /\{\{TEST_SONGS_PATH\}\}/g,
      testSongsPath,
    );

    // Write the prepared config to the fixture location
    fs.writeFileSync(fixtureConfigPath, configContent, 'utf-8');
  }

  /**
   * Clean up migration-related files
   * This removes both the userConfig.json and userConfig.json.migrated files
   */
  static cleanupMigrationFiles(configPath: string): void {
    // Remove the config file if it exists
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    // Remove the migrated marker if it exists
    const migratedPath = `${configPath}.migrated`;
    if (fs.existsSync(migratedPath)) {
      fs.unlinkSync(migratedPath);
    }
  }

  /**
   * Unmark a migration (rename .migrated back to .json)
   * This allows tests to re-run migration on the same fixture
   */
  static unmarkMigration(configPath: string): void {
    const migratedPath = `${configPath}.migrated`;
    if (fs.existsSync(migratedPath)) {
      fs.renameSync(migratedPath, configPath);
    }
  }

  /**
   * Launch the app with v1 to v2 migration mode enabled
   * This creates an empty database and provides a userConfig.json for migration
   */
  static async launchAppWithMigration(): Promise<{
    app: ElectronApplication;
    page: Page;
  }> {
    // Paths for testing
    const testDbPath = path.join(
      __dirname,
      '../fixtures/migration-test-db.sqlite',
    );
    const songsPath = path.join(__dirname, '../fixtures/test-songs');
    const legacyConfigPath = path.join(
      __dirname,
      '../fixtures/test-userConfig.json',
    );

    // Clean up any existing test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    this.cleanupMigrationFiles(legacyConfigPath);

    // Prepare the legacy userConfig.json with actual test paths
    this.prepareMigrationFixture(legacyConfigPath, songsPath);

    // Create an empty database with NO libraryPath (migration will populate it)
    await this.initializeMigrationDatabase(testDbPath, songsPath);

    // Path to the built application
    const appPath = path.join(__dirname, '../../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    // Check if the app is built
    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    // Launch the app with migration environment variables
    const app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_MODE: 'true',
        TEST_DB_PATH: testDbPath,
        TEST_SONGS_PATH: songsPath,
        TEST_LEGACY_CONFIG_PATH: legacyConfigPath, // Tell migration where to find v1 config
      },
      timeout: 30000,
    });

    // Wait for the first window
    const page = await app.firstWindow();

    // Wait for the app to fully load initially
    await page.waitForLoadState('domcontentloaded');

    // Give React time to render - migration dialog will appear automatically
    await page.waitForTimeout(2000);

    // Verify the app has loaded by checking for root content
    const rootContent = await page.locator('#root').innerHTML();
    if (rootContent.length < 100) {
      throw new Error('Application did not render properly');
    }

    // Note: The migration dialog should now be visible
    // Tests are responsible for waiting for it and clicking Continue
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
