/* eslint-disable radix */
/* eslint-disable @typescript-eslint/no-shadow */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Settings', () => {
  test('should navigate to settings', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.navigateToView(page, 'settings');

    const settingsView = await page.locator('[data-testid="settings-view"]');
    expect(await settingsView.isVisible()).toBe(true);

    await TestHelpers.takeScreenshot(page, 'settings-view');

    await TestHelpers.closeApp(app);
  });

  test('should change the theme', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.navigateToView(page, 'settings');

    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500);

    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(newTheme).not.toBe(initialTheme);

    await TestHelpers.takeScreenshot(page, 'theme-changed');

    await TestHelpers.closeApp(app);
  });
});
