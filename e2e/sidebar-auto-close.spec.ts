import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Sidebar Persistence', () => {
  test('should keep sidebar open when clicking navigation items', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // The library nav row only exists while the sidebar is open, so its
    // visibility is the sidebar's open/closed state.
    const sidebar = page.locator('[data-testid="nav-library"]');

    // 1. Verify sidebar is initially open
    await expect(sidebar).toBeVisible();

    // 2. Click on a playlist - sidebar should stay open
    await page.getByText('Test Playlist', { exact: true }).click();

    // Verify we're in playlist view. The in-header `h2` title is intentionally
    // hidden while the sidebar is open (the selected sidebar row already names
    // the playlist), so assert selection via the sidebar row's Mui-selected
    // class instead — which is the actual source of truth for the current view.
    const selectedPlaylistRow = page
      .locator('[data-playlist-id]')
      .filter({ hasText: 'Test Playlist' });
    await expect(selectedPlaylistRow).toHaveClass(/Mui-selected/);

    // Verify sidebar is still open
    await expect(sidebar).toBeVisible();

    // 3. Click "All" (Library) - sidebar should stay open
    await sidebar.click();

    // Verify we're in library view (tracks visible)
    await expect(page.locator('[data-track-id]').first()).toBeVisible();

    // Verify sidebar is still open
    await expect(sidebar).toBeVisible();

    // 4. Explicit toggle closes sidebar
    await page.locator('[data-testid="sidebar-toggle-close"]').click();
    await expect(sidebar).toBeHidden();

    // 5. Toggle reopens sidebar
    await page.locator('[data-testid="sidebar-toggle"]').click();
    await expect(sidebar).toBeVisible();

    await TestHelpers.closeApp(app);
  });
});
