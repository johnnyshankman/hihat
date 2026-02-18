import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Basic Functionality', () => {
  test('should navigate between views', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to fully load
    await page.waitForTimeout(3000);

    // 1. Start in Library view - verify we see tracks
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });
    const initialTrackCount = await page.locator('[data-track-id]').count();
    expect(initialTrackCount).toBeGreaterThan(0);

    // 2. Navigate to a Playlist view by clicking a playlist name
    // Click on "Test Playlist" from fixture data
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(1000);

    // Verify we're in playlist view (tracks should still be visible but filtered)
    const playlistTracks = await page.locator('[data-track-id]').count();
    expect(playlistTracks).toBeGreaterThan(0);

    // 3. Navigate to Settings by clicking the settings cog icon
    // Sidebar stays open now, so no need to re-open it
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(1000);

    // Verify we're in Settings view - check for settings heading
    const settingsHeading = await page.getByRole('heading', {
      name: 'Settings',
    });
    await expect(settingsHeading).toBeVisible();

    // Close the Settings drawer before navigating
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 4. Navigate back to Library view by clicking "All" button
    // Sidebar is still open, so click directly
    await page.locator('[data-view="library"]').click();
    await page.waitForTimeout(1000);

    // Verify we're back in Library view with all tracks
    const finalTrackCount = await page.locator('[data-track-id]').count();
    expect(finalTrackCount).toBeGreaterThan(0);
    expect(finalTrackCount).toBe(initialTrackCount); // Should have same tracks as before

    await TestHelpers.closeApp(app);
  });
});
