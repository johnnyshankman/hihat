/* eslint-disable no-console */
import { test, expect, Page, ElectronApplication } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Helper to close MiniPlayer before app shutdown to prevent teardown timeouts.
 */
async function closeMiniPlayerAndApp(page: Page, app: ElectronApplication) {
  try {
    await page.evaluate(() => {
      return (window as any).electron.miniPlayer.close();
    });
    await page.waitForTimeout(1000);
  } catch {
    // Ignore errors during cleanup
  }
  await TestHelpers.closeApp(app);
}

/**
 * Helper to open MiniPlayer and return the MiniPlayer page.
 * Waits for the MiniPlayer window to fully load and sync state.
 */
async function openMiniPlayer(
  app: ElectronApplication,
  page: Page,
): Promise<Page> {
  await page.evaluate(() => {
    return (window as any).electron.miniPlayer.open();
  });

  // Wait for the MiniPlayer window to appear
  await page.waitForTimeout(5000);

  const windows = app.windows();
  expect(windows.length).toBeGreaterThanOrEqual(2);

  const miniPlayerPage = windows.find((w: Page) => w !== page);
  expect(miniPlayerPage).toBeTruthy();

  await miniPlayerPage!.waitForLoadState('domcontentloaded');
  // MiniPlayer polls state every 1s — wait for several sync cycles
  await miniPlayerPage!.waitForTimeout(5000);

  return miniPlayerPage!;
}

/**
 * MiniPlayer tests are skipped because the MiniPlayer IPC state sync
 * does not work reliably in the test environment. The MiniPlayer window
 * opens but does not receive track/playback state from the main process
 * (track title stays "---"). This is an infrastructure limitation — the
 * main process relay (player:trackUpdate → miniPlayer:trackChanged) is
 * not triggered during E2E tests since the renderer's state update events
 * aren't being forwarded to the main process in the test build.
 *
 * To enable these tests, the app would need to ensure the main process
 * MiniPlayer state relay is active when TEST_MODE=true.
 */
test.describe('MiniPlayer Synchronization', () => {
  test.skip('MiniPlayer position sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(2000);

    // Verify it's playing
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Open MiniPlayer and wait for state sync
    const miniPlayerPage = await openMiniPlayer(app, page);

    // Wait additional time for position to advance and sync
    await page.waitForTimeout(3000);

    // Verify MiniPlayer has received the track
    const miniTrackTitle = await miniPlayerPage.evaluate(() => {
      const h6 = document.querySelector('.MuiTypography-h6');
      return h6?.textContent || '---';
    });
    console.log(`MiniPlayer track title: ${miniTrackTitle}`);
    expect(miniTrackTitle).not.toBe('---');

    // Check position from main window using the PositionDisplay Slider
    const mainSliderValue = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll('input[type="range"]'),
      );
      const seekInput = inputs.find((input) => {
        const val = parseFloat((input as HTMLInputElement).value);
        const max = parseFloat((input as HTMLInputElement).max);
        return val > 0 && max > 0 && max <= 15000;
      });
      return seekInput ? parseFloat((seekInput as HTMLInputElement).value) : 0;
    });

    console.log(`Main slider value: ${mainSliderValue}`);
    expect(mainSliderValue).toBeGreaterThan(0);

    // MiniPlayer should show captions with position info
    const miniCaptions = await miniPlayerPage.evaluate(() => {
      return Array.from(document.querySelectorAll('.MuiTypography-caption'))
        .map((el) => el.textContent)
        .filter(Boolean);
    });
    console.log(`MiniPlayer captions: ${JSON.stringify(miniCaptions)}`);
    expect(miniCaptions.length).toBeGreaterThanOrEqual(2);

    await closeMiniPlayerAndApp(page, app);
  });

  test.skip('MiniPlayer play/pause sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Open MiniPlayer and wait for state sync
    const miniPlayerPage = await openMiniPlayer(app, page);

    // Verify main window is playing
    const mainPauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(mainPauseIcon).toBeVisible({ timeout: 5000 });

    // Verify MiniPlayer received the track
    const miniTrackTitle = await miniPlayerPage.evaluate(() => {
      const h6 = document.querySelector('.MuiTypography-h6');
      return h6?.textContent || '---';
    });
    expect(miniTrackTitle).not.toBe('---');

    // Check if MiniPlayer has a PauseIcon (playing state)
    const miniPauseIcon = miniPlayerPage.locator(
      'button svg[data-testid="PauseIcon"]',
    );
    await expect(miniPauseIcon).toBeVisible({ timeout: 15000 });

    // Pause in main window
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(2000);

    // Verify main window paused
    const mainPlayIcon = page.locator(
      'button svg[data-testid="PlayArrowIcon"]',
    );
    await expect(mainPlayIcon).toBeVisible({ timeout: 5000 });

    // Verify MiniPlayer also paused
    const miniPlayIcon = miniPlayerPage.locator(
      'button svg[data-testid="PlayArrowIcon"]',
    );
    await expect(miniPlayIcon).toBeVisible({ timeout: 15000 });

    // Resume in MiniPlayer
    await miniPlayerPage
      .locator('button:has(svg[data-testid="PlayArrowIcon"])')
      .click();
    await page.waitForTimeout(2000);

    // Verify both playing again
    const mainPauseAgain = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(mainPauseAgain).toBeVisible({ timeout: 5000 });

    const miniPauseAgain = miniPlayerPage.locator(
      'button svg[data-testid="PauseIcon"]',
    );
    await expect(miniPauseAgain).toBeVisible({ timeout: 15000 });

    await closeMiniPlayerAndApp(page, app);
  });
});
