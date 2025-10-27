import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('New User Experience', () => {
  test('should display empty library message for brand new user', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // Check that the empty library message is displayed
    const emptyLibraryMessage = await page.getByText('Your library is empty');
    expect(await emptyLibraryMessage.isVisible()).toBe(true);

    // Verify the helper text is also displayed
    const helperText = await page.getByText(
      'Head to Settings and give hihat access to your music library folder.',
    );
    expect(await helperText.isVisible()).toBe(true);

    // Take a screenshot for visual verification
    await TestHelpers.takeScreenshot(page, 'new-user-empty-library');

    await TestHelpers.closeApp(app);
  });

  test('should have default smart playlists for brand new user', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // Check for the default smart playlists in the sidebar
    // These should be created automatically by the app's self-healing mechanism
    const recentlyAddedPlaylist = await page.getByText('Recently Added');
    expect(await recentlyAddedPlaylist.isVisible()).toBe(true);

    const recentlyPlayedPlaylist = await page.getByText('Recently Played');
    expect(await recentlyPlayedPlaylist.isVisible()).toBe(true);

    const mostPlayedPlaylist = await page.getByText('Most Played');
    expect(await mostPlayedPlaylist.isVisible()).toBe(true);

    // Verify there are exactly 3 playlists (the smart playlists)
    const playlistItems = await page.locator('[data-playlist-id]').count();
    expect(playlistItems).toBe(3);

    await TestHelpers.closeApp(app);
  });

  test('should display basic UI components for brand new user', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // 1. Check for sidebar/drawer
    const drawer = await page.locator('.MuiDrawer-root').isVisible();
    expect(drawer).toBe(true);

    // 2. Check for Library section header in sidebar
    const libraryHeader = await page.getByText('Library', { exact: false });
    expect(await libraryHeader.count()).toBeGreaterThan(0);

    // 3. Check for "All" library button
    const allLibraryButton = await page
      .locator('[data-view="library"]')
      .isVisible();
    expect(allLibraryButton).toBe(true);

    // 4. Check for Playlists section header in sidebar
    const playlistsHeader = await page.getByText('Playlists', { exact: false });
    expect(await playlistsHeader.count()).toBeGreaterThan(0);

    // 5. Check for Settings button
    const settingsButton = await page
      .getByRole('button', { name: 'Settings' })
      .isVisible();
    expect(settingsButton).toBe(true);

    // 6. Check for main content area (Library view should be default)
    const mainContent = await page.locator('main').isVisible();
    expect(mainContent).toBe(true);

    // 7. Check for Player component at bottom (should be visible even with no tracks)
    const player = await page.locator('.MuiBox-root').last().isVisible();
    expect(player).toBe(true);

    await TestHelpers.closeApp(app);
  });

  test('should have no tracks loaded for brand new user', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // Verify there are no track rows in the library
    const trackRows = await page.locator('[data-track-id]').count();
    expect(trackRows).toBe(0);

    // Verify the empty library message is shown instead
    const emptyLibraryMessage = await page.getByText('Your library is empty');
    expect(await emptyLibraryMessage.isVisible()).toBe(true);

    await TestHelpers.closeApp(app);
  });
});
