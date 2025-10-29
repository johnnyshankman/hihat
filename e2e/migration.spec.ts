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
      // Wait for library to load after migration
      await TestHelpers.waitForLibraryLoad(page);

      // 1. Start in Library view - verify we see tracks
      await page.waitForSelector('[data-track-id]', { timeout: 5000 });
      const initialTrackCount = await page.locator('[data-track-id]').count();
      expect(initialTrackCount).toBe(7);

      // Check that specific tracks exist with correct artists
      const kendrickRow = await page.locator('text="King Kunta"').first();
      expect(await kendrickRow.isVisible()).toBe(true);

      const billEvansRows = await page.locator('text="Bill Evans"').count();
      expect(billEvansRows).toBeGreaterThanOrEqual(3); // Should have 3 Bill Evans tracks

      const agCookRows = await page.locator('text="A. G. Cook"').count();
      expect(agCookRows).toBeGreaterThanOrEqual(2); // Should have 2 A.G. Cook tracks

      // Verify playlists were migrated
      // Navigate to playlists view (if not already there)
      const playlistsNav = await page.locator('[data-testid="playlists-nav"]');
      if (await playlistsNav.isVisible()) {
        await playlistsNav.click();
        await page.waitForTimeout(1000);

        // Check for migrated playlists
        // Note: Smart playlists (Recently Added, Recently Played, Most Played) are always present
        // We should have 3 smart playlists + 3 user playlists = 6 total
        const playlistItems = await page
          .locator('[data-testid^="playlist-item-"]')
          .count();
        expect(playlistItems).toBeGreaterThanOrEqual(6);

        // Verify specific user playlists from v1
        const jazzPlaylist = await page.locator('text="Jazz Classics"').first();
        expect(await jazzPlaylist.isVisible()).toBe(true);

        const electronicPlaylist = await page
          .locator('text="Electronic"')
          .first();
        expect(await electronicPlaylist.isVisible()).toBe(true);

        const mostPlayedPlaylist = await page
          .locator('text="Most Played"')
          .first();
        expect(await mostPlayedPlaylist.isVisible()).toBe(true);
      }

      // Verify user config is marked as migrated
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
      // Wait for library to load
      await TestHelpers.waitForLibraryLoad(page);

      // Verify Undying by A.G. cook has 333 plays
      const firstRow = await page
        .locator('[data-track-id]')
        .first();
      const firstRowText = await firstRow.textContent();
      expect(firstRowText).toContain('Undying');
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
    const songsPath = path.join(__dirname, 'fixtures/test-songs');

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

  test('should verify playlist track associations after migration', async () => {
    const { app, page } = await TestHelpers.launchAppWithMigration();

    try {
      await TestHelpers.waitForLibraryLoad(page);
      // Click on Jazz Classics playlist
      const jazzPlaylist = await page.locator('text="Jazz Classics"').first();
      await jazzPlaylist.click();
      await page.waitForTimeout(3000);

      // Should have 2 Bill Evans tracks in this playlist
      const playlistTracks = await page.locator('[data-track-id]').count();
      expect(playlistTracks).toBe(2);

      // All should be Bill Evans tracks
      const billEvansCount = await page
        .locator('text="Bill Evans"')
        .count();
      expect(billEvansCount).toBe(2);

    } finally {
      await TestHelpers.closeApp(app);
    }
  });
});
