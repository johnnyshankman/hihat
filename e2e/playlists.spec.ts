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
    // The playlist should be visible in the sidebar after creation
    await page.waitForTimeout(1000); // Give time for the playlist to be created

    // Check if the playlist exists by looking for its data-playlist-id attribute
    const playlistElement = await page.locator('text=My Test Playlist').first();
    await playlistElement.waitFor({ state: 'visible', timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('should add songs to a custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to library view
    await page.click('[data-testid="nav-library"]');
    await page.waitForTimeout(500);

    // Right-click on a track that's NOT already in "Test Playlist"
    // Test Playlist has test-large-001, test-large-002, test-large-003
    // So we'll add test-large-004 (Electronic Pulse - Your Dream of Love)
    // First, search for the track since virtualization may hide it
    const searchToggle = page.locator('[aria-label="Show/Hide search"]');
    if (await searchToggle.isVisible()) {
      await searchToggle.click();
      await page.waitForTimeout(500);
    }

    // Search for the specific track - try multiple selectors
    let searchInput = page.locator('input[type="search"]').first();
    if (!(await searchInput.isVisible())) {
      searchInput = page.locator('input[placeholder*="Search"]').first();
    }
    if (!(await searchInput.isVisible())) {
      searchInput = page.locator('.MuiInputBase-input').first();
    }

    await searchInput.fill('Electronic Pulse');
    await page.waitForTimeout(1000);

    // Now the track should be visible
    const trackRow = await page.locator('[data-track-id="test-large-004"]');
    await trackRow.waitFor({ state: 'visible', timeout: 5000 });
    await trackRow.click({ button: 'right' });

    // Click "Add to Playlist" in the context menu
    await page.click('[data-testid="add-to-playlist-menu-item"]');

    // Wait for the playlist selection dialog to appear
    await page.waitForTimeout(500);

    // Select the "Test Playlist" playlist (from fixture data)
    // The fixture data has playlist-1 which is "Test Playlist"
    await page.click('[data-testid="playlist-option-playlist-1"]');

    // Wait for the operation to complete
    await page.waitForTimeout(1500);

    // Clear the search before navigating to playlist
    const searchInputToClear = page.locator('input[type="search"]').first();
    if (await searchInputToClear.isVisible()) {
      await searchInputToClear.clear();
      await page.waitForTimeout(500);
    }

    // Now navigate to the playlist view to verify the track was added
    // Click on "Test Playlist" in the sidebar
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(500);

    // Verify that test-large-004 is now in the playlist
    const addedTrack = await page.locator('[data-track-id="test-large-004"]');
    await addedTrack.waitFor({ state: 'visible', timeout: 5000 });

    // Also count the tracks to verify we have 4 now (started with 3)
    const trackRows = await page.locator('[data-track-id]').count();
    expect(trackRows).toBe(4);

    await TestHelpers.closeApp(app);
  });

  test('should remove songs from a custom playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to the "Test Playlist" which has 3 tracks (test-large-001, test-large-002, test-large-003)
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(500);

    // Verify we start with 3 tracks
    let trackRows = await page.locator('[data-track-id]').count();
    expect(trackRows).toBe(3);

    // Right-click on test-large-001 to open context menu
    const trackRow = await page.locator('[data-track-id="test-large-001"]');
    await trackRow.click({ button: 'right' });

    // Set up dialog handler BEFORE clicking
    page.once('dialog', (dialog) => dialog.accept());

    // Click "Remove from Playlist" in the context menu
    await page.click('[data-testid="remove-from-playlist-menu-item"]');

    // Wait for the operation to complete
    await page.waitForTimeout(1500);

    // Verify that test-large-001 is no longer in the playlist
    const removedTrack = await page.locator('[data-track-id="test-large-001"]');
    await removedTrack.waitFor({ state: 'hidden', timeout: 5000 });

    // Also count the tracks to verify we have 2 now (started with 3)
    trackRows = await page.locator('[data-track-id]').count();
    expect(trackRows).toBe(2);

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

    // Wait for the UI to update
    await page.waitForTimeout(1000);

    // Verify the playlist name was updated in the sidebar
    // Look for the playlist by its data-playlist-id and check it contains the new name
    const renamedPlaylist = await page.locator(
      '[data-playlist-id="playlist-1"]:has-text("Renamed Test Playlist")',
    );
    await renamedPlaylist.waitFor({ state: 'visible', timeout: 5000 });

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

    // Wait for the playlist to be removed from the UI
    await page.waitForTimeout(1500);

    // Verify the playlist no longer exists in the sidebar
    await playlistItem.waitFor({ state: 'hidden', timeout: 5000 });

    // Also verify by checking that there's no element with that data-playlist-id
    const deletedPlaylist = await page.locator(
      '[data-playlist-id="playlist-2"]',
    );
    const count = await deletedPlaylist.count();
    expect(count).toBe(0);

    await TestHelpers.closeApp(app);
  });
});
