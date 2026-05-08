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
      page.getByRole('heading', { name: 'Music Folder' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Appearance' }),
    ).toBeVisible();

    await TestHelpers.takeScreenshot(page, 'settings-view');

    await TestHelpers.closeApp(app);
  });

  test('should render Sort Artist by Album Artist toggle', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.navigateToView(page, 'settings');

    // Section heading
    const sortingHeading = page.getByRole('heading', { name: 'Sorting' });
    await expect(sortingHeading).toBeVisible();

    // Helper text (substring match for tolerance to whitespace)
    await expect(
      page.getByText(/groups tracks under their album artist/i),
    ).toBeVisible();

    // Toggle + label
    const toggle = page.locator(
      '[data-testid="sort-artist-by-album-artist-toggle"]',
    );
    await expect(toggle).toBeVisible();
    await expect(page.getByLabel('Sort Artist by Album Artist')).toBeVisible();

    // Default is ON for fresh installs / migrated rows.
    expect(await toggle.isChecked()).toBe(true);

    // Flip OFF and verify it persists in settings IPC.
    await toggle.click();
    await page.waitForTimeout(300);
    expect(await toggle.isChecked()).toBe(false);

    const persistedAfterOff = await page.evaluate(() =>
      (window as any).electron.settings
        .get()
        .then((s: any) => s.sortArtistByAlbumArtist),
    );
    expect(persistedAfterOff).toBe(false);

    // Flip back ON.
    await toggle.click();
    await page.waitForTimeout(300);
    expect(await toggle.isChecked()).toBe(true);

    const persistedAfterOn = await page.evaluate(() =>
      (window as any).electron.settings
        .get()
        .then((s: any) => s.sortArtistByAlbumArtist),
    );
    expect(persistedAfterOn).toBe(true);

    await TestHelpers.takeScreenshot(page, 'settings-sorting-section');

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
