import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

const SEARCH_TOGGLE = '[aria-label="Show/Hide search"]';
const SEARCH_INPUT = '[data-testid="search-input"]';

test.describe('Per-View Search Persistence', () => {
  test('library search persists across view navigation', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Open search in Library
    await page.locator(SEARCH_TOGGLE).click();

    // Type a search term
    const searchInput = page.locator(SEARCH_INPUT);
    await searchInput.fill('Aurora');

    // The search input debounces, so wait for the filter to actually land:
    // every rendered row must match the term.
    await expect(
      page.locator('[data-track-id]').filter({ hasNotText: 'Aurora' }),
    ).toHaveCount(0);
    const filteredRows = await page.locator('[data-track-id]').count();
    expect(filteredRows).toBeGreaterThan(0);

    // Navigate to a playlist and back
    await page.getByText('Test Playlist', { exact: true }).click();
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();
    await page.locator('[data-testid="nav-library"]').click();

    // Assert search bar is visible with "Aurora"
    const restoredInput = page.locator(SEARCH_INPUT);
    await expect(restoredInput).toBeVisible();
    await expect(restoredInput).toHaveValue('Aurora');

    // Assert rows are still filtered
    await TestHelpers.waitForTrackCount(page, filteredRows);

    await TestHelpers.closeApp(app);
  });

  test('each playlist maintains its own search filter', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Navigate to Test Playlist (playlist-1)
    // Tracks: "Dream of Love", "A Dream of Love", "My Dream of Love"
    await page.getByText('Test Playlist', { exact: true }).click();
    await TestHelpers.waitForTrackCount(page, 3);

    // Open search and type "My Dream" — a term that narrows the playlist to a
    // single row, so the filtered count is a real signal that the input's
    // 150ms debounce has fired and the term is committed to the view's state.
    await page.locator(SEARCH_TOGGLE).click();
    const searchInput1 = page.locator(SEARCH_INPUT);
    await searchInput1.fill('My Dream');
    await TestHelpers.waitForTrackCount(page, 1);

    // Switch to Jazz Favorites (playlist-2)
    // Tracks: "A Dream of Love", "Night of Love", "A Day of Love"
    await page.getByText('Jazz Favorites', { exact: true }).click();

    // Search should be hidden (Jazz Favorites had no search)
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();

    // Open search and type "Night"
    await page.locator(SEARCH_TOGGLE).click();
    const jazzSearchInput = page.locator(SEARCH_INPUT);
    await jazzSearchInput.fill('Night');
    await TestHelpers.waitForTrackCount(page, 1);

    // Switch back to Test Playlist — "My Dream" is restored
    await page.getByText('Test Playlist', { exact: true }).click();
    const restoredInput1 = page.locator(SEARCH_INPUT);
    await expect(restoredInput1).toBeVisible();
    await expect(restoredInput1).toHaveValue('My Dream');

    // Switch back to Jazz Favorites — "Night" is restored
    await page.getByText('Jazz Favorites', { exact: true }).click();
    const restoredInput2 = page.locator(SEARCH_INPUT);
    await expect(restoredInput2).toBeVisible();
    await expect(restoredInput2).toHaveValue('Night');

    await TestHelpers.closeApp(app);
  });

  test('clearing search in one view does not affect others', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Set search in Library to "Aurora"
    await page.locator(SEARCH_TOGGLE).click();
    const librarySearch = page.locator(SEARCH_INPUT);
    await librarySearch.fill('Aurora');
    await expect(
      page.locator('[data-track-id]').filter({ hasNotText: 'Aurora' }),
    ).toHaveCount(0);

    // Navigate to Test Playlist
    await page.getByText('Test Playlist', { exact: true }).click();
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();

    // Open search and type "Dream"
    await page.locator(SEARCH_TOGGLE).click();
    const playlistSearch = page.locator(SEARCH_INPUT);
    await playlistSearch.fill('Dream');
    await expect(
      page.locator('[data-track-id]').filter({ hasNotText: 'Dream' }),
    ).toHaveCount(0);

    // Close search in playlist (toggle off)
    await page.locator(SEARCH_TOGGLE).click();

    // Verify search input is hidden
    await expect(page.locator(SEARCH_INPUT)).toBeHidden();

    // Navigate back to Library
    await page.locator('[data-testid="nav-library"]').click();

    // Assert "Aurora" is still active in Library
    const restoredLibrarySearch = page.locator(SEARCH_INPUT);
    await expect(restoredLibrarySearch).toBeVisible();
    await expect(restoredLibrarySearch).toHaveValue('Aurora');

    await TestHelpers.closeApp(app);
  });
});
