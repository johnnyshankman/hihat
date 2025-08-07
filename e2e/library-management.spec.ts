import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Library Management', () => {
  test('should import songs from folder', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.importSongs(page);
    
    await TestHelpers.waitForLibraryLoad(page);
    
    const songCount = await TestHelpers.getSongCount(page);
    expect(songCount).toBeGreaterThan(0);
    
    const songs = await page.locator('[data-testid^="song-row-"]').count();
    expect(songs).toBeGreaterThan(0);
    
    await TestHelpers.takeScreenshot(page, 'library-imported');
    
    await TestHelpers.closeApp(app);
  });

  test('should search and filter songs', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);
    
    const initialCount = await page.locator('[data-testid^="song-row-"]').count();
    
    await TestHelpers.searchLibrary(page, 'Kendrick');
    
    const filteredCount = await page.locator('[data-testid^="song-row-"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    
    const visibleSongs = await page.locator('[data-testid^="song-row-"]').allTextContents();
    visibleSongs.forEach(song => {
      expect(song.toLowerCase()).toContain('kendrick');
    });
    
    await page.fill('[data-testid="search-input"]', '');
    await page.waitForTimeout(500);
    
    const resetCount = await page.locator('[data-testid^="song-row-"]').count();
    expect(resetCount).toBe(initialCount);
    
    await TestHelpers.closeApp(app);
  });

  test('should sort songs by different columns', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);
    
    await page.click('[data-testid="column-header-title"]');
    await page.waitForTimeout(500);
    
    const titlesSortedAsc = await page.locator('[data-testid="song-title"]').allTextContents();
    const sortedTitlesAsc = [...titlesSortedAsc].sort();
    expect(titlesSortedAsc).toEqual(sortedTitlesAsc);
    
    await page.click('[data-testid="column-header-title"]');
    await page.waitForTimeout(500);
    
    const titlesSortedDesc = await page.locator('[data-testid="song-title"]').allTextContents();
    const sortedTitlesDesc = [...titlesSortedAsc].sort().reverse();
    expect(titlesSortedDesc).toEqual(sortedTitlesDesc);
    
    await page.click('[data-testid="column-header-artist"]');
    await page.waitForTimeout(500);
    
    const artistsSorted = await page.locator('[data-testid="song-artist"]').allTextContents();
    const sortedArtists = [...artistsSorted].sort();
    expect(artistsSorted).toEqual(sortedArtists);
    
    await TestHelpers.closeApp(app);
  });

  test('should handle song metadata editing', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);
    
    const firstSong = await page.locator('[data-testid^="song-row-"]').first();
    await firstSong.click({ button: 'right' });
    
    await page.click('[data-testid="edit-metadata-menu"]');
    
    const metadataDialog = await page.locator('[data-testid="metadata-dialog"]');
    expect(await metadataDialog.isVisible()).toBe(true);
    
    await page.fill('[data-testid="metadata-title-input"]', 'Updated Title');
    await page.fill('[data-testid="metadata-artist-input"]', 'Updated Artist');
    
    await page.click('[data-testid="save-metadata-button"]');
    await page.waitForTimeout(1000);
    
    const updatedTitle = await page.locator('[data-testid="song-title"]').first().textContent();
    expect(updatedTitle).toBe('Updated Title');
    
    const updatedArtist = await page.locator('[data-testid="song-artist"]').first().textContent();
    expect(updatedArtist).toBe('Updated Artist');
    
    await TestHelpers.closeApp(app);
  });

  test('should like and unlike songs', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    await TestHelpers.importSongs(page);
    await TestHelpers.waitForLibraryLoad(page);
    
    const firstSongTitle = await page.locator('[data-testid="song-title"]').first().textContent();
    
    await TestHelpers.likeSong(page, firstSongTitle!);
    
    const likeButton = await page.locator(`[data-testid="like-button-${firstSongTitle}"]`);
    const isLiked = await likeButton.getAttribute('data-liked');
    expect(isLiked).toBe('true');
    
    await TestHelpers.likeSong(page, firstSongTitle!);
    
    const isUnliked = await likeButton.getAttribute('data-liked');
    expect(isUnliked).toBe('false');
    
    await TestHelpers.closeApp(app);
  });
});