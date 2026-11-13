import { test, expect, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Issue #190: rescans, imports and backups run in the background. The
 * app stays usable, progress shows in a panel above the player, the
 * visible library changes once when the task finishes, and playback is
 * reconciled with the new library.
 */

// Long enough per batch that a spec can act mid-scan on any machine.
const SLOW_BATCH_MS = 2500;
const INITIAL_SONGS = 12;

interface PlayerState {
  storeCurrentTrackFilePath: string | null;
  storePreloadedTrackFilePath: string | null;
  storePreloadReady: boolean;
}

async function readPlayerState(page: Page): Promise<PlayerState> {
  return page.evaluate(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
      (window as any).__hihat_e2e_getPlayerState() as PlayerState,
  );
}

const DB_PATH = path.join(__dirname, 'fixtures/background-tasks-db.sqlite');

/** Tracks written to the database file, whatever the UI is showing. */
const dbTrackCount = () => TestHelpers.countTracksOnDisk(DB_PATH);

async function settings(page: Page) {
  return page.evaluate(() => (window as any).electron.settings.get());
}

/** Track ids in table order, as currently rendered. */
async function visibleTrackIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-track-id]')
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-track-id') ?? ''),
    );
}

async function filePathOf(page: Page, trackId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const tracks = await (window as any).electron.tracks.getAll();
    return tracks.find((t: { id: string }) => t.id === id).filePath;
  }, trackId);
}

const panel = (page: Page) => page.getByTestId('library-task-panel');

/**
 * A brand-new user whose music folder is a temp copy of some fixture
 * songs, scanned once at full speed so each spec starts with a library.
 */
async function launchWithTempLibrary(): Promise<{
  app: ElectronApplication;
  page: Page;
  libraryDir: string;
}> {
  const libraryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-bg-'));
  TestHelpers.copyFixtureSongs(libraryDir, INITIAL_SONGS);
  const { app, page } = await TestHelpers.launchWithDatabase({
    dbPath: DB_PATH,
    seedLibraryPath: libraryDir,
  });
  await page.getByTestId('welcome-scan').click();
  await TestHelpers.waitForTrackCount(page, INITIAL_SONGS, 30000);
  // The first scan's "done" state isn't shown in the panel (the welcome
  // screen covered it), so nothing should be on screen now.
  await expect(panel(page)).toHaveCount(0);
  return { app, page, libraryDir };
}

async function cleanup(app: ElectronApplication, ...dirs: string[]) {
  await TestHelpers.closeApp(app);
  dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
}

test.describe('Background library tasks', () => {
  test('rescan runs in the background and the library updates once at the end', async () => {
    const { app, page, libraryDir } = await launchWithTempLibrary();

    try {
      TestHelpers.copyFixtureSongs(libraryDir, 6, INITIAL_SONGS);
      await TestHelpers.setScanBatchDelay(app, SLOW_BATCH_MS);

      await TestHelpers.navigateToView(page, 'settings');
      await page.getByRole('button', { name: 'Rescan Library' }).click();

      // No modal: the panel reports progress and the drawer stays usable.
      await expect(panel(page)).toHaveAttribute('data-phase', 'running');
      await expect(page.getByTestId('library-task-title')).toHaveText(
        'Rescanning library…',
      );
      await expect(page.locator('.MuiDialog-root')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Scanning…' }),
      ).toBeDisabled();
      await TestHelpers.settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'bg-tasks-settings-open');

      // Close the drawer and use the app while the scan writes rows.
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('settings-view')).toHaveCount(0);
      await expect
        .poll(dbTrackCount, { timeout: 30000 })
        .toBeGreaterThan(INITIAL_SONGS);
      await expect(panel(page)).toHaveAttribute('data-phase', 'running');
      // The database already has new songs, but the table hasn't moved,
      // and neither does a fresh read of the library.
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS);
      expect(
        await page.evaluate(
          async () => (await (window as any).electron.tracks.getAll()).length,
        ),
      ).toBe(INITIAL_SONGS);

      const rows = page.locator('[data-track-id]');
      await TestHelpers.startPlayback(page, rows.nth(2));
      await page.locator('[data-playlist-id]').first().click();
      await TestHelpers.navigateToView(page, 'library');
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS);
      await expect(panel(page)).toHaveAttribute('data-phase', 'running');
      await expect(page.getByTestId('library-task-progress')).toBeVisible();
      await TestHelpers.settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'bg-tasks-panel-running');

      // Minimize to a pill, then expand again.
      await page.getByTestId('library-task-minimize').click();
      await expect(page.getByTestId('library-task-expand')).toBeVisible();
      await TestHelpers.settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'bg-tasks-panel-minimized');
      await page.getByTestId('library-task-expand').click();
      await expect(page.getByTestId('library-task-title')).toBeVisible();

      // Finish: one batch update, a done state, then the panel leaves.
      await TestHelpers.setScanBatchDelay(app, 0);
      await expect(panel(page)).toHaveAttribute('data-phase', 'done', {
        timeout: 30000,
      });
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS + 6);
      await expect(page.getByTestId('library-task-title')).toHaveText(
        'Rescan complete',
      );
      await expect(panel(page)).toContainText('6 songs added.');
      await TestHelpers.settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'bg-tasks-panel-done');
      await expect(panel(page)).toHaveCount(0, { timeout: 10000 });

      // Playback carried on through the whole scan.
      await TestHelpers.waitForPlaying(page);
    } finally {
      await cleanup(app, libraryDir);
    }
  });

  test('only one task at a time: other tasks, music folder and reset are locked', async () => {
    const { app, page, libraryDir } = await launchWithTempLibrary();

    try {
      TestHelpers.copyFixtureSongs(libraryDir, 4, INITIAL_SONGS);
      await TestHelpers.setScanBatchDelay(app, SLOW_BATCH_MS);
      await TestHelpers.navigateToView(page, 'settings');
      await page.getByRole('button', { name: 'Rescan Library' }).click();
      await expect(panel(page)).toHaveAttribute('data-phase', 'running');

      await expect(
        page.getByRole('button', { name: 'Add Songs' }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Backup Library' }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Reset Database' }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Choose music folder' }),
      ).toBeDisabled();
      await expect(page.getByTestId('settings-task-locked').first()).toHaveText(
        'Available when the current rescan finishes.',
      );
      await TestHelpers.settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'bg-tasks-settings-locked');

      // The main process enforces the same rules if the UI is bypassed.
      const second = await page.evaluate(
        (dir) => (window as any).electron.library.scan(dir),
        libraryDir,
      );
      expect(second.success).toBe(false);
      expect(second.message).toMatch(/Another library task is running/);
      const reset = await page.evaluate(() =>
        (window as any).electron.library.resetTracks(),
      );
      expect(reset.success).toBe(false);
      const moveFolder = await page.evaluate(() =>
        (window as any).electron.settings
          .update({ libraryPath: '/tmp' })
          .then(() => 'updated')
          .catch(() => 'rejected'),
      );
      expect(moveFolder).toBe('rejected');
      expect((await settings(page)).libraryPath).toBe(libraryDir);

      await TestHelpers.setScanBatchDelay(app, 0);
      await expect(panel(page)).toHaveAttribute('data-phase', 'done', {
        timeout: 30000,
      });
      await expect(
        page.getByRole('button', { name: 'Add Songs' }),
      ).toBeEnabled();
      await expect(page.getByTestId('settings-task-locked')).toHaveCount(0);
    } finally {
      await cleanup(app, libraryDir);
    }
  });

  test('import shows progress in the panel and reports once', async () => {
    const { app, page, libraryDir } = await launchWithTempLibrary();
    const importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-import-'));

    try {
      TestHelpers.copyFixtureSongs(importDir, 3, 100);
      await TestHelpers.stubOpenDialog(app, [importDir]);
      await TestHelpers.setScanBatchDelay(app, SLOW_BATCH_MS);

      await TestHelpers.navigateToView(page, 'settings');
      await page.getByRole('button', { name: 'Add Songs' }).click();
      await expect(page.getByTestId('library-task-title')).toHaveText(
        'Importing songs…',
      );
      await expect(
        page.getByRole('button', { name: 'Importing…' }),
      ).toBeDisabled();

      await TestHelpers.setScanBatchDelay(app, 0);
      await expect(panel(page)).toHaveAttribute('data-phase', 'done', {
        timeout: 30000,
      });
      await expect(panel(page)).toContainText('Added 3 songs.');
      await page.keyboard.press('Escape');
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS + 3);

      const importToasts = await page.evaluate(
        () =>
          (window as any).HIHAT_E2E_UI_STORE.getState().notifications.filter(
            (n: { message: string }) => /Import/.test(n.message),
          ).length,
      );
      expect(importToasts).toBe(1);
    } finally {
      await cleanup(app, libraryDir, importDir);
    }
  });

  test('backup shows progress in the panel and copies the library', async () => {
    const { app, page, libraryDir } = await launchWithTempLibrary();
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-backup-'));

    try {
      await TestHelpers.stubOpenDialog(app, [backupDir]);
      await TestHelpers.navigateToView(page, 'settings');
      await page.getByRole('button', { name: 'Backup Library' }).click();

      await expect(panel(page)).toHaveAttribute('data-phase', 'done', {
        timeout: 30000,
      });
      await expect(page.getByTestId('library-task-title')).toHaveText(
        'Backup complete',
      );
      expect(
        fs.readdirSync(backupDir).filter((f) => f.endsWith('.mp3')),
      ).toHaveLength(INITIAL_SONGS);
      await expect(panel(page)).toHaveCount(0, { timeout: 10000 });
    } finally {
      await cleanup(app, libraryDir, backupDir);
    }
  });

  test('a playing song removed by a rescan stops playback', async () => {
    const { app, page, libraryDir } = await launchWithTempLibrary();

    try {
      const row = page.locator('[data-track-id]').nth(3);
      const trackId = (await row.getAttribute('data-track-id')) as string;
      await TestHelpers.startPlayback(page, row);
      // Keep the file name before deleting it from disk.
      fs.unlinkSync(await filePathOf(page, trackId));

      await page.evaluate(
        (dir) => (window as any).electron.library.scan(dir),
        libraryDir,
      );

      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS - 1);
      await expect(page.getByTestId('now-playing-title')).toHaveCount(0);
      await TestHelpers.waitForPaused(page);
      await expect(page.getByTestId('skip-next-button')).toBeDisabled();
      expect(
        (await readPlayerState(page)).storeCurrentTrackFilePath,
      ).toBeNull();
      expect((await settings(page)).lastPlayedSongId).toBeNull();
      await TestHelpers.settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'bg-tasks-playing-song-removed');
    } finally {
      await cleanup(app, libraryDir);
    }
  });

  test('songs added right after the playing one become next up', async () => {
    const { app, page, libraryDir } = await launchWithTempLibrary();

    try {
      // Learn which song sorts right after the one we'll play, then take
      // it out of the library so it can come back mid-playback.
      const order = await visibleTrackIds(page);
      const currentId = order[4];
      const returningPath = await filePathOf(page, order[5]);
      const parked = `${returningPath}.parked`;
      fs.renameSync(returningPath, parked);
      await page.evaluate(
        (dir) => (window as any).electron.library.scan(dir),
        libraryDir,
      );
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS - 1);

      await TestHelpers.startPlayback(
        page,
        page.locator(`[data-track-id="${currentId}"]`),
      );
      await expect
        .poll(
          async () => (await readPlayerState(page)).storePreloadedTrackFilePath,
        )
        .not.toBe(returningPath);

      // The song returns while the current one plays.
      fs.renameSync(parked, returningPath);
      await page.evaluate(
        (dir) => (window as any).electron.library.scan(dir),
        libraryDir,
      );
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS);

      await expect
        .poll(
          async () => (await readPlayerState(page)).storePreloadedTrackFilePath,
        )
        .toBe(returningPath);
      await TestHelpers.waitForPlaying(page);

      // Next plays the returned song.
      await page.getByTestId('skip-next-button').click();
      await expect
        .poll(
          async () => (await readPlayerState(page)).storeCurrentTrackFilePath,
        )
        .toBe(returningPath);
    } finally {
      await cleanup(app, libraryDir);
    }
  });
});
