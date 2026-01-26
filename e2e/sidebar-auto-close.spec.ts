import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Sidebar Auto-Close', () => {
  test('should close sidebar when clicking navigation items', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // Helper function to check if sidebar is visible
    const isSidebarOpen = async () => {
      return page.locator('[data-testid="nav-library"]').isVisible();
    };

    // 1. Verify sidebar is initially open
    expect(await isSidebarOpen()).toBe(true);

    // 2. Click on a playlist - should close sidebar
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Verify we're in playlist view
    const playlistHeading = page.locator('h2');
    await expect(playlistHeading).toContainText('Test Playlist');

    // Verify sidebar is now closed
    expect(await isSidebarOpen()).toBe(false);

    // 3. Re-open sidebar using the toggle button
    // When sidebar is closed, the toggle appears in the main content area
    await page.locator('[data-testid="sidebar-toggle"]').click();
    await page.waitForTimeout(500);
    expect(await isSidebarOpen()).toBe(true);

    // 4. Click "All" (Library) - should close sidebar
    await page.locator('[data-testid="nav-library"]').click();
    await page.waitForTimeout(500);

    // Verify we're in library view (tracks visible)
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThan(0);

    // Verify sidebar is closed
    expect(await isSidebarOpen()).toBe(false);

    // 5. Re-open sidebar
    await page.locator('[data-testid="sidebar-toggle"]').click();
    await page.waitForTimeout(500);
    expect(await isSidebarOpen()).toBe(true);

    // 6. Click Settings - should close sidebar
    await page.locator('[data-testid="nav-settings"]').click();
    await page.waitForTimeout(500);

    // Verify we're in settings view
    const settingsHeading = page.getByRole('heading', { name: 'Settings' });
    await expect(settingsHeading).toBeVisible();

    // Verify sidebar is closed
    expect(await isSidebarOpen()).toBe(false);

    await TestHelpers.closeApp(app);
  });
});
