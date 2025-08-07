/**
 * Electron Test Adapter
 * 
 * This module provides a bridge between the Electron app and Playwright tests.
 * It modifies the app behavior when running in test mode to make it more testable.
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export function setupTestMode(): void {
  if (process.env.TEST_MODE !== 'true') {
    return;
  }

  // Override userData path for tests
  const testUserDataPath = path.join(__dirname, '../../.test-data');
  if (!fs.existsSync(testUserDataPath)) {
    fs.mkdirSync(testUserDataPath, { recursive: true });
  }
  app.setPath('userData', testUserDataPath);

  // Disable hardware acceleration for CI environments
  if (process.env.CI === 'true') {
    app.disableHardwareAcceleration();
  }

  // Set app name for tests
  app.setName('hihat-test');

  // Disable auto-updater in tests
  process.env.ELECTRON_DISABLE_UPDATES = 'true';

  // Add test-specific event handlers
  app.on('before-quit', () => {
    // Clean up test data on quit
    if (fs.existsSync(testUserDataPath)) {
      try {
        fs.rmSync(testUserDataPath, { recursive: true, force: true });
      } catch (error) {
        console.error('Failed to clean up test data:', error);
      }
    }
  });
}

export function injectTestIds(): void {
  if (process.env.TEST_MODE !== 'true') {
    return;
  }

  // This function would be called from preload or renderer
  // to add data-testid attributes to elements dynamically
  const addTestId = (selector: string, testId: string) => {
    const element = document.querySelector(selector);
    if (element) {
      element.setAttribute('data-testid', testId);
    }
  };

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectTestIdsToDOM();
    });
  } else {
    injectTestIdsToDOM();
  }
}

function injectTestIdsToDOM(): void {
  // Add test IDs to main components
  const testIdMappings = [
    { selector: '.library-container', testId: 'library-view' },
    { selector: '.library-table', testId: 'library-table' },
    { selector: '.player-container', testId: 'player' },
    { selector: '.sidebar', testId: 'sidebar' },
    { selector: '.settings-container', testId: 'settings-view' },
    { selector: '.playlists-container', testId: 'playlists-view' },
    { selector: '.search-input input', testId: 'search-input' },
    { selector: '.play-pause-btn', testId: 'play-pause-button' },
    { selector: '.next-btn', testId: 'next-button' },
    { selector: '.previous-btn', testId: 'previous-button' },
    { selector: '.shuffle-btn', testId: 'shuffle-button' },
    { selector: '.repeat-btn', testId: 'repeat-button' },
    { selector: '.volume-slider input', testId: 'volume-slider' },
    { selector: '.progress-bar', testId: 'progress-bar' },
    { selector: '.current-time', testId: 'current-time' },
    { selector: '.duration', testId: 'duration' },
    { selector: '.now-playing-title', testId: 'now-playing-title' },
    { selector: '.mute-button', testId: 'mute-button' },
    { selector: '.song-count', testId: 'song-count' },
  ];

  testIdMappings.forEach(({ selector, testId }) => {
    const element = document.querySelector(selector);
    if (element) {
      element.setAttribute('data-testid', testId);
    }
  });

  // Add test IDs to navigation items
  document.querySelectorAll('.nav-item').forEach((item) => {
    const text = item.textContent?.toLowerCase() || '';
    if (text.includes('library')) {
      item.setAttribute('data-testid', 'nav-library');
    } else if (text.includes('playlist')) {
      item.setAttribute('data-testid', 'nav-playlists');
    } else if (text.includes('settings')) {
      item.setAttribute('data-testid', 'nav-settings');
    }
  });

  // Add test IDs to song rows
  document.querySelectorAll('.song-row').forEach((row, index) => {
    const titleElement = row.querySelector('.song-title');
    const title = titleElement?.textContent || `song-${index}`;
    row.setAttribute('data-testid', `song-row-${title}`);
    
    // Add test IDs to song details
    const artist = row.querySelector('.song-artist');
    if (artist) artist.setAttribute('data-testid', 'song-artist');
    if (titleElement) titleElement.setAttribute('data-testid', 'song-title');
    
    // Add test ID to like button
    const likeBtn = row.querySelector('.like-button');
    if (likeBtn) {
      likeBtn.setAttribute('data-testid', `like-button-${title}`);
    }
  });

  // Add test IDs to playlist items
  document.querySelectorAll('.playlist-item').forEach((item) => {
    const name = item.textContent || '';
    item.setAttribute('data-testid', `playlist-${name}`);
  });

  // Add test IDs to column headers
  document.querySelectorAll('.column-header').forEach((header) => {
    const text = header.textContent?.toLowerCase() || '';
    header.setAttribute('data-testid', `column-header-${text}`);
  });
}