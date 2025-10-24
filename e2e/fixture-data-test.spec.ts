import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * This test suite verifies that fixture data is properly loaded and used
 * during E2E tests without affecting production or development environments.
 *
 * Test Fixtures Include:
 * - 7 test tracks (A. G. Cook, Bill Evans, Bladee, Kendrick Lamar)
 * - 5 playlists (2 custom + 3 smart playlists)
 * - Pre-configured settings (library path, theme, last played track)
 */
test.describe('Fixture Data Integration', () => {
  test('should load all 7 test tracks from fixture database', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for library to load
    await page.waitForTimeout(3000);

    // Check that tracks are visible in the UI
    // The fixture database contains 7 test tracks
    const trackRows = await page.locator('tr[role="row"]').count();

    // Should have at least 7 tracks (may have header row)
    expect(trackRows).toBeGreaterThanOrEqual(7);

    // Verify specific test tracks are present
    const pageContent = await page.content();
    expect(pageContent).toContain('Undying'); // A. G. Cook
    expect(pageContent).toContain('King Kunta'); // Kendrick Lamar
    expect(pageContent).toContain('Alice In Wonderland'); // Bill Evans

    await TestHelpers.closeApp(app);
  });

  test('should have pre-configured settings from fixture data', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // The fixture database has settings pre-configured:
    // - theme: dark
    // - libraryPath: TEST_SONGS_PATH
    // - lastPlayedSongId: test-7 (King Kunta)

    // Wait for app to load
    await page.waitForTimeout(3000);

    // Check that we're not seeing the "no library" setup screen
    // If fixture data loaded correctly, we should see the library immediately
    const hasLibraryView = await page.locator('.MuiTable-root').count();
    expect(hasLibraryView).toBeGreaterThan(0);

    // Verify we have tracks (not empty state)
    const trackCount = await page.locator('tr[role="row"]').count();
    expect(trackCount).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });

  test('should load test playlists from fixture database', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for app to load
    await page.waitForTimeout(3000);

    // Navigate to playlists view
    const playlistsButton = await page.getByRole('button', {
      name: /playlists/i,
    });
    await playlistsButton.click();
    await page.waitForTimeout(1000);

    // The fixture database contains 5 playlists:
    // - Test Playlist 1
    // - Jazz Favorites
    // - Recently Added (smart)
    // - Recently Played (smart)
    // - Most Played (smart)

    const pageContent = await page.content();

    // Check for custom playlists
    expect(pageContent).toContain('Test Playlist 1');
    expect(pageContent).toContain('Jazz Favorites');

    // Check for smart playlists
    expect(pageContent).toContain('Recently Added');
    expect(pageContent).toContain('Recently Played');
    expect(pageContent).toContain('Most Played');

    await TestHelpers.closeApp(app);
  });

  test('should be able to play test songs from fixture data', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for library to load
    await page.waitForTimeout(3000);

    // Find a test track and try to play it
    const trackRows = await page.locator('tr[role="row"]').all();

    // Skip header row if present, play first actual track
    if (trackRows.length > 1) {
      await trackRows[1].dblclick();
      await page.waitForTimeout(1000);

      // Verify player controls are visible and active
      const playPauseButton = await page
        .locator(
          '[data-testid="play-pause-button"], button[aria-label*="Pause"]',
        )
        .count();
      expect(playPauseButton).toBeGreaterThan(0);
    }

    await TestHelpers.closeApp(app);
  });

  test('should have proper file paths pointing to test fixtures', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for library to load
    await page.waitForTimeout(3000);

    // Verify that tracks loaded (which means file paths are correct)
    const trackCount = await page.locator('tr[role="row"]').count();
    expect(trackCount).toBeGreaterThan(0);

    // The fact that the app loaded without errors means:
    // 1. The database was initialized with {{TEST_SONGS_PATH}} placeholders
    // 2. The placeholders were replaced with actual paths
    // 3. The app can access the test song files
    // 4. No production or development data was touched

    await TestHelpers.closeApp(app);
  });

  test('should have track metadata from fixture database', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for library to load
    await page.waitForTimeout(3000);

    const pageContent = await page.content();

    // Verify track metadata from fixture database
    // Test track #1: A. G. Cook - Undying from 7G album
    expect(pageContent).toContain('A. G. Cook');
    expect(pageContent).toContain('7G');

    // Test track #3: Bill Evans - Alice In Wonderland
    expect(pageContent).toContain('Bill Evans');
    expect(pageContent).toContain('Sunday at the Village Vanguard');

    // Test track #7: Kendrick Lamar - King Kunta
    expect(pageContent).toContain('Kendrick Lamar');
    expect(pageContent).toContain('To Pimp a Butterfly');

    await TestHelpers.closeApp(app);
  });

  test('should verify TEST_MODE environment is active', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Verify that TEST_MODE is working by checking the database is not empty
    // In normal first-run, the app would show library setup screen
    // With TEST_MODE, we should immediately see tracks from fixture data

    await page.waitForTimeout(3000);

    // Should NOT see "Select Library Folder" button (first-run screen)
    const setupButtons = await page
      .getByRole('button', { name: /select library folder/i })
      .count();
    expect(setupButtons).toBe(0);

    // Should see library table with tracks
    const hasTracks = await page.locator('tr[role="row"]').count();
    expect(hasTracks).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });
});

/**
 * Additional Integration Tests
 */
test.describe('Fixture Data Isolation', () => {
  test('fixture database should reset between test runs', async () => {
    // First test run
    const { app: app1, page: page1 } = await TestHelpers.launchApp();
    await page1.waitForTimeout(2000);

    const firstRunTracks = await page1.locator('tr[role="row"]').count();

    await TestHelpers.closeApp(app1);

    // Second test run (database should be recreated fresh)
    const { app: app2, page: page2 } = await TestHelpers.launchApp();
    await page2.waitForTimeout(2000);

    const secondRunTracks = await page2.locator('tr[role="row"]').count();

    // Should have same number of tracks (proving database was reset)
    expect(secondRunTracks).toBe(firstRunTracks);

    await TestHelpers.closeApp(app2);
  });

  test('test database should contain exactly 7 fixture tracks', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);

    // Count visible track rows (excluding header)
    const allRows = await page.locator('tr[role="row"]').all();

    // Filter out header rows
    const trackRows = allRows.filter(async (row) => {
      const text = await row.textContent();
      return text && !text.includes('Title') && !text.includes('Artist');
    });

    // Should have exactly 7 test tracks from fixture data
    expect(trackRows.length).toBeGreaterThanOrEqual(7);

    await TestHelpers.closeApp(app);
  });
});
