import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Sidebar Persistence', () => {
  test('should keep sidebar open when clicking navigation items', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // Helper function to check if sidebar is visible
    const isSidebarOpen = async () => {
      return page.locator('[data-testid="nav-library"]').isVisible();
    };

    // 1. Verify sidebar is initially open
    expect(await isSidebarOpen()).toBe(true);

    // 2. Click on a playlist - sidebar should stay open
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Verify we're in playlist view
    const playlistHeading = page.locator('h2');
    await expect(playlistHeading).toContainText('Test Playlist');

    // Verify sidebar is still open
    expect(await isSidebarOpen()).toBe(true);

    // 3. Click "All" (Library) - sidebar should stay open
    await page.locator('[data-testid="nav-library"]').click();
    await page.waitForTimeout(500);

    // Verify we're in library view (tracks visible)
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThan(0);

    // Verify sidebar is still open
    expect(await isSidebarOpen()).toBe(true);

    // 4. Explicit toggle closes sidebar
    await page.locator('[data-testid="sidebar-toggle-close"]').click();
    await page.waitForTimeout(500);
    expect(await isSidebarOpen()).toBe(false);

    // 5. Toggle reopens sidebar
    await page.locator('[data-testid="sidebar-toggle"]').click();
    await page.waitForTimeout(500);
    expect(await isSidebarOpen()).toBe(true);

    await TestHelpers.closeApp(app);
  });
});
