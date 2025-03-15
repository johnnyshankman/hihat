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

// Reference to the mini player window
let miniPlayerWindow: BrowserWindow | null = null;

// Reference to the main window for communication
let mainWindow: BrowserWindow | null = null;

// Current track and playback state - only used for syncing UI
let currentTrack: any = null;
let playbackState = {
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  repeatMode: 'off' as 'off' | 'track' | 'all',
  shuffleMode: false,
};

// Store window position
let windowPosition: { x: number; y: number } | null = null;

/**
 * Save the mini player window position
 */
function saveWindowPosition(): void {
  if (miniPlayerWindow) {
    const position = miniPlayerWindow.getPosition();
    windowPosition = { x: position[0], y: position[1] };

    // Save to file
    const userDataPath = app.getPath('userData');
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

  const userDataPath = app.getPath('userData');
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
    miniPlayerWindow.focus();
    return;
  }

  // Use a square size for the mini player
  const size = 350;

  // Load saved position
  const savedPosition = loadWindowPosition();

  miniPlayerWindow = new BrowserWindow({
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    maxWidth: size * 2, // Allow some resizing but maintain square aspect ratio
    maxHeight: size * 2,
    frame: false,
    show: false,
    titleBarStyle: 'customButtonsOnHover',
    backgroundColor: '#00000000', // Transparent background
    useContentSize: true, // Use content size for more accurate sizing
    x: savedPosition?.x, // Set x position if available
    y: savedPosition?.y, // Set y position if available
    alwaysOnTop: true, // Keep the mini player on top of other windows
    minimizable: false, // Disable minimize button
    maximizable: false, // Disable maximize button
    closable: true,
    webPreferences: {
      preload:
        process.env.NODE_ENV === 'development'
          ? path.join(__dirname, '../../.erb/dll/preload.js')
          : path.join(__dirname, '../preload.js'),
    },
  });

  // Load the mini player HTML with a specific query parameter to indicate it's a mini player
  miniPlayerWindow.loadURL(
    `${resolveHtmlPath('index.html')}?miniPlayer=true#/mini-player`,
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

  // Show window when ready
  miniPlayerWindow.once('ready-to-show', () => {
    if (miniPlayerWindow) {
      miniPlayerWindow.show();

      // Immediately send current state to mini player when it's ready
      if (currentTrack) {
        miniPlayerWindow.webContents.send(
          'miniPlayer:trackChanged',
          currentTrack,
        );
        miniPlayerWindow.webContents.send(
          'miniPlayer:stateChanged',
          playbackState,
        );
        miniPlayerWindow.webContents.send(
          'miniPlayer:positionChanged',
          playbackState.position,
        );

        // Extract and send album art
        if (currentTrack.filePath) {
          extractAlbumArt(currentTrack.filePath)
            .then((artData) => {
              if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
                miniPlayerWindow.webContents.send(
                  'miniPlayer:albumArtChanged',
                  artData,
                );
              }
              return null;
            })
            .catch((error) => {
              console.error('Error extracting album art:', error);
            });
        }
      }
    }
  });
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
export function updateCurrentTrack(track: any): void {
  currentTrack = track;

  // Send track data to mini player if it exists
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.webContents.send('miniPlayer:trackChanged', track);

    // Extract and send album art
    if (track && track.filePath) {
      extractAlbumArt(track.filePath)
        .then((artData) => {
          if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
            miniPlayerWindow.webContents.send(
              'miniPlayer:albumArtChanged',
              artData,
            );
          }
          return null;
        })
        .catch((error) => {
          console.error('Error extracting album art:', error);
        });
    }
  }
}

/**
 * Update playback state
 * @param state - Playback state
 */
export function updatePlaybackState(
  state: Partial<typeof playbackState>,
): void {
  playbackState = { ...playbackState, ...state };

  // Send state to mini player if it exists
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.webContents.send('miniPlayer:stateChanged', playbackState);
  }
}

/**
 * Update playback position
 * @param position - Current position in microseconds
 */
export function updatePosition(position: number): void {
  playbackState.position = position;

  // Send position to mini player if it exists
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.webContents.send('miniPlayer:positionChanged', position);
  }
}

/**
 * Forward a command from mini player to main window
 * @param command - Command to forward
 * @param args - Arguments for the command
 */
function forwardCommandToMainWindow(command: string, args?: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(command, args);
  }
}

/**
 * Setup IPC handlers for mini player
 */
export function setupMiniPlayerHandlers(): void {
  // Open mini player
  ipcMain.handle('miniPlayer:open', () => {
    createMiniPlayerWindow();
  });

  // Close mini player
  ipcMain.handle('miniPlayer:close', () => {
    closeMiniPlayerWindow();
  });

  // Request current state
  ipcMain.handle('miniPlayer:requestState', (event) => {
    // Check if the request is coming from the mini player window
    if (miniPlayerWindow && event.sender === miniPlayerWindow.webContents) {
      // Send current track and state
      event.sender.send('miniPlayer:trackChanged', currentTrack);
      event.sender.send('miniPlayer:stateChanged', playbackState);
      event.sender.send('miniPlayer:positionChanged', playbackState.position);

      // Send album art if there's a current track
      if (currentTrack && currentTrack.filePath) {
        extractAlbumArt(currentTrack.filePath)
          .then((artData) => {
            event.sender.send('miniPlayer:albumArtChanged', artData);
            return null;
          })
          .catch((error) => {
            console.error('Error extracting album art:', error);
          });
      }
    }
  });

  // All playback controls are now just forwarded to the main window

  // Play/pause
  ipcMain.handle('miniPlayer:playPause', () => {
    if (playbackState.isPlaying) {
      forwardCommandToMainWindow('player:pausePlayback');
    } else {
      forwardCommandToMainWindow('player:resumePlayback');
    }
  });

  // Next track
  ipcMain.handle('miniPlayer:nextTrack', () => {
    forwardCommandToMainWindow('player:nextTrack');
  });

  // Previous track
  ipcMain.handle('miniPlayer:previousTrack', () => {
    forwardCommandToMainWindow('player:previousTrack');
  });

  // Seek
  ipcMain.handle('miniPlayer:seek', (_, position: number) => {
    forwardCommandToMainWindow('player:seek', position);
  });

  // Set volume
  ipcMain.handle('miniPlayer:setVolume', (_, volume: number) => {
    forwardCommandToMainWindow('player:setVolume', volume);
  });

  // Toggle repeat mode
  ipcMain.handle('miniPlayer:toggleRepeat', () => {
    forwardCommandToMainWindow('player:toggleRepeat');
  });

  // Toggle shuffle mode
  ipcMain.handle('miniPlayer:toggleShuffle', () => {
    forwardCommandToMainWindow('player:toggleShuffle');
  });

  // Get album art
  ipcMain.handle('albumArt:get', async (_, filePath: string) => {
    return extractAlbumArt(filePath);
  });

  // Listen for events from the main window to sync with mini player
  ipcMain.on('player:stateUpdate', (_, state) => {
    updatePlaybackState(state);
  });

  ipcMain.on('player:trackUpdate', (_, track) => {
    updateCurrentTrack(track);
  });

  ipcMain.on('player:positionUpdate', (_, position) => {
    updatePosition(position);
  });
}
