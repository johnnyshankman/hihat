/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Rapid Skip Bug Regression', () => {
  test('rapid next clicks while playing — playback state stays in sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click the first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Fire 5 rapid clicks via DOM dispatching (no await between clicks)
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="skip-next-button"]');
      if (!btn) return;
      for (let i = 0; i < 5; i++) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    // Wait for things to settle
    await page.waitForTimeout(2000);

    // The player UI should show PauseIcon (meaning it's playing)
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Grab the elapsed time, wait, and verify it advanced (audio is actually playing)
    const getElapsedTime = () =>
      page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="player-elapsed-time"]',
        );
        return el?.textContent?.trim() || '';
      });

    const time1 = await getElapsedTime();
    await page.waitForTimeout(3000);
    const time2 = await getElapsedTime();

    // If playback is truly active, the elapsed time should have advanced
    expect(time2).not.toBe(time1);

    await TestHelpers.closeApp(app);
  });

  test('rapid previous clicks while playing — playback state stays in sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Start on the 6th track so we have room to go back
    const sixthTrack = page.locator('[data-track-id]').nth(5);
    await sixthTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Fire 5 rapid clicks via DOM dispatching (no await between clicks)
    await page.evaluate(() => {
      const btn = document.querySelector(
        '[data-testid="skip-previous-button"]',
      );
      if (!btn) return;
      for (let i = 0; i < 5; i++) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    // Wait for things to settle
    await page.waitForTimeout(2000);

    // Should still show playing state
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Verify audio is actually advancing
    const getElapsedTime = () =>
      page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="player-elapsed-time"]',
        );
        return el?.textContent?.trim() || '';
      });

    const time1 = await getElapsedTime();
    await page.waitForTimeout(3000);
    const time2 = await getElapsedTime();

    expect(time2).not.toBe(time1);

    await TestHelpers.closeApp(app);
  });
});
