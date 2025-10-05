/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playlist Management', () => {
  test('should create a new playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    await TestHelpers.navigateToView(page, 'playlists');

    await TestHelpers.createPlaylist(page, 'Test Playlist');

    const playlist = await page.locator(
      '[data-testid="playlist-Test Playlist"]',
    );
    expect(await playlist.isVisible()).toBe(true);

    await TestHelpers.takeScreenshot(page, 'playlist-created');

    await TestHelpers.closeApp(app);
  });

  test('should add songs to playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    await TestHelpers.navigateToView(page, 'playlists');
    await TestHelpers.createPlaylist(page, 'My Favorites');

    await TestHelpers.navigateToView(page, 'library');

    const songTitles = await page
      .locator('[data-testid="song-title"]')
      .allTextContents();
    const firstSong = songTitles[0];
    const secondSong = songTitles[1];

    await TestHelpers.addToPlaylist(page, firstSong, 'My Favorites');
    await TestHelpers.addToPlaylist(page, secondSong, 'My Favorites');

    await TestHelpers.navigateToView(page, 'playlists');
    await page.click('[data-testid="playlist-My Favorites"]');

    const playlistSongs = await page
      .locator('[data-testid^="playlist-song-"]')
      .count();
    expect(playlistSongs).toBe(2);

    const playlistSongTitles = await page
      .locator('[data-testid="playlist-song-title"]')
      .allTextContents();
    expect(playlistSongTitles).toContain(firstSong);
    expect(playlistSongTitles).toContain(secondSong);

    await TestHelpers.closeApp(app);
  });

  test('should remove songs from playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    await TestHelpers.navigateToView(page, 'playlists');
    await TestHelpers.createPlaylist(page, 'Temporary');

    await TestHelpers.navigateToView(page, 'library');

    const songTitle = await page
      .locator('[data-testid="song-title"]')
      .first()
      .textContent();
    await TestHelpers.addToPlaylist(page, songTitle!, 'Temporary');

    await TestHelpers.navigateToView(page, 'playlists');
    await page.click('[data-testid="playlist-Temporary"]');

    let playlistSongs = await page
      .locator('[data-testid^="playlist-song-"]')
      .count();
    expect(playlistSongs).toBe(1);

    await page.click(`[data-testid="playlist-song-${songTitle}"]`, {
      button: 'right',
    });
    await page.click('[data-testid="remove-from-playlist-menu"]');

    await page.waitForTimeout(500);

    playlistSongs = await page
      .locator('[data-testid^="playlist-song-"]')
      .count();
    expect(playlistSongs).toBe(0);

    const emptyMessage = await page.locator(
      '[data-testid="empty-playlist-message"]',
    );
    expect(await emptyMessage.isVisible()).toBe(true);

    await TestHelpers.closeApp(app);
  });

  test('should rename playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.navigateToView(page, 'playlists');
    await TestHelpers.createPlaylist(page, 'Original Name');

    await page.click('[data-testid="playlist-Original Name"]', {
      button: 'right',
    });
    await page.click('[data-testid="rename-playlist-menu"]');

    await page.fill('[data-testid="playlist-rename-input"]', 'New Name');
    await page.click('[data-testid="save-rename-button"]');

    await page.waitForTimeout(500);

    const oldPlaylist = await page
      .locator('[data-testid="playlist-Original Name"]')
      .count();
    expect(oldPlaylist).toBe(0);

    const newPlaylist = await page.locator('[data-testid="playlist-New Name"]');
    expect(await newPlaylist.isVisible()).toBe(true);

    await TestHelpers.closeApp(app);
  });

  test('should delete playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.navigateToView(page, 'playlists');
    await TestHelpers.createPlaylist(page, 'To Delete');

    await page.click('[data-testid="playlist-To Delete"]', { button: 'right' });
    await page.click('[data-testid="delete-playlist-menu"]');

    const confirmDialog = await page.locator(
      '[data-testid="confirm-delete-dialog"]',
    );
    expect(await confirmDialog.isVisible()).toBe(true);

    await page.click('[data-testid="confirm-delete-button"]');

    await page.waitForTimeout(500);

    const deletedPlaylist = await page
      .locator('[data-testid="playlist-To Delete"]')
      .count();
    expect(deletedPlaylist).toBe(0);

    await TestHelpers.closeApp(app);
  });

  test('should play entire playlist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    await TestHelpers.navigateToView(page, 'playlists');
    await TestHelpers.createPlaylist(page, 'Play All');

    await TestHelpers.navigateToView(page, 'library');

    const songTitles = await page
      .locator('[data-testid="song-title"]')
      .allTextContents();
    for (let i = 0; i < Math.min(3, songTitles.length); i++) {
      await TestHelpers.addToPlaylist(page, songTitles[i], 'Play All');
    }

    await TestHelpers.navigateToView(page, 'playlists');
    await page.click('[data-testid="playlist-Play All"]');

    await page.click('[data-testid="play-playlist-button"]');

    await page.waitForTimeout(1000);

    const playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.isPlaying).toBe(true);
    expect(songTitles.slice(0, 3)).toContain(playerState.currentSong);

    await TestHelpers.closeApp(app);
  });
});
