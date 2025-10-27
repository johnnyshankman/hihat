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
    await page.waitForTimeout(2000); // Give React time to render

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
    await page.waitForSelector('[data-testid="library-table"]', {
      state: 'visible',
      timeout: 30000,
    });
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
}
