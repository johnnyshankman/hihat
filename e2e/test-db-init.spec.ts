import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Database Initialization', () => {
  test('should initialize test database and show songs in library', async () => {
    const { app, page } = await TestHelpers.launchApp();
    
    try {
      // Wait for the app to fully load
      await page.waitForTimeout(3000);
      
      // Navigate to library view (should be default)
      await page.waitForSelector('[data-testid="library-view"], .library-container, .song-list, table', { 
        state: 'visible',
        timeout: 10000 
      });
      
      // Check if songs are visible in the library
      // Look for any element that might contain song data
      const songElements = await page.locator('tr, .song-row, .track-row, [data-testid*="song"], [data-testid*="track"]').count();
      
      console.log(`Found ${songElements} potential song elements`);
      
      // Also check for specific song titles from our test data
      const hasSongs = await page.locator('text=/Undying|Windows|King Kunta|White Meadow/i').count();
      
      console.log(`Found ${hasSongs} songs by title match`);
      
      // Take a screenshot for debugging
      await page.screenshot({ 
        path: 'e2e/screenshots/library-view-test.png',
        fullPage: true 
      });
      
      // Verify at least some songs are visible
      expect(hasSongs).toBeGreaterThan(0);
      
    } finally {
      await TestHelpers.closeApp(app);
    }
  });
});