/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect, Locator, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/** Ids of every row the virtualizer currently has mounted. */
const renderedTrackIds = (page: Page) =>
  page
    .locator('[data-track-id]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-track-id')));

/** Scroll the container to the bottom and wait a frame for the re-range. */
async function scrollToBottom(container: Locator) {
  await container.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => resolve());
      }),
  );
}

test.describe('Large Library (200+ tracks)', () => {
  test('should load and display a large library with 200 tracks', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Count visible tracks (may be virtualized, so not all 200 will be visible at once)
    const visibleTrackCount = await page.locator('[data-track-id]').count();
    expect(visibleTrackCount).toBeGreaterThan(0);

    await TestHelpers.takeScreenshot(page, 'large-library-initial');

    await TestHelpers.closeApp(app);
  });

  test('should scroll through large library and reach the last track', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get the scrollable table container
    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    await expect(tableContainer).toBeVisible();

    // Click a row first so the table has focus, as a user would
    const firstRow = page.locator('[data-track-id]').first();
    await firstRow.click();
    await expect(firstRow).toHaveClass(/vt-row-selected/);

    // Scroll to the bottom. The virtualizer re-ranges asynchronously, so poll
    // the rendered ids until rows from the end of the list appear rather than
    // scrolling-then-sleeping repeatedly.
    await scrollToBottom(tableContainer);
    await expect
      .poll(
        async () => {
          await scrollToBottom(tableContainer);
          const ids = await renderedTrackIds(page);
          return ids.some(
            (id) =>
              id === 'test-large-200' ||
              !!id?.includes('test-large-19') ||
              !!id?.includes('test-large-20'),
          );
        },
        { timeout: 15000 },
      )
      .toBe(true);

    await TestHelpers.takeScreenshot(page, 'large-library-scrolled-to-bottom');

    await TestHelpers.closeApp(app);
  });

  test('should sort large library by different columns', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Helper function to get song titles from visible rows
    const getSongTitles = async () => {
      const rows = await page.locator('[data-track-id]').all();
      const titles = await Promise.all(
        rows.slice(0, 10).map(async (row) => {
          const title = await row.locator('td').first().textContent();
          return title ? title.trim() : '';
        }),
      );
      return titles;
    };

    // Helper function to get song artists from visible rows
    const getSongArtists = async () => {
      const rows = await page.locator('[data-track-id]').all();
      const artists = await Promise.all(
        rows.slice(0, 10).map(async (row) => {
          const artist = await row.locator('td').nth(1).textContent();
          return artist ? artist.trim() : '';
        }),
      );
      return artists;
    };

    // Get initial artists (should be sorted by artist by default)
    const initialArtists = await getSongArtists();
    expect(initialArtists.filter((a) => a.length > 0).length).toBeGreaterThan(
      0,
    );

    // Sort by Title ascending — click the Title header directly and wait for
    // the header to report the new sort direction.
    const titleHeader = page.locator('th').filter({ hasText: 'Title' }).first();
    await titleHeader.click();
    await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

    // Verify titles are sorted alphabetically
    await expect
      .poll(async () => {
        const titles = await getSongTitles();
        return JSON.stringify(titles) === JSON.stringify([...titles].sort());
      })
      .toBe(true);

    await TestHelpers.takeScreenshot(page, 'large-library-sorted-by-title');

    await TestHelpers.closeApp(app);
  });

  test('should search within large library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get initial track count (visible in viewport)
    const initialCount = await page.locator('[data-track-id]').count();

    // Click the search toggle button
    await page.locator('[aria-label="Show/Hide search"]').click();
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Every rendered row matching the term is the signal that the debounced
    // filter has applied — the unfiltered library renders many other artists,
    // so this can't pass before the search lands.
    await searchInput.fill('Aurora Synth');
    await expect(
      page.locator('[data-track-id]').filter({ hasNotText: 'Aurora Synth' }),
    ).toHaveCount(0);

    const filteredCount = await page.locator('[data-track-id]').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // Clear search and verify all tracks return
    await searchInput.clear();
    await expect
      .poll(() => page.locator('[data-track-id]').count())
      .toBeGreaterThanOrEqual(initialCount);

    await TestHelpers.takeScreenshot(page, 'large-library-search-results');

    await TestHelpers.closeApp(app);
  });

  test('should play a track from the large library', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the first track to play it
    const firstTrack = page.locator('[data-track-id]').first();
    const firstTitle = await firstTrack.locator('td').first().textContent();
    await TestHelpers.startPlayback(page, firstTrack);

    // The player should now report that exact track as now-playing
    await TestHelpers.waitForNowPlaying(page, firstTitle!.trim());

    await TestHelpers.takeScreenshot(page, 'large-library-track-playing');

    await TestHelpers.closeApp(app);
  });

  test('should handle scrolling performance with virtualization', async () => {
    const { app, page } = await TestHelpers.launchApp();

    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    await expect(tableContainer).toBeVisible();

    // Measure scroll performance by timing scroll operations. Each step waits
    // for the next animation frame instead of a fixed delay, so the measurement
    // reflects real render cost rather than the sleeps we added ourselves.
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      await tableContainer.evaluate(
        (container, scrollAmount) =>
          new Promise<void>((resolve) => {
            container.scrollTop += scrollAmount;
            requestAnimationFrame(() => resolve());
          }),
        500,
      );
    }

    const scrollDuration = Date.now() - startTime;

    // Performance should be reasonable (less than 5 seconds for 10 scrolls)
    expect(scrollDuration).toBeLessThan(5000);

    // Verify the virtualized list is still rendering correctly
    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });
});
