/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playlist Management', () => {
  test('should create a new custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Click the add playlist button
    await page.click('[data-testid="add-playlist-button"]');

    // Wait for the dialog to appear
    await page.waitForSelector('[data-testid="create-playlist-dialog"]', {
      state: 'visible',
    });

    // Type the playlist name
    await page.fill('[data-testid="playlist-name-input"]', 'My Test Playlist');

    // Click the create button
    await page.click('[data-testid="create-playlist-button"]');

    // Wait for the dialog to close
    await page.waitForSelector('[data-testid="create-playlist-dialog"]', {
      state: 'hidden',
      timeout: 5000,
    });

    // Verify the playlist appears in the sidebar
    await expect(page.locator('text=My Test Playlist').first()).toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('should add songs to a custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to library view
    await page.click('[data-testid="nav-library"]');
    await TestHelpers.waitForTracks(page);

    // Right-click on a track that's NOT already in "Test Playlist"
    // Test Playlist has test-large-001, test-large-002, test-large-003
    // So we'll add test-large-004 (Electronic Pulse - Your Dream of Love)
    // First, search for the track since virtualization may hide it
    await page.locator('[aria-label="Show/Hide search"]').click();
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Electronic Pulse');

    // Now the track should be visible
    const trackRow = page.locator('[data-track-id="test-large-004"]');
    await expect(trackRow).toBeVisible();
    await trackRow.click({ button: 'right' });

    // Click "Add to Playlist" in the context menu
    await page.click('[data-testid="add-to-playlist-menu-item"]');

    // Select the "Test Playlist" playlist (from fixture data)
    // The fixture data has playlist-1 which is "Test Playlist"
    const playlistOption = page.locator(
      '[data-testid="playlist-option-playlist-1"]',
    );
    await expect(playlistOption).toBeVisible();
    await playlistOption.click();
    await expect(playlistOption).toBeHidden();

    // Clear the search before navigating to playlist
    await searchInput.clear();
    await TestHelpers.waitForTracks(page);

    // Re-open sidebar (it auto-closes after navigation)
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }

    // Now navigate to the playlist view to verify the track was added
    // Click on "Test Playlist" in the sidebar
    await page.click('[data-playlist-id="playlist-1"]');

    // Verify that test-large-004 is now in the playlist, and that the playlist
    // grew from 3 tracks to 4.
    await expect(
      page.locator('[data-track-id="test-large-004"]'),
    ).toBeVisible();
    await TestHelpers.waitForTrackCount(page, 4);

    await TestHelpers.closeApp(app);
  });

  test('should remove songs from a custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to the "Test Playlist" which has 3 tracks (test-large-001, test-large-002, test-large-003)
    await page.click('[data-playlist-id="playlist-1"]');

    // Verify we start with 3 tracks
    await TestHelpers.waitForTrackCount(page, 3);

    // Right-click on test-large-001 to open context menu
    const trackRow = await page.locator('[data-track-id="test-large-001"]');
    await trackRow.click({ button: 'right' });

    // Click "Remove from Playlist" in the context menu
    await page.click('[data-testid="remove-from-playlist-menu-item"]');

    // Wait for the ConfirmationDialog to appear and click "Remove"
    await page.getByRole('button', { name: 'Remove' }).click();

    // Verify that test-large-001 is no longer in the playlist, leaving 2
    await expect(page.locator('[data-track-id="test-large-001"]')).toBeHidden();
    await TestHelpers.waitForTrackCount(page, 2);

    await TestHelpers.closeApp(app);
  });

  test('should rename a custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Right-click on "Test Playlist" to open context menu
    const playlistItem = await page.locator('[data-playlist-id="playlist-1"]');
    await playlistItem.click({ button: 'right' });

    // Click "Rename" in the context menu
    await page.click('[data-testid="rename-playlist-menu-item"]');

    // Wait for the rename dialog to appear
    await page.waitForSelector('[data-testid="rename-playlist-dialog"]', {
      state: 'visible',
    });

    // Clear the input and type the new name
    await page.fill('[data-testid="rename-playlist-input"]', '');
    await page.fill(
      '[data-testid="rename-playlist-input"]',
      'Renamed Test Playlist',
    );

    // Click the rename button
    await page.click('[data-testid="confirm-rename-button"]');

    // Wait for the dialog to close
    await page.waitForSelector('[data-testid="rename-playlist-dialog"]', {
      state: 'hidden',
      timeout: 5000,
    });

    // Verify the playlist name was updated in the sidebar
    // Look for the playlist by its data-playlist-id and check it contains the new name
    await expect(page.locator('[data-playlist-id="playlist-1"]')).toContainText(
      'Renamed Test Playlist',
    );

    await TestHelpers.closeApp(app);
  });

  test('should delete a custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // First verify the playlist exists
    const playlistItem = await page.locator('[data-playlist-id="playlist-2"]');
    await playlistItem.waitFor({ state: 'visible', timeout: 5000 });

    // Right-click on "Jazz Favorites" (playlist-2) to open context menu
    await playlistItem.click({ button: 'right' });

    // Click "Delete Playlist" in the context menu
    await page.click('[data-testid="delete-playlist-menu-item"]');

    // Verify the playlist no longer exists in the sidebar
    await expect(page.locator('[data-playlist-id="playlist-2"]')).toHaveCount(
      0,
    );

    await TestHelpers.closeApp(app);
  });
});
