/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
/* eslint-disable radix */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Music Playback', () => {
  test('should play and pause songs', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    const firstSongTitle = await page
      .locator('[data-testid="song-title"]')
      .first()
      .textContent();

    await TestHelpers.playSong(page, firstSongTitle!);

    let playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.isPlaying).toBe(true);
    expect(playerState.currentSong).toBe(firstSongTitle);

    await page.click('[data-testid="play-pause-button"]');
    await page.waitForTimeout(500);

    playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.isPlaying).toBe(false);

    await page.click('[data-testid="play-pause-button"]');
    await page.waitForTimeout(500);

    playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.isPlaying).toBe(true);

    await TestHelpers.closeApp(app);
  });

  test('should skip to next and previous songs', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    const songTitles = await page
      .locator('[data-testid="song-title"]')
      .allTextContents();

    await TestHelpers.playSong(page, songTitles[0]);

    await TestHelpers.skipToNext(page);

    let playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.currentSong).toBe(songTitles[1]);

    await TestHelpers.skipToNext(page);

    playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.currentSong).toBe(songTitles[2]);

    await TestHelpers.skipToPrevious(page);

    playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.currentSong).toBe(songTitles[1]);

    await TestHelpers.closeApp(app);
  });

  test('should handle shuffle mode', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    const songTitles = await page
      .locator('[data-testid="song-title"]')
      .allTextContents();

    await TestHelpers.playSong(page, songTitles[0]);

    await TestHelpers.toggleShuffle(page);

    const shuffleButton = await page.locator('[data-testid="shuffle-button"]');
    const isShuffleOn = await shuffleButton.getAttribute('data-active');
    expect(isShuffleOn).toBe('true');

    const playedSongs = new Set([songTitles[0]]);

    for (let i = 0; i < 3; i++) {
      await TestHelpers.skipToNext(page);
      const playerState = await TestHelpers.getPlayerState(page);
      playedSongs.add(playerState.currentSong!);
    }

    expect(playedSongs.size).toBeGreaterThan(1);

    await TestHelpers.toggleShuffle(page);

    const isShuffleOff = await shuffleButton.getAttribute('data-active');
    expect(isShuffleOff).toBe('false');

    await TestHelpers.closeApp(app);
  });

  test('should handle repeat modes', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    const songTitles = await page
      .locator('[data-testid="song-title"]')
      .allTextContents();

    await TestHelpers.playSong(page, songTitles[songTitles.length - 1]);

    await TestHelpers.toggleRepeat(page);

    const repeatButton = await page.locator('[data-testid="repeat-button"]');
    let repeatMode = await repeatButton.getAttribute('data-mode');
    expect(repeatMode).toBe('all');

    await TestHelpers.skipToNext(page);

    let playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.currentSong).toBe(songTitles[0]);

    await TestHelpers.toggleRepeat(page);

    repeatMode = await repeatButton.getAttribute('data-mode');
    expect(repeatMode).toBe('one');

    await TestHelpers.skipToNext(page);
    await page.waitForTimeout(500);

    playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.currentSong).toBe(songTitles[0]);

    await TestHelpers.toggleRepeat(page);

    repeatMode = await repeatButton.getAttribute('data-mode');
    expect(repeatMode).toBe('off');

    await TestHelpers.closeApp(app);
  });

  test('should adjust volume', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    const firstSongTitle = await page
      .locator('[data-testid="song-title"]')
      .first()
      .textContent();
    await TestHelpers.playSong(page, firstSongTitle!);

    await TestHelpers.setVolume(page, 50);

    const volumeSlider = await page.locator('[data-testid="volume-slider"]');
    let volume = await volumeSlider.inputValue();
    expect(parseInt(volume)).toBe(50);

    await TestHelpers.setVolume(page, 100);

    volume = await volumeSlider.inputValue();
    expect(parseInt(volume)).toBe(100);

    await TestHelpers.setVolume(page, 0);

    volume = await volumeSlider.inputValue();
    expect(parseInt(volume)).toBe(0);

    const muteButton = await page.locator('[data-testid="mute-button"]');
    const isMuted = await muteButton.getAttribute('data-muted');
    expect(isMuted).toBe('true');

    await TestHelpers.closeApp(app);
  });

  test('should display song progress', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);

    const firstSongTitle = await page
      .locator('[data-testid="song-title"]')
      .first()
      .textContent();
    await TestHelpers.playSong(page, firstSongTitle!);

    await page.waitForTimeout(3000);

    const playerState = await TestHelpers.getPlayerState(page);
    expect(playerState.currentTime).toBeGreaterThan(0);
    expect(playerState.duration).toBeGreaterThan(0);
    expect(playerState.currentTime).toBeLessThan(playerState.duration);

    const progressBar = await page.locator('[data-testid="progress-bar"]');
    const progressValue = await progressBar.getAttribute('value');
    expect(parseFloat(progressValue!)).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });
});
