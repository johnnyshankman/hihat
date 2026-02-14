/**
 * E2E Test: v1 to v2 Migration
 *
 * This test suite verifies that the hihat v1 to v2 migration system works correctly.
 * It tests importing legacy userConfig.json data into the new SQLite database structure.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { TestHelpers } from './helpers/test-helpers';

test.describe('hihat v1 to v2 Migration', () => {
  test('should successfully migrate v1 userConfig.json to v2 database', async () => {
    // Launch app with migration enabled
    const { app, page } = await TestHelpers.launchAppWithMigration();

    try {
      // 1. Verify migration dialog appears
      await page.waitForSelector('[data-testid="migration-dialog"]', {
        timeout: 5000,
      });
      const dialog = page.locator('[data-testid="migration-dialog"]');
      expect(await dialog.isVisible()).toBe(true);

      // 2. Verify we can see the migration message
      const messageElement = page.locator('[data-testid="migration-message"]');
      expect(await messageElement.isVisible()).toBe(true);

      // 3. Get the Continue button
      const continueButton = page.locator(
        '[data-testid="migration-continue-button"]',
      );

      // 4. Wait for migration to complete (button becomes enabled if not already)
      // Note: With the small test fixture, migration may complete almost instantly
      await page.waitForSelector(
        '[data-testid="migration-continue-button"]:not([disabled])',
        { timeout: 10000 },
      );
      expect(await continueButton.isDisabled()).toBe(false);

      // 5. Verify completion message shows track and playlist counts
      const dialogContent = await dialog.textContent();
      expect(dialogContent).toContain('7 tracks');

      // 6. Click Continue to close the dialog
      await continueButton.click();

      // 7. Wait for page reload and library to load
      await TestHelpers.waitForLibraryLoad(page);

      // 8. Verify we see tracks in Library view
      await page.waitForSelector('[data-track-id]', { timeout: 5000 });
      const initialTrackCount = await page.locator('[data-track-id]').count();
      expect(initialTrackCount).toBe(7);

      // 9. Check that specific tracks exist with correct artists
      const hipHopRow = await page
        .locator('text="Found Dream of Love"')
        .first();
      expect(await hipHopRow.isVisible()).toBe(true);

      const auroraSynthRows = await page.locator('text="Aurora Synth"').count();
      expect(auroraSynthRows).toBeGreaterThanOrEqual(1); // Should have Aurora Synth track

      const jazzCollectiveRows = await page
        .locator('text="The Jazz Collective"')
        .count();
      expect(jazzCollectiveRows).toBeGreaterThanOrEqual(1); // Should have The Jazz Collective track

      // 10. Verify user config is marked as migrated
      const legacyConfigPath = path.join(
        __dirname,
        'fixtures/test-userConfig.json',
      );
      const isMarked = TestHelpers.isMigrationMarked(legacyConfigPath);
      expect(isMarked).toBe(true);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('should preserve play counts from v1 migration', async () => {
    // Launch app with migration enabled
    const { app, page } = await TestHelpers.launchAppWithMigration();

    try {
      // 1. Wait for migration dialog
      await page.waitForSelector('[data-testid="migration-dialog"]', {
        timeout: 5000,
      });

      // 2. Wait for migration to complete
      const continueButton = page.locator(
        '[data-testid="migration-continue-button"]',
      );
      await page.waitForSelector(
        '[data-testid="migration-continue-button"]:not([disabled])',
        { timeout: 10000 },
      );

      // 3. Click Continue to close dialog
      await continueButton.click();

      // 4. Wait for library to load
      await TestHelpers.waitForLibraryLoad(page);

      // 5. Verify Dream of Love by Aurora Synth has 333 plays
      const firstRow = await page.locator('[data-track-id]').first();
      const firstRowText = await firstRow.textContent();
      expect(firstRowText).toContain('Dream of Love');
      expect(firstRowText).toContain('333');
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('should skip migration if userConfig.json is already marked as migrated', async () => {
    // Pre-mark the migration
    const legacyConfigPath = path.join(
      __dirname,
      'fixtures/test-userConfig.json',
    );
    const songsPath = path.join(__dirname, 'fixtures/test-songs-large');

    // Prepare and immediately mark as migrated
    TestHelpers.cleanupMigrationFiles(legacyConfigPath);
    TestHelpers.prepareMigrationFixture(legacyConfigPath, songsPath);
    // Manually mark it as migrated
    // eslint-disable-next-line global-require
    const fs = require('fs');
    fs.renameSync(legacyConfigPath, `${legacyConfigPath}.migrated`);

    // Launch app - migration should be skipped
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    try {
      // App should launch with empty library (new user state)
      await page.waitForTimeout(2000);

      // Check if we're in the welcome/empty state
      const welcomeText = await page
        .locator('text="Your library is empty"')
        .count();
      expect(welcomeText).toBe(1);
    } finally {
      await TestHelpers.closeApp(app);
      // Clean up
      TestHelpers.cleanupMigrationFiles(legacyConfigPath);
    }
  });
});
