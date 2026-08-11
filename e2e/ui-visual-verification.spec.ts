import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Resize the Electron window and wait until the renderer has actually laid out
 * at the new size. Comparing `window.innerWidth` against the main process's
 * content size is exact and survives clamping to the window's min size, so
 * there is nothing to sleep for before screenshotting.
 */
async function resizeWindow(
  app: ElectronApplication,
  page: Page,
  width: number,
  height: number,
) {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0].setSize(size.width, size.height);
    },
    { width, height },
  );

  await expect
    .poll(async () => {
      const [contentWidth, contentHeight] = await app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].getContentSize(),
      );
      const inner = await page.evaluate(() => [
        window.innerWidth,
        window.innerHeight,
      ]);
      return inner[0] === contentWidth && inner[1] === contentHeight;
    })
    .toBe(true);
}

const SEARCH_TOGGLE = '[aria-label="Show/Hide search"]';
const SEARCH_INPUT = '[data-testid="search-input"]';

test.describe('UI Visual Verification', () => {
  test('full size (1280x800) - library with sidebar open', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Set window to full size
    await resizeWindow(app, page, 1280, 800);

    // Verify sidebar is open and library is visible
    await expect(page.locator('[data-testid="nav-library"]')).toBeVisible();
    await expect(page.locator('[data-track-id]').first()).toBeVisible();

    await TestHelpers.takeScreenshot(page, 'ui-full-1280x800-library');

    await TestHelpers.closeApp(app);
  });

  test('medium size (900x600) - sidebar open, toolbar check', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 900, 600);

    // Sidebar should be open
    await expect(page.locator('[data-testid="nav-library"]')).toBeVisible();

    // Toolbar should be visible and not overflowing
    const toolbar = page.locator('.MuiToolbar-root, [class*="TopToolbar"]');
    if ((await toolbar.count()) > 0) {
      await expect(toolbar.first()).toBeVisible();
    }

    await TestHelpers.takeScreenshot(page, 'ui-medium-900x600-library');

    await TestHelpers.closeApp(app);
  });

  test('minimum size (640x400) - sidebar open and closed', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 640, 400);

    // Screenshot with sidebar open at minimum size
    await TestHelpers.takeScreenshot(page, 'ui-min-640x400-sidebar-open');

    // Close sidebar
    await page.locator('[data-testid="sidebar-toggle-close"]').click();
    await expect(page.locator('[data-testid="nav-library"]')).toBeHidden();

    // Screenshot with sidebar closed at minimum size
    await TestHelpers.takeScreenshot(page, 'ui-min-640x400-sidebar-closed');

    // Verify tracks are still visible
    await expect(page.locator('[data-track-id]').first()).toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('settings slide-over panel', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 1280, 800);

    // Open settings via the gear button
    await page.locator('[data-testid="nav-settings"]').click();

    // Verify settings panel is visible
    await expect(page.locator('[data-testid="settings-view"]')).toBeVisible();

    // Verify Settings heading
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await TestHelpers.takeScreenshot(page, 'ui-settings-slideover');

    await TestHelpers.closeApp(app);
  });

  test('search bar toggle - open, type, and close', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 1280, 800);

    // Screenshot before opening search
    await TestHelpers.takeScreenshot(page, 'ui-search-1-before-open');

    // Click the search toggle button
    const searchToggle = page.locator(SEARCH_TOGGLE);
    await expect(searchToggle).toBeVisible();
    await searchToggle.click();
    await expect(page.locator(SEARCH_INPUT)).toBeVisible();

    // Screenshot with search bar open (empty)
    await TestHelpers.takeScreenshot(page, 'ui-search-2-open-empty');

    // Type into the search field
    const searchInput = page.locator(SEARCH_INPUT);
    await searchInput.fill('Test');
    await expect(searchInput).toHaveValue('Test');

    // Screenshot with search bar open and text typed
    await TestHelpers.takeScreenshot(page, 'ui-search-3-open-with-text');

    // Close search by clicking the toggle button again
    await searchToggle.click();
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();

    // Screenshot after closing search - check for doubling/whitespace
    await TestHelpers.takeScreenshot(page, 'ui-search-4-after-close');

    await TestHelpers.closeApp(app);
  });

  test('search bar at minimum size (640x400)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 640, 400);

    // Screenshot before opening search at small size
    await TestHelpers.takeScreenshot(page, 'ui-search-min-1-before');

    // Click the search toggle button
    const searchToggle = page.locator(SEARCH_TOGGLE);
    await expect(searchToggle).toBeVisible();
    await searchToggle.click();
    await expect(page.locator(SEARCH_INPUT)).toBeVisible();

    // Screenshot with search bar open at small size
    await TestHelpers.takeScreenshot(page, 'ui-search-min-2-open');

    // Close search
    await searchToggle.click();
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();

    // Screenshot after closing search at small size
    await TestHelpers.takeScreenshot(page, 'ui-search-min-3-after-close');

    await TestHelpers.closeApp(app);
  });

  test('compact layout - row density verification', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 1280, 800);

    // Verify that rows are visible (Apple Music-matched 22px rows)
    await expect
      .poll(() => page.locator('[data-track-id]').count())
      .toBeGreaterThanOrEqual(20);

    await TestHelpers.takeScreenshot(page, 'ui-compact-row-density');

    await TestHelpers.closeApp(app);
  });

  test('compact layout - sidebar density verification', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await resizeWindow(app, page, 1280, 800);

    // Verify sidebar is visible
    await expect(page.locator('[data-testid="nav-library"]')).toBeVisible();

    // Verify playlist items are present in sidebar
    await expect(page.locator('[data-playlist-id]').first()).toBeVisible();

    await TestHelpers.takeScreenshot(page, 'ui-compact-sidebar-density');

    await TestHelpers.closeApp(app);
  });

  test('playlist view with unified toolbar', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Click on a playlist
    await page.getByText('Test Playlist', { exact: true }).click();
    await TestHelpers.waitForTrackCount(page, 3);

    // Verify sidebar stayed open (Phase 1)
    await expect(page.locator('[data-testid="nav-library"]')).toBeVisible();

    // Title is hidden when sidebar is open (matches SidebarToggle pattern).
    // Close sidebar so the playlist name becomes visible for this assertion.
    await page.locator('[data-testid="sidebar-toggle-close"]').click();

    const playlistHeading = page.locator('h2');
    await expect(playlistHeading).toContainText('Test Playlist');

    await TestHelpers.takeScreenshot(page, 'ui-playlist-unified-toolbar');

    await TestHelpers.closeApp(app);
  });
});
