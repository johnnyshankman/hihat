import { test, expect, type Page, type Locator } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Right-click a track locator and open the Edit Metadata dialog, waiting on the
 * menu and the dialog themselves rather than on fixed delays.
 */
async function openEditMetadataFor(page: Page, track: Locator): Promise<void> {
  await track.click({ button: 'right' });
  const menu = page.locator('[role="menu"]');
  await expect(menu).toBeVisible();
  await menu.getByText('Edit Metadata', { exact: true }).click();
  await expect(
    page.locator('[data-testid="edit-metadata-dialog"]'),
  ).toBeVisible();
}

/**
 * Navigate to library view, wait for tracks, right-click the first track,
 * and open the Edit Metadata dialog. Returns the first track locator.
 */
async function openEditMetadataForFirstTrack(page: Page): Promise<Locator> {
  await page.click('[data-testid="nav-library"]');
  await TestHelpers.waitForTracks(page);

  const firstTrack = page.locator('[data-track-id]').first();
  await openEditMetadataFor(page, firstTrack);

  return firstTrack;
}

/**
 * Right-click a track locator and reopen the Edit Metadata dialog.
 */
async function reopenEditMetadata(page: Page, track: Locator): Promise<void> {
  await openEditMetadataFor(page, track);
}

test.describe('Edit Metadata', () => {
  test('should open Edit Metadata dialog from library context menu', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openEditMetadataForFirstTrack(page);

    // Verify dialog opens
    const dialog = page.locator('[data-testid="edit-metadata-dialog"]');
    await expect(dialog).toBeVisible();

    // Verify all 13 fields are present
    await expect(
      page.locator('[data-testid="metadata-title-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-artist-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-album-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-album-artist-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-genre-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-track-number-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-total-tracks-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-disc-number-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-total-discs-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-year-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-bpm-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-composer-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="metadata-comment-input"]'),
    ).toBeVisible();

    // Close dialog via Cancel
    await page.click('[data-testid="cancel-metadata-button"]');
    await expect(dialog).toBeHidden();

    await TestHelpers.closeApp(app);
  });

  test('should save metadata changes and immediately reflect in library table', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openEditMetadataForFirstTrack(page);

    // Change title, artist, and album
    const titleInput = page.locator('[data-testid="metadata-title-input"]');
    const artistInput = page.locator('[data-testid="metadata-artist-input"]');
    const albumInput = page.locator('[data-testid="metadata-album-input"]');

    await titleInput.fill('Edited Title');
    await artistInput.fill('Edited Artist');
    await albumInput.fill('Edited Album');

    // Click Save
    await page.click('[data-testid="save-metadata-button"]');

    // Verify dialog closed
    await expect(
      page.locator('[data-testid="edit-metadata-dialog"]'),
    ).toBeHidden();

    // Verify the track row in the library table now shows the updated values
    const updatedRow = page.locator('[data-track-id]').first();
    await expect(updatedRow).toContainText('Edited Title');
    await expect(updatedRow).toContainText('Edited Artist');
    await expect(updatedRow).toContainText('Edited Album');

    await TestHelpers.closeApp(app);
  });

  test('should save numeric metadata fields correctly', async () => {
    const { app, page } = await TestHelpers.launchApp();

    const firstTrack = await openEditMetadataForFirstTrack(page);

    // Set numeric fields
    await page.locator('[data-testid="metadata-track-number-input"]').fill('5');
    await page
      .locator('[data-testid="metadata-total-tracks-input"]')
      .fill('12');
    await page.locator('[data-testid="metadata-disc-number-input"]').fill('1');
    await page.locator('[data-testid="metadata-total-discs-input"]').fill('2');
    await page.locator('[data-testid="metadata-year-input"]').fill('2024');
    await page.locator('[data-testid="metadata-bpm-input"]').fill('128');

    // Save
    await page.click('[data-testid="save-metadata-button"]');
    await expect(
      page.locator('[data-testid="edit-metadata-dialog"]'),
    ).toBeHidden();

    // Reopen the dialog for the same track
    await reopenEditMetadata(page, firstTrack);

    // Verify all numeric fields retained their values
    await expect(
      page.locator('[data-testid="metadata-track-number-input"]'),
    ).toHaveValue('5');
    await expect(
      page.locator('[data-testid="metadata-total-tracks-input"]'),
    ).toHaveValue('12');
    await expect(
      page.locator('[data-testid="metadata-disc-number-input"]'),
    ).toHaveValue('1');
    await expect(
      page.locator('[data-testid="metadata-total-discs-input"]'),
    ).toHaveValue('2');
    await expect(
      page.locator('[data-testid="metadata-year-input"]'),
    ).toHaveValue('2024');
    await expect(
      page.locator('[data-testid="metadata-bpm-input"]'),
    ).toHaveValue('128');

    // Close
    await page.click('[data-testid="cancel-metadata-button"]');

    await TestHelpers.closeApp(app);
  });

  test('should save text metadata fields correctly', async () => {
    const { app, page } = await TestHelpers.launchApp();

    const firstTrack = await openEditMetadataForFirstTrack(page);

    // Set text fields (avoid changing albumArtist to a value that would
    // re-sort the track out of first position in the albumArtist sort)
    await page
      .locator('[data-testid="metadata-genre-input"]')
      .fill('Synthwave');
    await page
      .locator('[data-testid="metadata-album-artist-input"]')
      .fill('AAA Test Artist');
    await page
      .locator('[data-testid="metadata-composer-input"]')
      .fill('Test Composer');
    await page
      .locator('[data-testid="metadata-comment-input"]')
      .fill('Test comment');

    // Save
    await page.click('[data-testid="save-metadata-button"]');
    await expect(
      page.locator('[data-testid="edit-metadata-dialog"]'),
    ).toBeHidden();

    // Reopen dialog for same track
    await reopenEditMetadata(page, firstTrack);

    // Verify values persisted
    await expect(
      page.locator('[data-testid="metadata-genre-input"]'),
    ).toHaveValue('Synthwave');
    await expect(
      page.locator('[data-testid="metadata-album-artist-input"]'),
    ).toHaveValue('AAA Test Artist');
    await expect(
      page.locator('[data-testid="metadata-composer-input"]'),
    ).toHaveValue('Test Composer');
    await expect(
      page.locator('[data-testid="metadata-comment-input"]'),
    ).toHaveValue('Test comment');

    // Close
    await page.click('[data-testid="cancel-metadata-button"]');

    await TestHelpers.closeApp(app);
  });

  test('should handle empty/cleared fields gracefully', async () => {
    const { app, page } = await TestHelpers.launchApp();

    const firstTrack = await openEditMetadataForFirstTrack(page);

    // First set some values
    await page
      .locator('[data-testid="metadata-composer-input"]')
      .fill('Temp Composer');
    await page
      .locator('[data-testid="metadata-comment-input"]')
      .fill('Temp Comment');

    // Save
    await page.click('[data-testid="save-metadata-button"]');
    await expect(
      page.locator('[data-testid="edit-metadata-dialog"]'),
    ).toBeHidden();

    // Reopen and clear those fields
    await reopenEditMetadata(page, firstTrack);

    await page.locator('[data-testid="metadata-composer-input"]').fill('');
    await page.locator('[data-testid="metadata-comment-input"]').fill('');

    // Save
    await page.click('[data-testid="save-metadata-button"]');
    await expect(
      page.locator('[data-testid="edit-metadata-dialog"]'),
    ).toBeHidden();

    // Reopen and verify they're empty
    await reopenEditMetadata(page, firstTrack);

    await expect(
      page.locator('[data-testid="metadata-composer-input"]'),
    ).toHaveValue('');
    await expect(
      page.locator('[data-testid="metadata-comment-input"]'),
    ).toHaveValue('');

    await page.click('[data-testid="cancel-metadata-button"]');

    await TestHelpers.closeApp(app);
  });

  test('should successfully write metadata to M4A file (not just database)', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.click('[data-testid="nav-library"]');
    await TestHelpers.waitForTracks(page);

    // Open search and filter to the M4A track
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.locator('[data-testid="search-input"]').fill('Test M4A Song');
    await TestHelpers.waitForTrackCount(page, 1);

    // Right-click the M4A track and open Edit Metadata
    const m4aTrack = page.locator('[data-track-id]').first();
    await openEditMetadataFor(page, m4aTrack);

    // Change the title
    const titleInput = page.locator('[data-testid="metadata-title-input"]');
    await titleInput.fill('Edited M4A Title');

    // Save
    await page.click('[data-testid="save-metadata-button"]');

    // Verify notification panel shows success (not a warning about file tags)
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

    // Search for the renamed track to verify it appears with the new title
    await page.locator('[data-testid="search-input"]').fill('Edited M4A Title');
    await TestHelpers.waitForTrackCount(page, 1);

    // Verify the track row shows the updated title
    await expect(page.locator('[data-track-id]').first()).toContainText(
      'Edited M4A Title',
    );

    await TestHelpers.closeApp(app);
  });
});
