import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Notification System', () => {
  test('should show notification when adding a track to a playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Right-click on a track in the library to open context menu
    const trackRow = page.locator('[data-track-id="test-large-004"]');
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

    // Add a track to a playlist (first notification)
    const trackRow4 = page.locator('[data-track-id="test-large-004"]');
    await trackRow4.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    // Add another track to a playlist (second notification)
    const trackRow5 = page.locator('[data-track-id="test-large-005"]');
    await trackRow5.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    // Verify multiple items in the panel
    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    const items = panel.locator('[data-testid="notification-item"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await TestHelpers.closeApp(app);
  });

  test('should dismiss a single notification', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification
    const trackRow = page.locator('[data-track-id="test-large-004"]');
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

    // Trigger two notifications
    const trackRow4 = page.locator('[data-track-id="test-large-004"]');
    await trackRow4.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const trackRow5 = page.locator('[data-track-id="test-large-005"]');
    await trackRow5.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click Clear
    await page.click('[data-testid="notification-clear-all"]');
    await page.waitForTimeout(500);

    // Panel should auto-collapse (not visible)
    await expect(panel).not.toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('should close panel when clicking outside', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification so panel opens
    const trackRow = page.locator('[data-track-id="test-large-004"]');
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click outside the panel (top-left area of the page)
    await page.mouse.click(50, 50);
    await page.waitForTimeout(500);

    // Panel should be closed
    await expect(panel).not.toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('should close panel with close button', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification
    const trackRow = page.locator('[data-track-id="test-large-004"]');
    await trackRow.click({ button: 'right' });
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="notification-panel"]');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    // Click the close button
    await page.click('[data-testid="notification-close"]');
    await page.waitForTimeout(500);

    // Panel should be hidden
    await expect(panel).not.toBeVisible();

    await TestHelpers.closeApp(app);
  });

  test('should truncate long notification text with ellipsis', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Trigger a notification via a real action
    const trackRow = page.locator('[data-track-id="test-large-004"]');
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
