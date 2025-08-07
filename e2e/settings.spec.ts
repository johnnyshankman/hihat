import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Settings', () => {
  test('should navigate to settings', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.navigateToView(page, 'settings');
    
    const settingsView = await page.locator('[data-testid="settings-view"]');
    expect(await settingsView.isVisible()).toBe(true);
    
    await TestHelpers.takeScreenshot(page, 'settings-view');
    
    await TestHelpers.closeApp(app);
  });

  test('should change theme', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.navigateToView(page, 'settings');
    
    const initialTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(500);
    
    const newTheme = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(newTheme).not.toBe(initialTheme);
    
    await TestHelpers.takeScreenshot(page, 'theme-changed');
    
    await TestHelpers.closeApp(app);
  });

  test('should manage library folders', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.navigateToView(page, 'settings');
    
    await page.click('[data-testid="add-folder-button"]');
    
    const folderDialog = await page.locator('[data-testid="folder-dialog"]');
    expect(await folderDialog.isVisible()).toBe(true);
    
    await page.click('[data-testid="cancel-folder-button"]');
    
    const folders = await page.locator('[data-testid^="library-folder-"]').count();
    expect(folders).toBeGreaterThanOrEqual(0);
    
    await TestHelpers.closeApp(app);
  });

  test('should configure audio settings', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.navigateToView(page, 'settings');
    
    const gaplessToggle = await page.locator('[data-testid="gapless-playback-toggle"]');
    const initialGapless = await gaplessToggle.isChecked();
    
    await gaplessToggle.click();
    await page.waitForTimeout(500);
    
    const newGapless = await gaplessToggle.isChecked();
    expect(newGapless).toBe(!initialGapless);
    
    const crossfadeSlider = await page.locator('[data-testid="crossfade-slider"]');
    await crossfadeSlider.fill('5');
    
    const crossfadeValue = await crossfadeSlider.inputValue();
    expect(parseInt(crossfadeValue)).toBe(5);
    
    await TestHelpers.closeApp(app);
  });

  test('should export library data', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);
    
    await TestHelpers.navigateToView(page, 'settings');
    
    await page.click('[data-testid="export-library-button"]');
    
    const exportDialog = await page.locator('[data-testid="export-dialog"]');
    expect(await exportDialog.isVisible()).toBe(true);
    
    await page.click('[data-testid="export-json-button"]');
    
    await page.waitForTimeout(1000);
    
    const successMessage = await page.locator('[data-testid="export-success-message"]');
    expect(await successMessage.isVisible()).toBe(true);
    
    await TestHelpers.closeApp(app);
  });

  test('should clear cache', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.navigateToView(page, 'settings');
    
    await page.click('[data-testid="clear-cache-button"]');
    
    const confirmDialog = await page.locator('[data-testid="confirm-clear-cache-dialog"]');
    expect(await confirmDialog.isVisible()).toBe(true);
    
    await page.click('[data-testid="confirm-clear-button"]');
    
    await page.waitForTimeout(1000);
    
    const successMessage = await page.locator('[data-testid="cache-cleared-message"]');
    expect(await successMessage.isVisible()).toBe(true);
    
    await TestHelpers.closeApp(app);
  });

  test('should display app version', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.navigateToView(page, 'settings');
    
    const versionText = await page.locator('[data-testid="app-version"]').textContent();
    expect(versionText).toMatch(/\d+\.\d+\.\d+/);
    
    const appVersion = await app.evaluate(async ({ app }) => {
      return app.getVersion();
    });
    
    expect(versionText).toContain(appVersion);
    
    await TestHelpers.closeApp(app);
  });
});