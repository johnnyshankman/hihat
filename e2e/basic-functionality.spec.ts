import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Basic Functionality', () => {
  test('should navigate between views', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // 1. Start in Library view - verify we see tracks
    const initialTrackCount = await page.locator('[data-track-id]').count();
    expect(initialTrackCount).toBeGreaterThan(0);

    // 2. Navigate to a Playlist view by clicking a playlist name
    // Click on "Test Playlist" from fixture data
    await page.getByText('Test Playlist', { exact: true }).click();

    // Verify we're in playlist view (tracks should still be visible but filtered)
    // The fixture playlist holds 3 of the 200 library tracks, so waiting for the
    // count to drop is a precise "the view swapped" signal.
    await TestHelpers.waitForTrackCount(page, 3);

    // 3. Navigate to Settings by clicking the settings cog icon
    // Sidebar stays open now, so no need to re-open it
    await page.getByRole('button', { name: 'Settings' }).click();

    // Verify we're in Settings view - check for settings heading
    const settingsHeading = page.getByRole('heading', { name: 'Settings' });
    await expect(settingsHeading).toBeVisible();

    // Close the Settings drawer before navigating
    await page.keyboard.press('Escape');
    await expect(settingsHeading).toBeHidden();

    // 4. Navigate back to Library view by clicking "All" button
    // Sidebar is still open, so click directly
    await page.locator('[data-view="library"]').click();

    // Verify we're back in Library view with all tracks
    await TestHelpers.waitForTrackCount(page, initialTrackCount);

    await TestHelpers.closeApp(app);
  });
});
