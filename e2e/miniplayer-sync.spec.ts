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
    // Wait for the window to actually go away rather than guessing at it.
    await expect.poll(() => app.windows().length).toBe(1);
  } catch {
    // Ignore errors during cleanup
  }
  await TestHelpers.closeApp(app);
}

/**
 * Helper to open MiniPlayer and return the MiniPlayer page.
 *
 * `waitForEvent('window')` resolves the moment Electron creates the window, and
 * the MiniPlayer's own title readout tells us when its first state sync landed
 * — so neither step needs a fixed delay, even though the MiniPlayer polls on a
 * 1s cadence.
 */
async function openMiniPlayer(
  app: ElectronApplication,
  page: Page,
): Promise<Page> {
  const miniWindow = app.waitForEvent('window');

  await page.evaluate(() => {
    return (window as any).electron.miniPlayer.open();
  });

  const miniPlayerPage = await miniWindow;
  expect(app.windows().length).toBeGreaterThanOrEqual(2);

  await miniPlayerPage.waitForLoadState('domcontentloaded');

  // '---' is the MiniPlayer's "no track yet" placeholder; anything else means
  // the state sync from the main window has arrived.
  await expect(miniPlayerPage.locator('.MuiTypography-h6')).not.toHaveText(
    '---',
    { timeout: 20000 },
  );

  return miniPlayerPage;
}

test.describe('MiniPlayer Synchronization', () => {
  test('MiniPlayer position sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Open MiniPlayer and wait for state sync
    const miniPlayerPage = await openMiniPlayer(app, page);

    // Verify MiniPlayer has received the track
    const miniTrackTitle = await miniPlayerPage
      .locator('.MuiTypography-h6')
      .textContent();
    expect(miniTrackTitle).not.toBe('---');

    // Check position from main window using the PositionDisplay Slider.
    // Poll: the value only becomes non-zero once playback has advanced.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const inputs = Array.from(
              document.querySelectorAll('input[type="range"]'),
            );
            const seekInput = inputs.find((input) => {
              const val = parseFloat((input as HTMLInputElement).value);
              const max = parseFloat((input as HTMLInputElement).max);
              return val > 0 && max > 0 && max <= 15000;
            });
            return seekInput
              ? parseFloat((seekInput as HTMLInputElement).value)
              : 0;
          }),
        { timeout: 20000 },
      )
      .toBeGreaterThan(0);

    // MiniPlayer should show captions with position info
    await expect
      .poll(
        () =>
          miniPlayerPage.evaluate(
            () =>
              Array.from(document.querySelectorAll('.MuiTypography-caption'))
                .map((el) => el.textContent)
                .filter(Boolean).length,
          ),
        { timeout: 20000 },
      )
      .toBeGreaterThanOrEqual(2);

    await closeMiniPlayerAndApp(page, app);
  });

  test('MiniPlayer play/pause sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await TestHelpers.startPlayback(page, firstTrack);

    // Open MiniPlayer and wait for state sync
    const miniPlayerPage = await openMiniPlayer(app, page);

    // Verify main window is playing
    await TestHelpers.waitForPlaying(page);

    // Verify MiniPlayer received the track
    const miniTrackTitle = await miniPlayerPage
      .locator('.MuiTypography-h6')
      .textContent();
    expect(miniTrackTitle).not.toBe('---');

    // Check if MiniPlayer has a PauseIcon (playing state)
    const miniPauseIcon = miniPlayerPage.locator(
      'button svg[data-testid="PauseIcon"]',
    );
    await expect(miniPauseIcon).toBeVisible({ timeout: 15000 });

    // Pause in main window
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    // Verify MiniPlayer also paused
    const miniPlayIcon = miniPlayerPage.locator(
      'button svg[data-testid="PlayArrowIcon"]',
    );
    await expect(miniPlayIcon).toBeVisible({ timeout: 15000 });

    // Resume in MiniPlayer
    await miniPlayerPage
      .locator('button:has(svg[data-testid="PlayArrowIcon"])')
      .click();

    // Verify both playing again
    await TestHelpers.waitForPlaying(page);
    await expect(
      miniPlayerPage.locator('button svg[data-testid="PauseIcon"]'),
    ).toBeVisible({ timeout: 15000 });

    await closeMiniPlayerAndApp(page, app);
  });
});
