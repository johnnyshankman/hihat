import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Application Launch', () => {
  test('should launch the application successfully', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    const title = await app.evaluate(async ({ app }) => {
      return app.getName();
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

  test('should display main UI components', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    // Check for MUI Drawer (sidebar)
    const sidebar = await page.locator('.MuiDrawer-root').first().isVisible();
    expect(sidebar).toBe(true);
    
    // Check for navigation buttons in drawer
    const libraryButton = await page.getByRole('button', { name: 'Library' }).isVisible();
    expect(libraryButton).toBe(true);
    
    const playlistButton = await page.getByRole('button', { name: 'Playlists' }).isVisible();
    expect(playlistButton).toBe(true);
    
    // Check for main content area
    const mainContent = await page.locator('.MuiBox-root').first().isVisible();
    expect(mainContent).toBe(true);
    
    // Check for table (library view)
    const hasTable = await page.locator('.MuiTable-root').count();
    expect(hasTable).toBeGreaterThan(0);
    
    await TestHelpers.takeScreenshot(page, 'main-ui');
    
    await TestHelpers.closeApp(app);
  });

  test('should handle window controls', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
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