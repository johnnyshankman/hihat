import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Skip Button Disable States (issue #72)', () => {
  test('previous is disabled at the first track with position 0 and no repeat', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Start playing the first track, then pause immediately so position stays near 0.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(500);
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(300);

    // With repeat=off (default), shuffle=off, position ~0, and on track 1,
    // previous should now be disabled.
    const prevBtn = page.locator('[data-testid="skip-previous-button"]');
    await expect(prevBtn).toBeDisabled({ timeout: 3000 });

    await TestHelpers.closeApp(app);
  });

  test('previous re-enables after playback advances past 3 seconds', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Play the first track.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(500);

    const prevBtn = page.locator('[data-testid="skip-previous-button"]');

    // Immediately after starting, we're near 0 — prev should be disabled.
    await expect(prevBtn).toBeDisabled({ timeout: 3000 });

    // Let playback advance past 3 seconds; the restart escape hatch enables prev.
    await page.waitForTimeout(4000);
    await expect(prevBtn).toBeEnabled({ timeout: 3000 });

    await TestHelpers.closeApp(app);
  });

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

  test('tooltip does not render when previous button is disabled', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // First track, position ~0, paused → prev disabled.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(500);
    await page.locator('button:has(svg[data-testid="PauseIcon"])').click();
    await page.waitForTimeout(300);

    const prevBtn = page.locator('[data-testid="skip-previous-button"]');
    await expect(prevBtn).toBeDisabled({ timeout: 3000 });

    // Hover over the wrapping span (the Tooltip attaches listeners there since
    // the disabled button doesn't emit pointer events) and confirm no tooltip
    // popover appears.
    const prevWrapper = page
      .locator('span:has([data-testid="skip-previous-button"])')
      .first();
    await prevWrapper.hover();
    await page.waitForTimeout(1000);

    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toHaveCount(0);

    await TestHelpers.closeApp(app);
  });
});
