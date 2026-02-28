/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Per-View Search Persistence', () => {
  test('library search persists across view navigation', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Open search in Library
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.waitForTimeout(300);

    // Type a search term
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('Aurora');
    await page.waitForTimeout(500);

    // Verify rows are filtered (Aurora Synth tracks should appear)
    const filteredRows = await page.locator('[data-track-id]').count();
    expect(filteredRows).toBeGreaterThan(0);
    expect(filteredRows).toBeLessThan(200); // Should be fewer than total

    // Navigate to a playlist
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Navigate back to library
    await page.locator('[data-testid="nav-library"]').click();
    await page.waitForTimeout(500);

    // Assert search bar is visible with "Aurora"
    const restoredInput = page.locator('[data-testid="search-input"]');
    await expect(restoredInput).toBeVisible();
    await expect(restoredInput).toHaveValue('Aurora');

    // Assert rows are still filtered
    const restoredRows = await page.locator('[data-track-id]').count();
    expect(restoredRows).toBe(filteredRows);

    await TestHelpers.closeApp(app);
  });

  test('each playlist maintains its own search filter', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to Test Playlist (playlist-1)
    // Tracks: "Dream of Love", "A Dream of Love", "My Dream of Love"
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Open search and type "Dream"
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.waitForTimeout(300);
    const searchInput1 = page.locator('[data-testid="search-input"]');
    await searchInput1.fill('Dream');
    await page.waitForTimeout(500);

    // Switch to Jazz Favorites (playlist-2)
    // Tracks: "A Dream of Love", "Night of Love", "A Day of Love"
    await page.getByText('Jazz Favorites', { exact: true }).click();
    await page.waitForTimeout(500);

    // Search should be hidden (Jazz Favorites had no search)
    let jazzSearchInput = page.locator('[data-testid="search-input"]');
    await expect(jazzSearchInput).not.toBeVisible();

    // Open search and type "Night"
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.waitForTimeout(300);
    jazzSearchInput = page.locator('[data-testid="search-input"]');
    await jazzSearchInput.fill('Night');
    await page.waitForTimeout(500);

    // Switch back to Test Playlist
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Assert "Dream" is restored
    const restoredInput1 = page.locator('[data-testid="search-input"]');
    await expect(restoredInput1).toBeVisible();
    await expect(restoredInput1).toHaveValue('Dream');

    // Switch back to Jazz Favorites
    await page.getByText('Jazz Favorites', { exact: true }).click();
    await page.waitForTimeout(500);

    // Assert "Night" is restored
    const restoredInput2 = page.locator('[data-testid="search-input"]');
    await expect(restoredInput2).toBeVisible();
    await expect(restoredInput2).toHaveValue('Night');

    await TestHelpers.closeApp(app);
  });

  test('clearing search in one view does not affect others', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Set search in Library to "Aurora"
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.waitForTimeout(300);
    const librarySearch = page.locator('[data-testid="search-input"]');
    await librarySearch.fill('Aurora');
    await page.waitForTimeout(500);

    // Navigate to Test Playlist
    await page.getByText('Test Playlist', { exact: true }).click();
    await page.waitForTimeout(500);

    // Open search and type "Dream"
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.waitForTimeout(300);
    const playlistSearch = page.locator('[data-testid="search-input"]');
    await playlistSearch.fill('Dream');
    await page.waitForTimeout(500);

    // Close search in playlist (toggle off)
    await page.locator('[aria-label="Show/Hide search"]').click();
    await page.waitForTimeout(300);

    // Verify search input is hidden
    await expect(
      page.locator('[data-testid="search-input"]'),
    ).not.toBeVisible();

    // Navigate back to Library
    await page.locator('[data-testid="nav-library"]').click();
    await page.waitForTimeout(500);

    // Assert "Aurora" is still active in Library
    const restoredLibrarySearch = page.locator('[data-testid="search-input"]');
    await expect(restoredLibrarySearch).toBeVisible();
    await expect(restoredLibrarySearch).toHaveValue('Aurora');

    await TestHelpers.closeApp(app);
  });
});
