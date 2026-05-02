/**
 * MiniPlayer Window Manager
 *
 * This module handles the creation and management of the MiniPlayer window,
 * which displays a floating player with album art and playback controls.
 * It acts as a relay between the mini player UI and the main window.
 */

import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';
import * as mm from 'music-metadata';
import fs from 'fs';
import { resolveHtmlPath } from './util';
import { Track } from '../types/dbTypes';
import { PlayerPlaybackState } from '../types/ipc';
import { registerIpcHandler, sendIpcEvent } from './ipc/register';

// Detect test mode so the preload path resolves to the built preload.js
// (same pattern as main.ts). Without this, test mode falls through to the
// dev path which doesn't exist in the built app, leaving window.electron
// undefined and breaking MiniPlayer IPC entirely.
const isTest =
  process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
const isTestHidden = isTest && process.env.TEST_VISIBLE !== 'true';

// Reference to the mini player window
let miniPlayerWindow: BrowserWindow | null = null;

// Reference to the main window for communication
let mainWindow: BrowserWindow | null = null;

// Current track and playback state - only used for syncing UI
let currentTrack: Track | null = null;
let playbackState: PlayerPlaybackState = {
  paused: false,
  position: 0,
  duration: 0,
  volume: 1,
  repeatMode: 'off',
  shuffleMode: false,
  canGoNext: false,
};

// Store window position
let windowPosition: { x: number; y: number } | null = null;

/**
 * Get the user data path, using separate directories for dev and prod
 */
function getUserDataPath(): string {
  const basePath = app.getPath('userData');
  if (process.env.NODE_ENV === 'development') {
    return path.join(basePath, '..', `${app.getName()}-dev`);
  }
  return basePath;
}

/**
 * Save the mini player window position
 */
function saveWindowPosition(): void {
  if (miniPlayerWindow) {
    const position = miniPlayerWindow.getPosition();
    windowPosition = { x: position[0], y: position[1] };

    // Save to file
    const userDataPath = getUserDataPath();
    const positionFilePath = path.join(userDataPath, 'miniPlayerPosition.json');

    try {
      fs.writeFileSync(
        positionFilePath,
        JSON.stringify(windowPosition),
        'utf-8',
      );
    } catch (error) {
      console.error('Failed to save mini player position:', error);
    }
  }
}

/**
 * Load the mini player window position
 */
function loadWindowPosition(): { x: number; y: number } | null {
  if (windowPosition) {
    return windowPosition;
  }

  const userDataPath = getUserDataPath();
  const positionFilePath = path.join(userDataPath, 'miniPlayerPosition.json');

  try {
    if (fs.existsSync(positionFilePath)) {
      const data = fs.readFileSync(positionFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load mini player position:', error);
  }

  return null;
}

/**
 * Extract album art from a music file for the mini player
 * @param filePath - Path to the music file
 * @returns Promise with base64 encoded image data or null
 * @TODO this is redundant with how we do this in the main player context
 */
async function extractAlbumArt(filePath: string): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const metadata = await mm.parseFile(filePath, {
      skipCovers: false, // Explicitly load album art
    });

    // Check if there's any picture data
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];

      // Get the format and ensure it's a valid MIME type
      const pictureFormat = picture.format;
      let format = pictureFormat;
      if (!format.includes('/')) {
        format = `image/${format.toLowerCase()}`;
      }

      // Convert the buffer to a base64 string
      const base64String = Buffer.from(picture.data).toString('base64');

      // Create a proper data URL
      return `data:${format};base64,${base64String}`;
    }

    return null;
  } catch (error) {
    console.error(`Error extracting album art from ${filePath}:`, error);
    return null;
  }
}

/**
 * Set the main window reference
 * @param window - Main window reference
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Create the mini player window
 */
export function createMiniPlayerWindow(): void {
  // Don't create multiple instances
  if (miniPlayerWindow) {
    if (!isTestHidden) {
      miniPlayerWindow.focus();
    }
    return;
  }

  // Use a square size for the mini player
  const size = 350;

  // Load saved position
  const savedPosition = loadWindowPosition();

  try {
    console.warn('Creating mini player window...');
    miniPlayerWindow = new BrowserWindow({
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      maxWidth: size * 2, // Allow some resizing but maintain square aspect ratio
      maxHeight: size * 2,
      frame: false,
      show: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#00000000', // Transparent background
      useContentSize: true, // Use content size for more accurate sizing
      x: savedPosition?.x, // Set x position if available
      y: savedPosition?.y, // Set y position if available
      alwaysOnTop: true, // Keep the mini player on top of other windows
      minimizable: true, // Disable minimize button
      maximizable: true, // Disable maximize button
      closable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: !isTest,
        backgroundThrottling: !isTest,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Log the URL we're going to load for debugging
    const miniPlayerUrl = `${resolveHtmlPath('index.html')}?miniPlayer=true#/mini-player`;

    // Load the mini player HTML with a specific query parameter to indicate it's a mini player
    miniPlayerWindow.loadURL(miniPlayerUrl);

    // Log any webContents errors
    miniPlayerWindow.webContents.on(
      'did-fail-load',
      (_, errorCode, errorDescription) => {
        console.error(
          `Mini player failed to load: ${errorCode} - ${errorDescription}`,
        );
      },
    );

    // Maintain square aspect ratio when resizing
    miniPlayerWindow.on('resize', () => {
      if (miniPlayerWindow) {
        const dimensions = miniPlayerWindow.getSize();
        // Use the larger dimension to make it square
        const maxDimension = Math.max(dimensions[0], dimensions[1]);
        miniPlayerWindow.setSize(maxDimension, maxDimension, true);
      }
    });

    // Save position when moved
    miniPlayerWindow.on('moved', () => {
      saveWindowPosition();
    });

    // Handle close event to prevent crashes
    miniPlayerWindow.on('close', (event) => {
      // Save position before closing
      saveWindowPosition();

      // Prevent the default close behavior which might be causing the crash
      event.preventDefault();

      // Safely destroy the window
      if (miniPlayerWindow) {
        // Remove all listeners to prevent memory leaks
        miniPlayerWindow.removeAllListeners();

        // Hide the window first
        miniPlayerWindow.hide();

        // Set to null before destroy to avoid any further access attempts
        const windowToDestroy = miniPlayerWindow;
        miniPlayerWindow = null;

        // Destroy the window on next tick to avoid transaction issues
        process.nextTick(() => {
          if (!windowToDestroy.isDestroyed()) {
            windowToDestroy.destroy();
          }
        });
      }
    });

    // Show window when ready (skip in test mode to avoid stealing focus)
    miniPlayerWindow.once('ready-to-show', () => {
      if (!miniPlayerWindow) return;

      if (!isTestHidden) {
        miniPlayerWindow.show();
      }

      // Immediately send current state to mini player when it's ready
      if (currentTrack) {
        sendIpcEvent(miniPlayerWindow, 'miniPlayer:trackChanged', currentTrack);
        sendIpcEvent(miniPlayerWindow, 'miniPlayer:stateChanged', playbackState);
        sendIpcEvent(
          miniPlayerWindow,
          'miniPlayer:positionChanged',
          playbackState.position,
        );

        // Extract and send album art
        if (currentTrack.filePath) {
          extractAlbumArt(currentTrack.filePath)
            .then((artData) => {
              sendIpcEvent(
                miniPlayerWindow,
                'miniPlayer:albumArtChanged',
                artData,
              );
              return null;
            })
            .catch((error) => {
              console.error('Error extracting album art:', error);
            });
        }
      }
    });
  } catch (error) {
    console.error('Error creating mini player window:', error);
  }
}

/**
 * Close the mini player window
 */
export function closeMiniPlayerWindow(): void {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    // Save position before closing
    saveWindowPosition();

    // Hide the window first
    miniPlayerWindow.hide();

    // Store reference to window before nullifying
    const windowToDestroy = miniPlayerWindow;
    miniPlayerWindow = null;

    // Destroy on next tick to avoid transaction issues
    process.nextTick(() => {
      if (!windowToDestroy.isDestroyed()) {
        windowToDestroy.destroy();
      }
    });
  }
}

/**
 * Update the current track
 * @param track - Track data
 */
export function updateCurrentTrack(track: Track | null): void {
  currentTrack = track;

  sendIpcEvent(miniPlayerWindow, 'miniPlayer:trackChanged', track);

  // Extract and send album art
  if (track && track.filePath && miniPlayerWindow) {
    extractAlbumArt(track.filePath)
      .then((artData) => {
        sendIpcEvent(miniPlayerWindow, 'miniPlayer:albumArtChanged', artData);
        return null;
      })
      .catch((error) => {
        console.error('Error extracting album art:', error);
      });
  }
}

/**
 * Update playback state
 * @param state - Playback state
 */
export function updatePlaybackState(
  state: Partial<PlayerPlaybackState>,
): void {
  playbackState = { ...playbackState, ...state };
  sendIpcEvent(miniPlayerWindow, 'miniPlayer:stateChanged', playbackState);
}

/**
 * Update playback position
 * @param position - Current position in microseconds
 */
export function updatePosition(position: number): void {
  playbackState.position = position;
  sendIpcEvent(miniPlayerWindow, 'miniPlayer:positionChanged', position);
}

/**
 * Setup IPC handlers for mini player
 */
export function setupMiniPlayerHandlers(): void {
  // Open mini player
  registerIpcHandler('miniPlayer:open', async () => {
    try {
      createMiniPlayerWindow();
    } catch (error) {
      console.error('Error opening mini player:', error);
    }
  });

  // Close mini player
  registerIpcHandler('miniPlayer:close', async () => {
    try {
      closeMiniPlayerWindow();
    } catch (error) {
      console.error('Error closing mini player:', error);
    }
  });

  // Request current state — caller is the miniPlayer renderer responding to
  // its own mount; respond directly to event.sender (the requesting window)
  // rather than broadcasting to all renderers.
  registerIpcHandler('miniPlayer:requestState', async (_req, event) => {
    try {
      if (!miniPlayerWindow || event.sender !== miniPlayerWindow.webContents) {
        console.warn(
          'Request state called from non-mini player window or mini player is null',
        );
        return;
      }
      const sender = event.sender;
      sender.send('miniPlayer:trackChanged', currentTrack);
      sender.send('miniPlayer:stateChanged', playbackState);
      sender.send('miniPlayer:positionChanged', playbackState.position);

      if (currentTrack && currentTrack.filePath) {
        try {
          const artData = await extractAlbumArt(currentTrack.filePath);
          if (!sender.isDestroyed()) {
            sender.send('miniPlayer:albumArtChanged', artData);
          }
        } catch (error) {
          console.error('Error extracting album art:', error);
          if (!sender.isDestroyed()) {
            sender.send('miniPlayer:albumArtChanged', null);
          }
        }
      } else {
        sender.send('miniPlayer:albumArtChanged', null);
      }
    } catch (error) {
      console.error('Error handling mini player request state:', error);
    }
  });

  // All playback controls forward typed events to the main window.
  registerIpcHandler('miniPlayer:playPause', async () => {
    sendIpcEvent(mainWindow, 'player:playPause');
  });
  registerIpcHandler('miniPlayer:nextTrack', async () => {
    sendIpcEvent(mainWindow, 'player:nextTrack');
  });
  registerIpcHandler('miniPlayer:previousTrack', async () => {
    sendIpcEvent(mainWindow, 'player:previousTrack');
  });
  registerIpcHandler('miniPlayer:seek', async (position) => {
    sendIpcEvent(mainWindow, 'player:seek', position);
  });
  registerIpcHandler('miniPlayer:setVolume', async (volume) => {
    sendIpcEvent(mainWindow, 'player:setVolume', volume);
  });
  registerIpcHandler('miniPlayer:toggleRepeat', async () => {
    sendIpcEvent(mainWindow, 'player:toggleRepeat');
  });
  registerIpcHandler('miniPlayer:toggleShuffle', async () => {
    sendIpcEvent(mainWindow, 'player:toggleShuffle');
  });

  // Get album art — keyed by file path; the renderer wraps this in a TQ
  // query for caching (`useAlbumArt(filePath)`).
  registerIpcHandler('albumArt:get', async (filePath) => {
    return extractAlbumArt(filePath);
  });

  // Listen for events from the main window to sync with mini player.
  // These three are fire-and-forget broadcasts (`ipcMain.on`, not `.handle`)
  // and remain so by design — the renderer doesn't await them.
  ipcMain.on('player:stateUpdate', (_, state: PlayerPlaybackState) => {
    updatePlaybackState(state);
  });

  ipcMain.on('player:trackUpdate', (_, track: Track | null) => {
    updateCurrentTrack(track);
  });

  ipcMain.on('player:positionUpdate', (_, position: number) => {
    updatePosition(position);
  });
}
