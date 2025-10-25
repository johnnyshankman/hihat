import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Application Launch', () => {
  test('should launch the application successfully', async () => {
    const { app } = await TestHelpers.launchApp();

    const title = await app.evaluate(async ({ app: electronApp }) => {
      return electronApp.getName();
    });

    expect(title).toBe('hihat');

    const windowState = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {
        isVisible: window.isVisible(),
        isDevToolsOpened: window.webContents.isDevToolsOpened(),
        isCrashed: window.webContents.isCrashed(),
      };
    });

    expect(windowState.isVisible).toBe(true);
    expect(windowState.isCrashed).toBe(false);

    await TestHelpers.closeApp(app);
  });

  test('should display default main UI components', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // 1. Check for sidebar/drawer
    const drawer = await page.locator('.MuiDrawer-root').isVisible();
    expect(drawer).toBe(true);

    // 2. Check for Library section header in sidebar
    const libraryHeader = await page.getByText('Library', { exact: false });
    expect(await libraryHeader.count()).toBeGreaterThan(0);

    // 3. Check for "All" library button (the actual clickable library view button)
    const allLibraryButton = await page
      .locator('[data-view="library"]')
      .isVisible();
    expect(allLibraryButton).toBe(true);

    // 4. Check for Playlists section header in sidebar
    const playlistsHeader = await page.getByText('Playlists', { exact: false });
    expect(await playlistsHeader.count()).toBeGreaterThan(0);

    // 5. Check for playlist items from fixture data (should have 5 playlists)
    const playlistItems = await page.locator('[data-playlist-id]').count();
    expect(playlistItems).toBeGreaterThanOrEqual(5);

    // 6. Check for Settings button
    const settingsButton = await page
      .getByRole('button', { name: 'Settings' })
      .isVisible();
    expect(settingsButton).toBe(true);

    // 7. Check for main content area (Library view should be default)
    const mainContent = await page.locator('main').isVisible();
    expect(mainContent).toBe(true);

    // 8. Check for MaterialReactTable with tracks from fixture data
    // MaterialReactTable uses virtualization, so we check for track rows by data-track-id
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const trackRows = await page.locator('[data-track-id]').count();
    expect(trackRows).toBeGreaterThan(0);

    // 9. Check for Player component at bottom
    const player = await page.locator('.MuiBox-root').last().isVisible();
    expect(player).toBe(true);

    await TestHelpers.takeScreenshot(page, 'main-ui');

    await TestHelpers.closeApp(app);
  });

  test('should handle window controls', async () => {
    const { app } = await TestHelpers.launchApp();

    // Get initial window state
    const initialState = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {
        bounds: window.getBounds(),
        isVisible: window.isVisible(),
        isMaximized: window.isMaximized(),
      };
    });

    expect(initialState.isVisible).toBe(true);

    // Test maximize/unmaximize
    await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.maximize();
    });

    const maximizedState = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window.isMaximized();
    });

    expect(maximizedState).toBe(true);

    await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.unmaximize();
    });

    const unmaximizedState = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window.isMaximized();
    });

    expect(unmaximizedState).toBe(false);

    // Verify window is still functional after operations
    const finalState = await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {
        isVisible: window.isVisible(),
        isCrashed: window.webContents.isCrashed(),
      };
    });

    expect(finalState.isVisible).toBe(true);
    expect(finalState.isCrashed).toBe(false);

    await TestHelpers.closeApp(app);
  });
});
