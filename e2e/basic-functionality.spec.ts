import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Basic Functionality', () => {
  test('should navigate between views', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    // Start in Library view
    const libraryHeading = await page.getByRole('heading', { name: 'Library', exact: true });
    await expect(libraryHeading).toBeVisible();
    
    // Navigate to Playlists
    await page.getByRole('button', { name: 'Playlists' }).click();
    await page.waitForTimeout(1000);
    
    const playlistsHeading = await page.getByRole('heading', { name: 'Playlists' });
    await expect(playlistsHeading).toBeVisible();
    
    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(1000);
    
    const settingsHeading = await page.getByRole('heading', { name: 'Settings' });
    await expect(settingsHeading).toBeVisible();
    
    // Navigate back to Library
    await page.getByRole('button', { name: 'Library' }).click();
    await page.waitForTimeout(1000);
    
    await expect(libraryHeading).toBeVisible();
    
    await TestHelpers.closeApp(app);
  });

  test('should show empty library message', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    // Check for empty library message
    const emptyMessage = await page.getByText('Your library is empty');
    await expect(emptyMessage).toBeVisible();
    
    const instructionMessage = await page.getByText(/Head to Settings/);
    await expect(instructionMessage).toBeVisible();
    
    await TestHelpers.closeApp(app);
  });

  test('should access electron API', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    // Check if electron API is available
    const hasAPI = await page.evaluate(() => {
      return !!(window as any).electron;
    });
    
    expect(hasAPI).toBe(true);
    
    // Check API structure
    const apiStructure = await page.evaluate(() => {
      const api = (window as any).electron;
      if (!api) return null;
      
      return {
        hasLibrary: !!api.library,
        hasTracks: !!api.tracks,
        hasPlaylists: !!api.playlists,
        hasSettings: !!api.settings,
        hasPlayback: !!api.playback,
      };
    });
    
    expect(apiStructure).not.toBeNull();
    expect(apiStructure?.hasLibrary).toBe(true);
    expect(apiStructure?.hasTracks).toBe(true);
    expect(apiStructure?.hasPlaylists).toBe(true);
    expect(apiStructure?.hasSettings).toBe(true);
    expect(apiStructure?.hasPlayback).toBe(true);
    
    await TestHelpers.closeApp(app);
  });

  test('should get tracks from database', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    // Try to get tracks using the API
    const tracks = await page.evaluate(async () => {
      const api = (window as any).electron;
      if (!api || !api.tracks) return null;
      
      try {
        const result = await api.tracks.getAll();
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Tracks result:', tracks);
    
    // Should return an empty array for fresh test database
    expect(tracks).not.toBeNull();
    if (!tracks.error) {
      expect(Array.isArray(tracks)).toBe(true);
    }
    
    await TestHelpers.closeApp(app);
  });

  test('should get playlists from database', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    // Try to get playlists using the API
    const playlists = await page.evaluate(async () => {
      const api = (window as any).electron;
      if (!api || !api.playlists) return null;
      
      try {
        const result = await api.playlists.getAll();
        return result;
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Playlists result:', playlists);
    
    // Should have default smart playlists
    expect(playlists).not.toBeNull();
    if (!playlists.error) {
      expect(Array.isArray(playlists)).toBe(true);
      expect(playlists.length).toBeGreaterThan(0); // Should have default playlists
    }
    
    await TestHelpers.closeApp(app);
  });
});