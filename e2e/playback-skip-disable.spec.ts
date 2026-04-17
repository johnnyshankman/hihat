import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Skip Button Disable States (issue #72)', () => {
  test('next stays enabled with 200+ tracks ahead', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Play the first track — plenty of songs available ahead.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(500);

    const nextBtn = page.locator('[data-testid="skip-next-button"]');
    await expect(nextBtn).toBeEnabled({ timeout: 3000 });

    await TestHelpers.closeApp(app);
  });

  test('previous at first track (no prev target) restarts the song instead of being disabled', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Play first track (defaults: repeat=off, shuffle=off) then pause so
    // position stays frozen well under 3s — this is the window where prev
    // used to be disabled (no prev target and the >3s restart hatch hadn't
    // opened yet). Pausing also prevents toBeEnabled's poll window from
    // masking a real failure by waiting for position to cross 3s.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(500);
    const firstTrackTitle = await page
      .locator('[data-testid="now-playing-title"]')
      .textContent();
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(300);

    // On old behavior this is disabled; test should fail here against main.
    const prevBtn = page.locator('[data-testid="skip-previous-button"]');
    await expect(prevBtn).toBeEnabled({ timeout: 1500 });
    await prevBtn.click();
    await page.waitForTimeout(500);

    // Same track (no navigation).
    await expect(page.locator('[data-testid="now-playing-title"]')).toHaveText(
      firstTrackTitle!,
      { timeout: 1500 },
    );

    // Paused, so elapsed time should be 0:00 after the restart click.
    await expect(
      page.locator('[data-testid="player-elapsed-time"]'),
    ).toHaveText('0:00', { timeout: 1500 });

    await TestHelpers.closeApp(app);
  });
});
