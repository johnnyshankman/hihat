import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Skip Button Disable States (issue #72)', () => {
  test('next stays enabled with 200+ tracks ahead', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Play the first track — plenty of songs available ahead.
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').first(),
    );

    const nextBtn = page.locator('[data-testid="skip-next-button"]');
    await expect(nextBtn).toBeEnabled();

    await TestHelpers.closeApp(app);
  });

  test('previous at first track (no prev target) restarts the song instead of being disabled', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Play first track (defaults: repeat=off, shuffle=off) then pause so
    // position stays frozen well under 3s — this is the window where prev
    // used to be disabled (no prev target and the >3s restart hatch hadn't
    // opened yet). Pausing also prevents toBeEnabled's poll window from
    // masking a real failure by waiting for position to cross 3s.
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').first(),
    );
    const firstTrackTitle = await TestHelpers.nowPlayingTitle(page);
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await TestHelpers.waitForPaused(page);

    // On old behavior this is disabled; test should fail here against main.
    const prevBtn = page.locator('[data-testid="skip-previous-button"]');
    await expect(prevBtn).toBeEnabled({ timeout: 1500 });
    await prevBtn.click();

    // Same track (no navigation).
    await expect(page.locator('[data-testid="now-playing-title"]')).toHaveText(
      firstTrackTitle,
      { timeout: 1500 },
    );

    // Paused, so elapsed time should be 0:00 after the restart click.
    await expect(
      page.locator('[data-testid="player-elapsed-time"]'),
    ).toHaveText('0:00', { timeout: 1500 });

    await TestHelpers.closeApp(app);
  });
});
