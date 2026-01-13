/* eslint-disable import/prefer-default-export */
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';

// All tests use the consolidated test library (200 tracks)
const TEST_SONGS_DIR = 'test-songs-large';
const TEST_DB_SQL = 'test-db.sql';

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
    await page.waitForTimeout(3000); // Give time for library to render

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
    await page.waitForTimeout(1000);

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
    try {
      await page.waitForTimeout(1000);

      const emptyMessage = page.getByText('Your library is empty');
      const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);

      if (isEmptyVisible) {
        throw new Error('Library is empty - no tracks loaded');
      }

      console.log('Library loaded successfully - tracks present');
    } catch (error) {
      console.error('Error waiting for library to load:', error);
      throw error;
    }
  }

  static async importSongs(page: Page): Promise<void> {
    const songsPath = path.join(__dirname, `../fixtures/${TEST_SONGS_DIR}`);

    await page.evaluate(async (folderPath) => {
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, songsPath);

    await page.waitForTimeout(3000);
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
    await page.waitForTimeout(2000);

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
