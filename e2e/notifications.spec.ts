import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Notification System', () => {
  test('should always show notification bell icon', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Bell icon should be visible immediately, before any notifications
    const bell = page.locator('[data-testid="notification-button"]');
    await bell.waitFor({ state: 'visible', timeout: 5000 });

    // Badge should have the invisible class (no notifications yet)
    const badge = bell.locator('.MuiBadge-badge');
    await expect(badge).toHaveClass(/MuiBadge-invisible/);

    // Trigger a notification by adding a track to a playlist
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    // Badge should no longer have the invisible class
    await expect(badge).not.toHaveClass(/MuiBadge-invisible/);

    await TestHelpers.closeApp(app);
  });

  test('should show notification when adding a track to a playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Right-click on the first visible track in the library to open context menu
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click({ button: 'right' });

    // Click "Add to Playlist" then select "Test Playlist"
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    // Panel should auto-expand with the notification
    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Verify notification text
    const item = panel.locator('[data-testid="notification-item"]');
    await expect(item).toBeVisible();
    await expect(item).toContainText('Added');
    await expect(item).toContainText('Test Playlist');

    await TestHelpers.closeApp(app);
  });

  test('should stack multiple notifications', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for renderer to fully boot so the e2e store hook is installed.
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).HIHAT_E2E_UI_STORE !==
        undefined,
      undefined,
      { timeout: 5000 },
    );

    // Seed two notifications directly via the store hook. The right-click +
    // add-to-playlist trigger flow is already exercised by the surrounding
    // single-notification specs (bell-icon, notification-text, dismiss,
    // panel-toggle, panel-close); this test only needs two items present to
    // exercise stacking UI. Driving the trigger twice in succession races
    // with the auto-opened panel overlay (issue #98).
    await page.evaluate(() => {
      type UIStoreActions = {
        clearAllNotifications: () => void;
        showNotification: (
          m: string,
          t: 'info' | 'success' | 'warning' | 'error',
        ) => void;
        setNotificationPanelOpen: (open: boolean) => void;
      };
      const winRecord = window as unknown as Record<string, unknown>;
      const store = (
        winRecord.HIHAT_E2E_UI_STORE as { getState: () => UIStoreActions }
      ).getState();
      store.clearAllNotifications();
      store.showNotification('First test notification', 'success');
      store.showNotification('Second test notification', 'success');
      store.setNotificationPanelOpen(true);
    });

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    const items = panel.locator('[data-testid="notification-item"]');
    await expect(items).toHaveCount(2);

    await TestHelpers.closeApp(app);
  });

  test('should dismiss a single notification', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click the dismiss X on the notification
    const dismissButton = panel
      .locator('[data-testid="notification-dismiss"]')
      .first();
    await dismissButton.click();

    // Wait for fade-out animation
    await page.waitForTimeout(300);

    // No items should remain
    const items = panel.locator('[data-testid="notification-item"]');
    await expect(items).toHaveCount(0);

    await TestHelpers.closeApp(app);
  });

  test('should clear all notifications', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for renderer to fully boot so the e2e store hook is installed.
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    await page.waitForFunction(
      () =>
        (window as unknown as Record<string, unknown>).HIHAT_E2E_UI_STORE !==
        undefined,
      undefined,
      { timeout: 5000 },
    );

    // Seed two notifications directly via the store hook (see "should stack
    // multiple notifications" for rationale — issue #98).
    await page.evaluate(() => {
      type UIStoreActions = {
        clearAllNotifications: () => void;
        showNotification: (
          m: string,
          t: 'info' | 'success' | 'warning' | 'error',
        ) => void;
        setNotificationPanelOpen: (open: boolean) => void;
      };
      const winRecord = window as unknown as Record<string, unknown>;
      const store = (
        winRecord.HIHAT_E2E_UI_STORE as { getState: () => UIStoreActions }
      ).getState();
      store.clearAllNotifications();
      store.showNotification('First test notification', 'success');
      store.showNotification('Second test notification', 'success');
      store.setNotificationPanelOpen(true);
    });

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click Clear
    await page.click('[data-testid="notification-clear-all"]');
    await panel.waitFor({ state: 'hidden', timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('should toggle panel open and closed via bell icon', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification so panel auto-opens
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click bell icon to close the panel
    await page.click('[data-testid="notification-button"]');
    await panel.waitFor({ state: 'hidden', timeout: 5000 });

    // Click bell icon again to re-open the panel
    await page.click('[data-testid="notification-button"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('should close panel with close button', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click the close button
    await page.click('[data-testid="notification-close"]');
    await panel.waitFor({ state: 'hidden', timeout: 5000 });

    await TestHelpers.closeApp(app);
  });

  test('should truncate long notification text with ellipsis', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification via a real action
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Verify the notification text element has ellipsis overflow styles
    const item = panel.locator('[data-testid="notification-item"]').first();
    await expect(item).toBeVisible();

    const textOverflow = await item
      .locator('p')
      .first()
      .evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          whiteSpace: style.whiteSpace,
          overflow: style.overflow,
          textOverflow: style.textOverflow,
        };
      });

    expect(textOverflow.whiteSpace).toBe('nowrap');
    expect(textOverflow.overflow).toBe('hidden');
    expect(textOverflow.textOverflow).toBe('ellipsis');

    await TestHelpers.closeApp(app);
  });
});
