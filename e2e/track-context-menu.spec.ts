import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Track Context Menu', () => {
  test('should display context menu with all options when right-clicking a track in library view', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // Ensure we're in library view
    await page.click('[data-testid="nav-library"]');
    await page.waitForTimeout(500);

    // Wait for tracks to be visible
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Right-click on the first track to open the context menu
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.click({ button: 'right' });

    // Wait for the context menu to appear
    await page.waitForTimeout(500);

    // Verify the context menu is visible (MUI Menu uses role="menu")
    const contextMenu = page.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible();

    // Verify all expected menu items are present (use exact matching)
    await expect(contextMenu.getByText('Play', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Add to Playlist', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Show in Finder', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Find on Spotify', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Find on Apple Music', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Find on Tidal', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Download Album Art', { exact: true })).toBeVisible();
    await expect(contextMenu.getByText('Delete Track', { exact: true })).toBeVisible();

    // Close the context menu by pressing Escape
    await page.keyboard.press('Escape');

    // Verify the context menu is closed
    await expect(contextMenu).not.toBeVisible();

    await TestHelpers.closeApp(app);
  });
});
