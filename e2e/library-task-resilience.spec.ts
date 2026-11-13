import { test, expect, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Defined behavior when the app is quit, force quit or crashes while a
 * library task runs, and when the database on disk is damaged. In every
 * case the library that comes back must be consistent, nothing is
 * silently lost, and the user is told what happened and how to finish.
 */

const DB_PATH = path.join(__dirname, 'fixtures/resilience-db.sqlite');
const SLOW_BATCH_MS = 2500;
const INITIAL_SONGS = 10;
const ADDED_SONGS = 8;

const panel = (page: Page) => page.getByTestId('library-task-panel');

/** Tracks written to the database file, whatever the UI is showing. */
const dbTrackCount = () => TestHelpers.countTracksOnDisk(DB_PATH);

/** Launch on the shared DB (seeded when `seedLibraryPath` is given). */
async function launch(seedLibraryPath?: string) {
  return TestHelpers.launchWithDatabase({ dbPath: DB_PATH, seedLibraryPath });
}

/**
 * Seed a library of INITIAL_SONGS, then drop ADDED_SONGS more into the
 * folder and start a slow rescan. Resolves once the rescan has written
 * some (not all) of the new songs.
 */
async function startSlowRescanMidway(): Promise<{
  app: ElectronApplication;
  page: Page;
  libraryDir: string;
}> {
  const libraryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-resil-'));
  TestHelpers.copyFixtureSongs(libraryDir, INITIAL_SONGS);
  const { app, page } = await launch(libraryDir);
  await page.getByTestId('welcome-scan').click();
  await TestHelpers.waitForTrackCount(page, INITIAL_SONGS, 30000);

  TestHelpers.copyFixtureSongs(libraryDir, ADDED_SONGS, INITIAL_SONGS);
  await TestHelpers.setScanBatchDelay(app, SLOW_BATCH_MS);
  // Not awaited: the scan is meant to be cut short.
  page
    .evaluate((dir) => (window as any).electron.library.scan(dir), libraryDir)
    .catch(() => undefined);
  await expect(panel(page)).toHaveAttribute('data-phase', 'running');
  await expect
    .poll(dbTrackCount, { timeout: 30000 })
    .toBeGreaterThan(INITIAL_SONGS);
  return { app, page, libraryDir };
}

/** Relaunch on the same database and wait for the library rows. */
async function relaunch() {
  const { app, page } = await launch();
  await TestHelpers.waitForTracks(page, 30000);
  return { app, page };
}

test.describe('Library task resilience', () => {
  test.afterEach(() => {
    // Leave no database, backup, marker or temp files for the next spec.
    fs.readdirSync(path.dirname(DB_PATH))
      .filter(
        (name) =>
          name.startsWith(path.basename(DB_PATH)) ||
          name === 'library-task.json',
      )
      .forEach((name) =>
        fs.rmSync(path.join(path.dirname(DB_PATH), name), { force: true }),
      );
  });

  test('force quit mid-rescan: library intact, interrupted rescan offered and finishes', async () => {
    const { app, libraryDir } = await startSlowRescanMidway();

    // SIGKILL: no quit handlers run at all.
    app.process().kill('SIGKILL');
    await app.waitForEvent('close');
    expect(fs.existsSync(`${DB_PATH}.tmp`)).toBe(false);

    // Partway: some new songs were written, not all of them.
    const countAtKill = await dbTrackCount();
    expect(countAtKill).toBeGreaterThan(INITIAL_SONGS);
    expect(countAtKill).toBeLessThan(INITIAL_SONGS + ADDED_SONGS);

    const next = await relaunch();
    try {
      // Every song written before the kill survived, with whole files.
      await TestHelpers.waitForTrackCount(next.page, countAtKill);
      await expect(panel(next.page)).toHaveAttribute(
        'data-phase',
        'interrupted',
      );
      await expect(next.page.getByTestId('library-task-title')).toHaveText(
        "Last rescan didn't finish",
      );
      await TestHelpers.settleAnimations(next.page);
      await TestHelpers.takeScreenshot(next.page, 'resilience-interrupted');

      await next.page.getByTestId('library-task-retry').click();
      await TestHelpers.waitForTrackCount(
        next.page,
        INITIAL_SONGS + ADDED_SONGS,
        30000,
      );
      await expect(panel(next.page)).toHaveCount(0, { timeout: 10000 });
      // A finished rescan clears the marker: nothing to offer next time.
      expect(
        fs.existsSync(path.join(path.dirname(DB_PATH), 'library-task.json')),
      ).toBe(false);
    } finally {
      await TestHelpers.closeApp(next.app);
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });

  test('quit mid-rescan asks first; Keep Running continues, Quit keeps what was found', async () => {
    const { app, page, libraryDir } = await startSlowRescanMidway();

    await TestHelpers.stubQuitPrompt(app, 'keepRunning');
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await expect
      .poll(() => TestHelpers.quitPromptCalls(app))
      .toEqual(['Your library is still being rescanned.']);
    // Still running and still usable.
    await expect(panel(page)).toHaveAttribute('data-phase', 'running');

    await TestHelpers.stubQuitPrompt(app, 'quit');
    const closed = app.waitForEvent('close');
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await closed;

    const next = await relaunch();
    try {
      const kept = await dbTrackCount();
      expect(kept).toBeGreaterThan(INITIAL_SONGS);
      await TestHelpers.waitForTrackCount(next.page, kept);
      await expect(panel(next.page)).toHaveAttribute(
        'data-phase',
        'interrupted',
      );
    } finally {
      await TestHelpers.closeApp(next.app);
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });

  test('reloading the window mid-rescan picks the task back up', async () => {
    const { app, page, libraryDir } = await startSlowRescanMidway();

    try {
      await page.reload();
      await TestHelpers.waitForTracks(page, 30000);
      // The rehydrated panel shows the running task, and the library
      // still holds back the half-finished results.
      await expect(panel(page)).toHaveAttribute('data-phase', 'running');
      await TestHelpers.waitForTrackCount(page, INITIAL_SONGS);

      await TestHelpers.setScanBatchDelay(app, 0);
      await TestHelpers.waitForTrackCount(
        page,
        INITIAL_SONGS + ADDED_SONGS,
        30000,
      );
    } finally {
      await TestHelpers.closeApp(app);
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });

  test('a corrupted database is recovered from the last-known-good copy', async () => {
    const libraryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-corrupt-'));
    TestHelpers.copyFixtureSongs(libraryDir, INITIAL_SONGS);
    const first = await launch(libraryDir);
    await first.page.getByTestId('welcome-scan').click();
    await TestHelpers.waitForTrackCount(first.page, INITIAL_SONGS, 30000);
    await TestHelpers.closeApp(first.app);

    // Relaunch once so the backup taken at launch includes the library.
    const second = await relaunch();
    await TestHelpers.closeApp(second.app);

    // Simulate a write cut off mid-file: keep the header, lose the rest.
    const bytes = fs.readFileSync(DB_PATH);
    fs.writeFileSync(DB_PATH, bytes.subarray(0, Math.floor(bytes.length / 3)));

    const next = await relaunch();
    try {
      await TestHelpers.waitForTrackCount(next.page, INITIAL_SONGS);
      const notifications = await next.page.evaluate(() =>
        (window as any).HIHAT_E2E_UI_STORE.getState().notifications.map(
          (n: { message: string }) => n.message,
        ),
      );
      expect(notifications.join('\n')).toMatch(/restored the copy saved/);
      const corrupt = fs
        .readdirSync(path.dirname(DB_PATH))
        .filter((name) =>
          name.startsWith(`${path.basename(DB_PATH)}.corrupt-`),
        );
      expect(corrupt).toHaveLength(1);
    } finally {
      await TestHelpers.closeApp(next.app);
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });

  test('partial copies left by an interrupted import are never imported', async () => {
    const libraryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hihat-partial-'));
    const [name] = TestHelpers.copyFixtureSongs(libraryDir, 1);
    const partial = path.join(libraryDir, `Half Copied.mp3.hihat-partial`);
    fs.copyFileSync(path.join(libraryDir, name), partial);

    const { app, page } = await launch(libraryDir);
    try {
      await page.getByTestId('welcome-scan').click();
      await TestHelpers.waitForTrackCount(page, 1, 30000);
      expect(fs.existsSync(partial)).toBe(false);
    } finally {
      await TestHelpers.closeApp(app);
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });
});
