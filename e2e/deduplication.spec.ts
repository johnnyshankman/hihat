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
const DUPES_PER_SONG = 3;

let tempDir: string;
let app: ElectronApplication;
let page: Page;

test.describe('Deduplication on Fresh Scan', () => {
  test.beforeAll(async () => {
    // Create a temp directory with duplicate files
    tempDir = path.join(os.tmpdir(), `hihat-dedup-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const sourceSongsDir = path.join(__dirname, 'fixtures/test-songs-large');

    // Copy each source song and create duplicates
    SOURCE_SONGS.forEach((songFile) => {
      const sourcePath = path.join(sourceSongsDir, songFile);
      const destPath = path.join(tempDir, songFile);
      fs.copyFileSync(sourcePath, destPath);

      // Create duplicate copies with different filenames
      const ext = path.extname(songFile);
      const base = path.basename(songFile, ext);
      for (let i = 1; i <= DUPES_PER_SONG; i += 1) {
        const dupePath = path.join(tempDir, `${base}-dupe${i}${ext}`);
        fs.copyFileSync(sourcePath, dupePath);
      }
    });

    // Verify we have the expected number of files on disk
    const filesOnDisk = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith('.mp3'));
    // eslint-disable-next-line no-console
    console.log(`Created ${filesOnDisk.length} files in temp dir: ${tempDir}`);

    // Launch app with empty database pointing to the temp dir
    const testDbPath = path.join(__dirname, 'fixtures/dedup-test-db.sqlite');
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
    const testDbPath = path.join(__dirname, 'fixtures/dedup-test-db.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should deduplicate files with same metadata on fresh scan', async () => {
    // Trigger a library scan of the temp directory
    await page.evaluate(async (folderPath) => {
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, tempDir);

    // Wait for scan to complete
    await page.waitForTimeout(5000);

    // Count track rows in the library
    const trackCount = await page.locator('[data-track-id]').count();

    // Should have exactly 3 unique tracks, not 12
    expect(trackCount).toBe(SOURCE_SONGS.length);
  });

  test('should keep same track count when rescanning library with duplicates', async () => {
    // Trigger a second scan
    await page.evaluate(async (folderPath) => {
      if ((window as any).electron && (window as any).electron.library) {
        return (window as any).electron.library.scan(folderPath);
      }
      throw new Error('Electron API not available');
    }, tempDir);

    // Wait for rescan to complete
    await page.waitForTimeout(5000);

    // Count should still be exactly 3
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBe(SOURCE_SONGS.length);
  });
});
