import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

// Long enough to observe the loading state reliably on a slow CI box.
const SLOW_LOAD_MS = '2500';

/**
 * Sample the track table once per animation frame until it has been on
 * screen for `frames` frames. Returns per-frame opacity of the table and
 * the scroll container's scrollTop, so specs can check that the entrance
 * fade actually ran (and that any restore-scroll happened while the table
 * was still faded out).
 */
async function sampleTableEntrance(page: Page, frames = 40) {
  return page.evaluate(
    (frameCount) =>
      new Promise<{ opacity: number; scrollTop: number }[]>((resolve) => {
        const samples: { opacity: number; scrollTop: number }[] = [];
        const tick = () => {
          const table = document.querySelector('.vt-table');
          const container = document.querySelector(
            '[data-testid="vt-container"]',
          );
          if (table && container) {
            samples.push({
              opacity: Number(getComputedStyle(table).opacity),
              scrollTop: container.scrollTop,
            });
          }
          if (samples.length >= frameCount) resolve(samples);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
}

/** Resolve once every finite CSS animation on the page has finished. */
async function settleAnimations(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

test.describe('Loading experience', () => {
  test('first launch: choose a folder and build the library inline', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser({
      withLibraryPath: false,
    });

    try {
      await expect(page.getByText('Welcome to hihat')).toBeVisible();
      const chooseFolder = page.getByTestId('welcome-choose-folder');
      await expect(chooseFolder).toHaveText('Choose music folder');
      await expect(page.getByTestId('welcome-scan')).toHaveCount(0);
      // No stats pills for an empty library.
      await expect(page.getByText('0 hours')).toHaveCount(0);
      await settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'loading-first-run-welcome');

      await TestHelpers.stubDirectoryDialog(app, TestHelpers.testSongsPath());
      await chooseFolder.click();

      // Progress renders inline while the scan runs.
      await expect(page.getByTestId('welcome-scan-progress')).toBeVisible();
      await TestHelpers.takeScreenshot(page, 'loading-first-run-scanning');

      // Rows replace the welcome panel once the scan completes, and the
      // table fades in rather than popping.
      await TestHelpers.waitForTracks(page, 30000);
      const samples = await sampleTableEntrance(page, 3);
      expect(samples[0].opacity).toBeLessThan(1);
      await expect(page.getByTestId('library-welcome')).toHaveCount(0);
      await expect(page.locator('.vt-table')).toHaveCSS('opacity', '1');
      await settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'loading-first-run-library');

      const settings = await page.evaluate(() =>
        (window as any).electron.settings.get(),
      );
      expect(settings.libraryPath).toBe(TestHelpers.testSongsPath());
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('new user with a folder already set can scan from the welcome panel', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    try {
      await expect(page.getByTestId('welcome-choose-folder')).toHaveText(
        'Choose a different folder',
      );
      await page.getByTestId('welcome-scan').click();
      await TestHelpers.waitForTracks(page, 30000);
      await expect(page.getByTestId('library-welcome')).toHaveCount(0);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('returning user: shell and skeleton render while the library loads', async () => {
    const { app, page } = await TestHelpers.launchApp({
      env: { TEST_TRACKS_LOAD_DELAY_MS: SLOW_LOAD_MS },
      waitForReady: false,
    });

    try {
      // The real shell is up immediately: sidebar, toolbar and player.
      const skeleton = page.getByTestId('table-skeleton');
      await expect(skeleton).toBeVisible();
      await expect(page.locator('[data-view="library"]')).toBeVisible();
      await expect(page.locator('[data-playlist-id]')).not.toHaveCount(0);
      await expect(page.getByText('music awaits')).toHaveCount(0);
      // No welcome panel or misleading "0 songs" while loading.
      await expect(page.getByTestId('library-welcome')).toHaveCount(0);
      await expect(skeleton).toHaveCSS('opacity', '1');
      await settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'loading-returning-skeleton');

      await TestHelpers.waitForTracks(page);
      const samples = await sampleTableEntrance(page, 3);
      expect(samples[0].opacity).toBeLessThan(1);
      await expect(skeleton).toHaveCount(0);
      await expect(page.locator('.vt-table')).toHaveCSS('opacity', '1');
      await settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'loading-returning-loaded');
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('returning user: last played track is restored before the table is shown', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      // Pick a track far enough down that restoring it must scroll.
      const rows = page.locator('[data-track-id]');
      await page.locator('[data-testid="vt-container"]').evaluate((el) => {
        // eslint-disable-next-line no-param-reassign
        el.scrollTop = el.scrollHeight;
      });
      const targetId = await rows.last().getAttribute('data-track-id');
      expect(targetId).toBeTruthy();
      await page.evaluate(
        (id) =>
          (window as any).electron.settings.update({ lastPlayedSongId: id }),
        targetId,
      );

      // Relaunch the renderer against the same database.
      await page.reload();
      await TestHelpers.waitForTracks(page);
      const samples = await sampleTableEntrance(page, 40);

      const target = page.locator(`[data-track-id="${targetId}"]`);
      await expect(target).toBeInViewport();
      await expect(target).toHaveClass(/vt-row-playing/);
      await settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'loading-returning-restored');

      // The restore scroll must land while the table is still faded out,
      // so the user never sees the list jump.
      const firstScrolled = samples.findIndex((s) => s.scrollTop > 0);
      expect(firstScrolled).toBeGreaterThanOrEqual(0);
      expect(samples[firstScrolled].opacity).toBeLessThan(0.5);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('search with no matches shows a message, not the welcome panel', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await page.getByLabel('Show/Hide search').click();
      await page.locator('input').first().fill('zzzz-no-such-song');
      await expect(page.getByText('No songs match your search.')).toBeVisible();
      await expect(page.getByTestId('library-welcome')).toHaveCount(0);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('prefers-reduced-motion disables entrance animations', async () => {
    const { app, page } = await TestHelpers.launchApp({
      env: { TEST_TRACKS_LOAD_DELAY_MS: SLOW_LOAD_MS },
      waitForReady: false,
    });

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await TestHelpers.waitForTracks(page);
      const duration = await page
        .locator('.vt-table')
        .evaluate((el) => getComputedStyle(el).animationDuration);
      expect(parseFloat(duration)).toBeLessThan(0.001);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });
  test('light theme: loading skeleton follows the theme', async () => {
    const { app, page } = await TestHelpers.launchApp({
      env: { TEST_TRACKS_LOAD_DELAY_MS: SLOW_LOAD_MS },
    });

    try {
      await page.evaluate(() =>
        (window as any).electron.settings.update({ theme: 'light' }),
      );
      await page.reload();
      const skeleton = page.getByTestId('table-skeleton');
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveCSS('opacity', '1');
      await TestHelpers.takeScreenshot(page, 'loading-light-skeleton');
      await TestHelpers.waitForTracks(page);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('album art crossfades between tracks and views fade on switch', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      const rows = page.locator('[data-track-id]');
      await TestHelpers.startPlayback(page, rows.nth(0));
      const firstTitle = await TestHelpers.nowPlayingTitle(page);
      await page.locator('[data-testid="album-art"]').first().waitFor();

      await TestHelpers.startPlayback(page, rows.nth(5));
      await TestHelpers.waitForNowPlayingChange(page, firstTitle);
      // The incoming art layer runs the shared fade-in keyframes.
      await expect(page.getByTestId('album-art')).toHaveCSS(
        'animation-name',
        'hihat-fade-in',
      );
      await settleAnimations(page);
      await TestHelpers.takeScreenshot(page, 'loading-album-art');

      // Switching to a playlist fades the new view in.
      await page.locator('[data-playlist-id]').first().click();
      const fading = await page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (a) =>
              (a as unknown as { animationName: string }).animationName ===
                'hihat-fade-in' && a.playState === 'running',
          ),
      );
      expect(fading).toBe(true);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });
});
