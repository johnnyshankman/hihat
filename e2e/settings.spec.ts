/* eslint-disable radix */
/* eslint-disable @typescript-eslint/no-shadow */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Settings', () => {
  test('should navigate to settings', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to settings view
    await TestHelpers.navigateToView(page, 'settings');

    // Verify settings view is visible
    const settingsView = page.locator('[data-testid="settings-view"]');
    await expect(settingsView).toBeVisible();

    // Verify settings header is present (use getByRole to be specific)
    const settingsHeader = page.getByRole('heading', { name: 'Settings' });
    await expect(settingsHeader).toBeVisible();

    // Verify key settings sections are visible (use getByRole for headings)
    await expect(
      page.getByRole('heading', { name: 'Library Location' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    await TestHelpers.takeScreenshot(page, 'settings-view');

    await TestHelpers.closeApp(app);
  });

  test('should toggle dark mode theme', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to settings
    await TestHelpers.navigateToView(page, 'settings');

    // Get the theme toggle switch
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    await expect(themeToggle).toBeVisible();

    // Get initial theme state from the switch's checked state
    const initialThemeIsDark = await themeToggle.isChecked();

    // Click the theme toggle
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Verify the theme has changed
    const newThemeIsDark = await themeToggle.isChecked();
    expect(newThemeIsDark).not.toBe(initialThemeIsDark);

    // Verify the theme persisted in the store
    const themeInStore = await page.evaluate(() => {
      // Access the window object to get the theme from the store
      // The theme is managed by Zustand and exposed through the settings store
      return (window as any).electron?.settings?.get
        ? (window as any).electron.settings.get().then((s: any) => s.theme)
        : null;
    });

    // If we can access the store, verify it matches the toggle state
    if (themeInStore) {
      const expectedTheme = newThemeIsDark ? 'dark' : 'light';
      expect(themeInStore).toBe(expectedTheme);
    }

    await TestHelpers.takeScreenshot(page, 'theme-changed');

    await TestHelpers.closeApp(app);
  });
});
