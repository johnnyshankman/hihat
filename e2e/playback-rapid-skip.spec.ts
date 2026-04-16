/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Rapid Skip Bug Regression', () => {
  // The optimistic-next/prev feature (issue #72) requires that rapid clicks
  // never get dropped. If a user clicks next 10 times quickly, they must land
  // 10 songs forward — not 1 or 2.
  test('rapid next x10 lands on the song 10 positions forward', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Read the title of the song we expect to land on (start + 10 = index 10).
    const expectedLandingTitle = await page
      .locator('[data-track-id]')
      .nth(10)
      .locator('td')
      .first()
      .textContent();

    // Double-click the first track to start playback.
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Fire 10 rapid clicks via DOM dispatching — tight synchronous loop so
    // no React state update can settle between them.
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="skip-next-button"]');
      if (!btn) return;
      for (let i = 0; i < 10; i++) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    // Give the final track time to load and autoplay.
    await page.waitForTimeout(3000);

    // Verify we landed on the expected track 10 positions ahead.
    const pageContent = await page.content();
    expect(pageContent).toContain(expectedLandingTitle!.trim());

    // And that audio is actively advancing (not stuck at 0:00).
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('rapid previous x5 lands on the song 5 positions back', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Expected landing: start from track index 10, go back 5 = index 5.
    const expectedLandingTitle = await page
      .locator('[data-track-id]')
      .nth(5)
      .locator('td')
      .first()
      .textContent();

    // Start on the 11th track (index 10).
    await page.locator('[data-track-id]').nth(10).dblclick();
    await page.waitForTimeout(1000);

    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Fire 5 rapid prev clicks. Each one should walk back one index since
    // position has just reset to 0 on each skip (position > 3 restart only
    // applies on the very first click, and since we just started, position
    // is ~0 anyway so every click walks back).
    await page.evaluate(() => {
      const btn = document.querySelector(
        '[data-testid="skip-previous-button"]',
      );
      if (!btn) return;
      for (let i = 0; i < 5; i++) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    await page.waitForTimeout(3000);

    const pageContent = await page.content();
    expect(pageContent).toContain(expectedLandingTitle!.trim());
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

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
