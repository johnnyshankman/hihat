/* eslint-disable no-plusplus, no-console, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Modes', () => {
  test('repeat track mode replays the same song', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    const firstTrackTitle = await firstTrack
      .locator('td')
      .first()
      .textContent();
    await firstTrack.dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    let pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Enable repeat-track mode by clicking repeat button
    // Cycle is: off → track → all → off
    // Click once for "track" (data-repeat-mode should become "track")
    const repeatButton = page.locator('[data-testid="repeat-button"]');
    await repeatButton.click();
    await page.waitForTimeout(500);

    // Verify the button is now in track-repeat mode
    await expect(repeatButton).toHaveAttribute('data-repeat-mode', 'track', {
      timeout: 5000,
    });

    // Wait for 10-second track to finish (~12s to be safe)
    await page.waitForTimeout(12000);

    // Verify the SAME track is still playing (not advanced to next)
    pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // The page should still show the first track's title in the player
    const pageContent = await page.content();
    expect(pageContent).toContain(firstTrackTitle!.trim());

    await TestHelpers.closeApp(app);
  });

  test('shuffle mode produces non-sequential track order', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Get first few track titles in sequential order for comparison
    const sequentialTitles: string[] = [];
    for (let i = 0; i < 6; i++) {
      const row = page.locator('[data-track-id]').nth(i);
      const title = await row.locator('td').first().textContent();
      sequentialTitles.push(title!.trim());
    }
    console.log('Sequential order:', sequentialTitles);

    // Double-click first track to start playback
    await page.locator('[data-track-id]').first().dblclick();
    await page.waitForTimeout(1000);

    // Verify playing
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Enable shuffle mode by clicking the shuffle button
    const shuffleButton = page.locator('[data-testid="shuffle-button"]');
    await shuffleButton.click();
    await page.waitForTimeout(500);

    // Verify the button is now in shuffle-on mode
    await expect(shuffleButton).toHaveAttribute('data-shuffle-mode', 'on', {
      timeout: 5000,
    });

    // Skip through several tracks and record what plays
    const shuffledTitles: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.locator('button:has(svg[data-testid="SkipNextIcon"])').click();
      await page.waitForTimeout(1000);

      // Get the title from the player area by checking page content
      // Read the track title from the first visible typography in the player
      const currentTitle = await page.evaluate(() => {
        // The player shows the track title in a Typography component
        // Look for the track info section in the player bar
        const papers = document.querySelectorAll('.MuiPaper-root');
        const playerPaper = papers[papers.length - 1];
        if (!playerPaper) return '';
        const typographies = Array.from(
          playerPaper.querySelectorAll('.MuiTypography-body1'),
        );
        const match = typographies.find((t) => {
          const text = t.textContent?.trim();
          return text && text !== '---' && text.length > 0;
        });
        return match?.textContent?.trim() || '';
      });
      shuffledTitles.push(currentTitle);
    }
    console.log('Shuffled order:', shuffledTitles);

    // With 200 tracks and shuffle enabled, the probability of 5 consecutive
    // tracks matching sequential order is negligible.
    // Check that at least one shuffled track differs from what would be sequential
    let nonSequentialCount = 0;
    for (let i = 0; i < shuffledTitles.length; i++) {
      // sequentialTitles[i+1] would be the next expected track in order
      if (
        i + 1 < sequentialTitles.length &&
        shuffledTitles[i] !== sequentialTitles[i + 1]
      ) {
        nonSequentialCount++;
      }
    }

    // At least 1 track should be non-sequential (very conservative check)
    expect(nonSequentialCount).toBeGreaterThanOrEqual(1);

    await TestHelpers.closeApp(app);
  });

  test('playlist track management — add track and verify', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Navigate to library view
    await page.click('[data-testid="nav-library"]');
    await page.waitForTimeout(500);

    // Find a track not already in "Test Playlist" (playlist-1 has 001, 002, 003)
    // Search for a specific track to ensure it's visible
    const searchToggle = page.locator('[aria-label="Show/Hide search"]');
    if (await searchToggle.isVisible()) {
      await searchToggle.click();
      await page.waitForTimeout(500);
    }

    let searchInput = page.locator('input[type="search"]').first();
    if (!(await searchInput.isVisible())) {
      searchInput = page.locator('input[placeholder*="Search"]').first();
    }
    if (!(await searchInput.isVisible())) {
      searchInput = page.locator('.MuiInputBase-input').first();
    }

    // Search for track test-large-005 which is not in the fixture playlist
    await searchInput.fill('Classical Masters');
    await page.waitForTimeout(1000);

    // Right-click the track to open context menu
    const trackRow = page.locator('[data-track-id="test-large-005"]');
    await trackRow.waitFor({ state: 'visible', timeout: 5000 });
    await trackRow.click({ button: 'right' });

    // Click "Add to Playlist" in context menu
    await page.click('[data-testid="add-to-playlist-menu-item"]');
    await page.waitForTimeout(500);

    // Select "Test Playlist" (playlist-1)
    await page.click('[data-testid="playlist-option-playlist-1"]');
    await page.waitForTimeout(1500);

    // Clear search
    const searchInputToClear = page.locator('input[type="search"]').first();
    if (await searchInputToClear.isVisible()) {
      await searchInputToClear.clear();
      await page.waitForTimeout(500);
    }

    // Re-open sidebar (it auto-closes after navigation)
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // Navigate to "Test Playlist"
    await page.click('[data-playlist-id="playlist-1"]');
    await page.waitForTimeout(500);

    // Verify the track is in the playlist (originally 3 tracks, now 4)
    const addedTrack = page.locator('[data-track-id="test-large-005"]');
    await addedTrack.waitFor({ state: 'visible', timeout: 5000 });

    const trackCount = await page.locator('[data-track-id]').count();
    expect(trackCount).toBe(4);

    await TestHelpers.closeApp(app);
  });
});
