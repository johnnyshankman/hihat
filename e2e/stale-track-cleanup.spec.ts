import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { TestHelpers } from './helpers/test-helpers';

const SOURCE_SONGS = [
  '001 - Aurora Synth - Dream of Love.mp3',
  '021 - Aurora Synth - The Night.mp3',
  '041 - Aurora Synth - The Day.mp3',
];

let tempDir: string;
let app: ElectronApplication;
let page: Page;

test.describe('Stale Track Cleanup on Rescan', () => {
  test.beforeAll(async () => {
    // Create a temp directory with 3 test songs
    tempDir = path.join(os.tmpdir(), `hihat-stale-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const sourceSongsDir = path.join(__dirname, 'fixtures/test-songs-large');

    // Copy each source song to the temp directory
    SOURCE_SONGS.forEach((songFile) => {
      const sourcePath = path.join(sourceSongsDir, songFile);
      const destPath = path.join(tempDir, songFile);
      fs.copyFileSync(sourcePath, destPath);
    });

    // Verify we have the expected number of files on disk
    const filesOnDisk = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith('.mp3'));
    // eslint-disable-next-line no-console
    console.log(`Created ${filesOnDisk.length} files in temp dir: ${tempDir}`);

    // Launch app with empty database pointing to the temp dir
    const testDbPath = path.join(__dirname, 'fixtures/stale-test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    await TestHelpers.initializeNewUserDatabase(testDbPath, tempDir);

    const appPath = path.join(__dirname, '../release/app');
    const mainJsPath = path.join(appPath, 'dist/main/main.js');

    if (!fs.existsSync(mainJsPath)) {
      throw new Error(
        'Application not built. Please run "npm run build" first.',
      );
    }

    app = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        TEST_MODE: 'true',
        TEST_DB_PATH: testDbPath,
        TEST_SONGS_PATH: tempDir,
      },
      timeout: 30000,
    });

    page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test.afterAll(async () => {
    if (app) {
      await TestHelpers.closeApp(app);
    }

    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Clean up test database
    const testDbPath = path.join(__dirname, 'fixtures/stale-test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should import all 3 songs on initial scan', async () => {
    // Trigger a library scan of the temp directory
    await page.evaluate(async (folderPath) => {
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, tempDir);

    // Wait for the UI to reflect 3 tracks (auto-retries up to timeout)
    await expect(page.locator('[data-track-id]')).toHaveCount(
      SOURCE_SONGS.length,
      { timeout: 10000 },
    );
  });

  test('should remove stale track from library and playlist on rescan', async () => {
    // Get all track IDs and create a playlist containing all of them via IPC
    const playlistId: string = await page.evaluate(async () => {
      const tracks = await (window as any).electron.tracks.getAll();
      const trackIds = tracks.map((t: any) => t.id);
      const playlist = await (window as any).electron.playlists.create({
        name: 'Stale Test Playlist',
        trackIds,
        isSmart: false,
        smartPlaylistId: null,
        ruleSet: null,
        sortPreference: null,
      });
      return playlist.id;
    });
    expect(playlistId).toBeTruthy();

    // Delete one of the song files from disk
    const fileToDelete = path.join(tempDir, SOURCE_SONGS[0]);
    fs.unlinkSync(fileToDelete);
    expect(fs.existsSync(fileToDelete)).toBe(false);

    // Trigger a rescan — the scanComplete handler reloads both the library
    // and playlists, so the sidebar will pick up our new playlist too
    await page.evaluate(async (folderPath) => {
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, tempDir);

    // Wait for the library view to reflect 2 tracks
    await expect(page.locator('[data-track-id]')).toHaveCount(
      SOURCE_SONGS.length - 1,
      { timeout: 10000 },
    );

    // Navigate to the playlist in the sidebar and verify stale track removed
    await page.locator(`[data-playlist-id="${playlistId}"]`).click();
    await expect(page.locator('[data-track-id]')).toHaveCount(
      SOURCE_SONGS.length - 1,
      { timeout: 10000 },
    );
  });
});
