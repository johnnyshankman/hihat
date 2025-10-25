import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Basic Functionality', () => {
  test('should navigate between views', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Start in Library view
    const libraryHeading = await page.getByRole('heading', {
      name: 'Library',
      exact: true,
    });
    await expect(libraryHeading).toBeVisible();

    // Navigate to Playlists
    await page.getByRole('button', { name: 'Playlists' }).click();
    await page.waitForTimeout(1000);

    const playlistsHeading = await page.getByRole('heading', {
      name: 'Playlists',
    });
    await expect(playlistsHeading).toBeVisible();

    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(1000);

    const settingsHeading = await page.getByRole('heading', {
      name: 'Settings',
    });
    await expect(settingsHeading).toBeVisible();

    // Navigate back to Library
    await page.getByRole('button', { name: 'Library' }).click();
    await page.waitForTimeout(1000);

    await expect(libraryHeading).toBeVisible();

    await TestHelpers.closeApp(app);
  });
});
