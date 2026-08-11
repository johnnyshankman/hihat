import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Search for a track by title, returning the first matching row.
 */
async function searchForTrack(
  page: import('@playwright/test').Page,
  title: string,
) {
  await page.click('[data-testid="nav-library"]');
  await TestHelpers.waitForTracks(page);

  await page.locator('[aria-label="Show/Hide search"]').click();
  await page.locator('[data-testid="search-input"]').fill(title);
  // These titles are unique in the fixture, so a single matching row is the
  // signal that the debounced filter has landed.
  await TestHelpers.waitForTrackCount(page, 1);

  return page.locator('[data-track-id]').first();
}

test.describe('Audio Format Support', () => {
  test.describe('Display', () => {
    test('FLAC track displays correct metadata', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test FLAC Song');

      await expect(track).toBeVisible();
      await expect(track).toContainText('Test FLAC Song');
      await expect(track).toContainText('Test Artist');
      await expect(track).toContainText('Test Album');

      await TestHelpers.closeApp(app);
    });

    test('WAV track displays correct metadata', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test WAV Song');

      await expect(track).toBeVisible();
      await expect(track).toContainText('Test WAV Song');
      await expect(track).toContainText('Test Artist');
      await expect(track).toContainText('Test Album');

      await TestHelpers.closeApp(app);
    });

    test('OGG track displays correct metadata', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test OGG Song');

      await expect(track).toBeVisible();
      await expect(track).toContainText('Test OGG Song');
      await expect(track).toContainText('Test Artist');
      await expect(track).toContainText('Test Album');

      await TestHelpers.closeApp(app);
    });

    test('AAC track displays correct metadata', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test AAC Song');

      await expect(track).toBeVisible();
      await expect(track).toContainText('Test AAC Song');
      await expect(track).toContainText('Test Artist');
      await expect(track).toContainText('Test Album');

      await TestHelpers.closeApp(app);
    });
  });

  test.describe('Playback', () => {
    test('FLAC track plays successfully', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test FLAC Song');

      await TestHelpers.startPlayback(page, track);

      await TestHelpers.closeApp(app);
    });

    test('WAV track plays successfully', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test WAV Song');

      await TestHelpers.startPlayback(page, track);

      await TestHelpers.closeApp(app);
    });

    test('OGG track plays successfully', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test OGG Song');

      await TestHelpers.startPlayback(page, track);

      await TestHelpers.closeApp(app);
    });

    // NOTE: Raw ADTS .aac files may not play in Gapless-5 (Web Audio API).
    // The M4A format (AAC in MP4 container) is already tested and known to work.
    test('AAC track plays successfully', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test AAC Song');

      await TestHelpers.startPlayback(page, track);

      await TestHelpers.closeApp(app);
    });
  });

  test.describe('Metadata Editing', () => {
    test('FLAC metadata can be edited and saved', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test FLAC Song');

      // Right-click and open Edit Metadata
      await track.click({ button: 'right' });
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();
      await menu.getByText('Edit Metadata', { exact: true }).click();
      await expect(
        page.locator('[data-testid="edit-metadata-dialog"]'),
      ).toBeVisible();

      // Change the title
      const titleInput = page.locator('[data-testid="metadata-title-input"]');
      await titleInput.fill('Edited FLAC Title');

      // Save
      await page.click('[data-testid="save-metadata-button"]');
      await expect(
        page.locator('[data-testid="edit-metadata-dialog"]'),
      ).toBeHidden();

      // Verify success notification
      const notificationPanel = page.locator(
        '[data-testid="notification-panel"]',
      );
      await expect(notificationPanel).toBeVisible({ timeout: 5000 });
      const notificationText = notificationPanel.locator(
        '[data-testid="notification-item"]',
      );
      await expect(notificationText.first()).toContainText(
        'Metadata updated successfully',
      );

      // Search for the new title to verify it persisted
      await page
        .locator('[data-testid="search-input"]')
        .fill('Edited FLAC Title');
      await TestHelpers.waitForTrackCount(page, 1);
      await expect(page.locator('[data-track-id]').first()).toContainText(
        'Edited FLAC Title',
      );

      await TestHelpers.closeApp(app);
    });

    test('OGG metadata can be edited and saved', async () => {
      const { app, page } = await TestHelpers.launchApp();
      const track = await searchForTrack(page, 'Test OGG Song');

      // Right-click and open Edit Metadata
      await track.click({ button: 'right' });
      const menu = page.locator('[role="menu"]');
      await expect(menu).toBeVisible();
      await menu.getByText('Edit Metadata', { exact: true }).click();
      await expect(
        page.locator('[data-testid="edit-metadata-dialog"]'),
      ).toBeVisible();

      // Change the title
      const titleInput = page.locator('[data-testid="metadata-title-input"]');
      await titleInput.fill('Edited OGG Title');

      // Save
      await page.click('[data-testid="save-metadata-button"]');
      await expect(
        page.locator('[data-testid="edit-metadata-dialog"]'),
      ).toBeHidden();

      // Verify success notification
      const notificationPanel = page.locator(
        '[data-testid="notification-panel"]',
      );
      await expect(notificationPanel).toBeVisible({ timeout: 5000 });
      const notificationText = notificationPanel.locator(
        '[data-testid="notification-item"]',
      );
      await expect(notificationText.first()).toContainText(
        'Metadata updated successfully',
      );

      // Search for the new title to verify it persisted
      await page
        .locator('[data-testid="search-input"]')
        .fill('Edited OGG Title');
      await TestHelpers.waitForTrackCount(page, 1);
      await expect(page.locator('[data-track-id]').first()).toContainText(
        'Edited OGG Title',
      );

      await TestHelpers.closeApp(app);
    });
  });
});
