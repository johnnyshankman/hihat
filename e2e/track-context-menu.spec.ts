import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Track Context Menu', () => {
  test('should display context menu with all options when right-clicking a track in library view', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Ensure we're in library view
    await page.click('[data-testid="nav-library"]');
    await TestHelpers.waitForTracks(page);

    // Right-click on the first track to open the context menu
    const firstTrack = page.locator('[data-track-id]').first();
    await firstTrack.click({ button: 'right' });

    // Verify the context menu is visible (MUI Menu uses role="menu")
    const contextMenu = page.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible();

    // Verify all expected menu items are present (use exact matching)
    await expect(contextMenu.getByText('Play', { exact: true })).toBeVisible();
    await expect(
      contextMenu.getByText('Add to Playlist', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Show in Finder', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Find on Spotify', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Find on Apple Music', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Find on Tidal', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Download Album Art', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Edit Metadata', { exact: true }),
    ).toBeVisible();
    await expect(
      contextMenu.getByText('Remove from Library', { exact: true }),
    ).toBeVisible();

    // Close the context menu by pressing Escape
    await page.keyboard.press('Escape');

    // Verify the context menu is closed
    await expect(contextMenu).not.toBeVisible();

    await TestHelpers.closeApp(app);
  });
});
