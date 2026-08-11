/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playback Modes', () => {
  test('repeat track mode replays the same song', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click first track to start playback
    const firstTrack = page.locator('[data-track-id]').first();
    const firstTrackTitle = await firstTrack
      .locator('td')
      .first()
      .textContent();
    await TestHelpers.startPlayback(page, firstTrack);

    // Enable repeat-track mode by clicking repeat button
    // Cycle is: off → track → all → off
    // Click once for "track" (data-repeat-mode should become "track")
    const repeatButton = page.locator('[data-testid="repeat-button"]');
    await repeatButton.click();

    // Verify the button is now in track-repeat mode
    await expect(repeatButton).toHaveAttribute('data-repeat-mode', 'track');

    // Fixture tracks are 10s. Run to the tail of the track, then wait for the
    // clock to wrap back to the start — that wrap *is* the repeat, so we don't
    // have to sleep past a guessed end time.
    await TestHelpers.waitForElapsedAtLeast(page, 9);
    await expect(
      page.locator('[data-testid="player-elapsed-time"]'),
    ).toHaveText('0:00', { timeout: 15000 });

    // Verify the SAME track is still playing (not advanced to next)
    await TestHelpers.waitForPlaying(page);
    await TestHelpers.waitForNowPlaying(page, firstTrackTitle!.trim());
    await expect(firstTrack).toHaveClass(/vt-row-playing/);

    await TestHelpers.closeApp(app);
  });

  test('shuffle mode produces non-sequential track order', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Get first few track titles in sequential order for comparison
    const sequentialTitles: string[] = [];
    for (let i = 0; i < 6; i++) {
      const row = page.locator('[data-track-id]').nth(i);
      const title = await row.locator('td').first().textContent();
      sequentialTitles.push(title!.trim());
    }

    // Double-click first track to start playback
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').first(),
    );

    // Enable shuffle mode by clicking the shuffle button
    const shuffleButton = page.locator('[data-testid="shuffle-button"]');
    await shuffleButton.click();

    // Verify the button is now in shuffle-on mode
    await expect(shuffleButton).toHaveAttribute('data-shuffle-mode', 'on');

    // Skip through several tracks and record what plays. Each skip is followed
    // by a wait for the now-playing title to actually change, so the recorded
    // sequence is never a stale read.
    const shuffledTitles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const previousTitle = await TestHelpers.nowPlayingTitle(page);
      await page.locator('[data-testid="skip-next-button"]').click();
      await TestHelpers.waitForNowPlayingChange(page, previousTitle);
      shuffledTitles.push(await TestHelpers.nowPlayingTitle(page));
    }

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

    // Navigate to library view
    await page.click('[data-testid="nav-library"]');
    await TestHelpers.waitForTracks(page);

    // Find a track not already in "Test Playlist" (playlist-1 has 001, 002, 003)
    // Search for a specific track to ensure it's visible
    const searchToggle = page.locator('[aria-label="Show/Hide search"]');
    if (await searchToggle.isVisible()) {
      await searchToggle.click();
    }

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.waitFor({ state: 'visible' });

    // Search for track test-large-005 which is not in the fixture playlist
    await searchInput.fill('Classical Masters');

    // Right-click the track to open context menu
    const trackRow = page.locator('[data-track-id="test-large-005"]');
    await trackRow.waitFor({ state: 'visible' });
    await trackRow.click({ button: 'right' });

    // Click "Add to Playlist" in context menu
    await page.click('[data-testid="add-to-playlist-menu-item"]');

    // Select "Test Playlist" (playlist-1)
    const playlistOption = page.locator(
      '[data-testid="playlist-option-playlist-1"]',
    );
    await playlistOption.waitFor({ state: 'visible' });
    await playlistOption.click();
    await expect(playlistOption).toBeHidden();

    // Clear search
    await searchInput.clear();
    await TestHelpers.waitForTracks(page);

    // Re-open sidebar (it auto-closes after navigation)
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }

    // Navigate to "Test Playlist"
    const playlistLink = page.locator('[data-playlist-id="playlist-1"]');
    await playlistLink.waitFor({ state: 'visible' });
    await playlistLink.click();

    // Verify the track is in the playlist (originally 3 tracks, now 4)
    await expect(
      page.locator('[data-track-id="test-large-005"]'),
    ).toBeVisible();
    await TestHelpers.waitForTrackCount(page, 4);

    await TestHelpers.closeApp(app);
  });
});
