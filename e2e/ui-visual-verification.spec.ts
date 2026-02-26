import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('UI Visual Verification', () => {
  test('full size (1280x800) - library with sidebar open', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    // Set window to full size
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1280, 800);
    });
    await page.waitForTimeout(500);

    // Verify sidebar is open and library is visible
    expect(await page.locator('[data-testid="nav-library"]').isVisible()).toBe(
      true,
    );
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThan(0);

    await TestHelpers.takeScreenshot(page, 'ui-full-1280x800-library');

    await TestHelpers.closeApp(app);
  });

  test('medium size (900x600) - sidebar open, toolbar check', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(900, 600);
    });
    await page.waitForTimeout(500);

    // Sidebar should be open
    expect(await page.locator('[data-testid="nav-library"]').isVisible()).toBe(
      true,
    );

    // Toolbar should be visible and not overflowing
    const toolbar = page.locator('.MuiToolbar-root, [class*="TopToolbar"]');
    if ((await toolbar.count()) > 0) {
      const firstToolbar = toolbar.first();
      await expect(firstToolbar).toBeVisible();
    }

    await TestHelpers.takeScreenshot(page, 'ui-medium-900x600-library');

    await TestHelpers.closeApp(app);
  });

  test('minimum size (640x400) - sidebar open and closed', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(640, 400);
    });
    await page.waitForTimeout(500);

    // Screenshot with sidebar open at minimum size
    await TestHelpers.takeScreenshot(page, 'ui-min-640x400-sidebar-open');

    // Close sidebar
    await page.locator('[data-testid="sidebar-toggle-close"]').click();
    await page.waitForTimeout(500);

    // Screenshot with sidebar closed at minimum size
    await TestHelpers.takeScreenshot(page, 'ui-min-640x400-sidebar-closed');

    // Verify tracks are still visible
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });

  test('settings slide-over panel', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1280, 800);
    });
    await page.waitForTimeout(500);

    // Open settings via the gear button
    await page.locator('[data-testid="nav-settings"]').click();
    await page.waitForTimeout(500);

    // Verify settings panel is visible
    const settingsView = page.locator('[data-testid="settings-view"]');
    await expect(settingsView).toBeVisible();

    // Verify Settings heading
    const settingsHeader = page.getByRole('heading', { name: 'Settings' });
    await expect(settingsHeader).toBeVisible();

    await TestHelpers.takeScreenshot(page, 'ui-settings-slideover');

    await TestHelpers.closeApp(app);
  });

  test('search bar toggle - open, type, and close', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1280, 800);
    });
    await page.waitForTimeout(500);

    // Screenshot before opening search
    await TestHelpers.takeScreenshot(page, 'ui-search-1-before-open');

    // Click the search toggle button
    const searchToggle = page.locator('[aria-label="Show/Hide search"]');
    await expect(searchToggle).toBeVisible({ timeout: 5000 });
    await searchToggle.click();
    await page.waitForTimeout(500);

    // Screenshot with search bar open (empty)
    await TestHelpers.takeScreenshot(page, 'ui-search-2-open-empty');

    // Type into the search field
    const searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="Filter"], input[placeholder*="Search"]',
      )
      .first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500);
    }

    // Screenshot with search bar open and text typed
    await TestHelpers.takeScreenshot(page, 'ui-search-3-open-with-text');

    // Close search by clicking the toggle button again
    await searchToggle.click();
    await page.waitForTimeout(500);

    // Screenshot after closing search - check for doubling/whitespace
    await TestHelpers.takeScreenshot(page, 'ui-search-4-after-close');

    await TestHelpers.closeApp(app);
  });

  test('search bar at minimum size (640x400)', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(640, 400);
    });
    await page.waitForTimeout(500);

    // Screenshot before opening search at small size
    await TestHelpers.takeScreenshot(page, 'ui-search-min-1-before');

    // Click the search toggle button
    const searchToggle = page.locator('[aria-label="Show/Hide search"]');
    if (await searchToggle.isVisible()) {
      await searchToggle.click();
      await page.waitForTimeout(500);
    }

    // Screenshot with search bar open at small size
    await TestHelpers.takeScreenshot(page, 'ui-search-min-2-open');

    // Close search
    if (await searchToggle.isVisible()) {
      await searchToggle.click();
      await page.waitForTimeout(500);
    }

    // Screenshot after closing search at small size
    await TestHelpers.takeScreenshot(page, 'ui-search-min-3-after-close');

    await TestHelpers.closeApp(app);
  });

  test('compact layout - row density verification', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1280, 800);
    });
    await page.waitForTimeout(500);

    // Verify that rows are visible (Apple Music-matched 22px rows)
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThanOrEqual(20);

    await TestHelpers.takeScreenshot(page, 'ui-compact-row-density');

    await TestHelpers.closeApp(app);
  });

  test('compact layout - sidebar density verification', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1280, 800);
    });
    await page.waitForTimeout(500);

    // Verify sidebar is visible
    expect(await page.locator('[data-testid="nav-library"]').isVisible()).toBe(
      true,
    );

    // Verify playlist items are present in sidebar
    const playlistCount = await page.locator('[data-playlist-id]').count();
    expect(playlistCount).toBeGreaterThan(0);

    await TestHelpers.takeScreenshot(page, 'ui-compact-sidebar-density');

    await TestHelpers.closeApp(app);
  });

  test('playlist view with unified toolbar', async () => {
    const { app, page } = await TestHelpers.launchApp();
    await page.waitForTimeout(3000);

    // Click on a playlist
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Verify sidebar stayed open (Phase 1)
    expect(await page.locator('[data-testid="nav-library"]').isVisible()).toBe(
      true,
    );

    // Verify playlist heading is visible
    const playlistHeading = page.locator('h2');
    await expect(playlistHeading).toContainText('Test Playlist');

    await TestHelpers.takeScreenshot(page, 'ui-playlist-unified-toolbar');

    await TestHelpers.closeApp(app);
  });
});
