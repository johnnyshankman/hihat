import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
  dialog,
} from 'electron';
import fs from 'fs';
import path from 'path';
import * as db from './db';

/**
 * Recursively calculates the size of music files in a directory
 * @param directoryPath - Path to the directory to calculate
 * @param musicExtensions - Array of music file extensions to include
 * @returns Total size in bytes
 */
function calculateDirectorySize(
  directoryPath: string,
  musicExtensions: string[],
): number {
  try {
    const items = fs.readdirSync(directoryPath);

    return items.reduce((total, item) => {
      const itemPath = path.join(directoryPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isFile()) {
        // Check if it's a music file
        const ext = path.extname(itemPath).toLowerCase();
        if (musicExtensions.includes(ext)) {
          return total + stats.size;
        }
      } else if (stats.isDirectory()) {
        // Recursively calculate size for subdirectories
        return total + calculateDirectorySize(itemPath, musicExtensions);
      }

      return total;
    }, 0);
  } catch (error) {
    console.error(
      `Error calculating size for directory ${directoryPath}:`,
      error,
    );
    return 0;
  }
}

const RELEASES_URL = 'https://github.com/johnnyshankman/hihat/releases/latest';
const RELEASES_API =
  'https://api.github.com/repos/johnnyshankman/hihat/releases';
const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/;

function parseSemver(tag: string): [number, number, number] | null {
  const m = tag.match(SEMVER_RE);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function isNewer(
  latest: [number, number, number],
  current: [number, number, number],
): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (latest[i] > current[i]) return true;
    if (latest[i] < current[i]) return false;
  }
  return false;
}

/**
 * Checks the latest versioned release on GitHub and shows a native dialog
 * with the result. Offers a download link when the user's build is behind.
 */
async function checkForUpdates(mainWindow: BrowserWindow): Promise<void> {
  const currentRaw = app.getVersion();
  const current = parseSemver(currentRaw);

  try {
    const res = await fetch(RELEASES_API, {
      headers: {
        'User-Agent': 'hihat',
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`GitHub API responded ${res.status}`);
    }
    const releases = (await res.json()) as Array<{ tag_name?: string }>;
    if (!Array.isArray(releases)) {
      throw new Error('Unexpected releases response shape');
    }

    const latestRelease = releases.find(
      (r) =>
        typeof r?.tag_name === 'string' && parseSemver(r.tag_name) !== null,
    );
    const latest = latestRelease?.tag_name
      ? parseSemver(latestRelease.tag_name)
      : null;
    const latestRaw = latestRelease?.tag_name?.replace(/^v/, '') ?? null;
    if (!latest || !latestRaw) {
      throw new Error('No versioned releases found');
    }

    if (current && isNewer(latest, current)) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update available',
        message: 'A new version of hihat is available.',
        detail: `You have ${currentRaw}. Latest is ${latestRaw}.`,
        buttons: ['download', 'later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) {
        await shell.openExternal(RELEASES_URL);
      }
    } else {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'hihat is up to date',
        message: `You are running the latest version (${currentRaw}).`,
      });
    }
  } catch (error) {
    console.error('check for updates failed:', error);
    await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Unable to check for updates',
      message:
        'Could not reach GitHub. Check your internet connection and try again.',
    });
  }
}

/**
 * Gets statistics about the music library
 * @returns Object containing songCount, sizeInGB, totalPlays, and totalDurationHours
 */
function getLibraryStats() {
  try {
    // Get the library path from settings
    const settings = db.getSettings();
    const { libraryPath } = settings;

    if (!libraryPath || !fs.existsSync(libraryPath)) {
      return {
        songCount: 0,
        sizeInGB: 0,
        totalPlays: 0,
        totalDurationHours: 0,
      };
    }

    // Get all tracks from the database to count songs
    const tracks = db.getAllTracks();
    const songCount = tracks.length;

    // Calculate total plays and duration
    const totalPlays = tracks.reduce(
      (sum, track) => sum + (track.playCount || 0),
      0,
    );
    const totalDurationSeconds = tracks.reduce(
      (sum, track) => sum + (track.duration || 0),
      0,
    );
    const totalDurationHours = totalDurationSeconds / 3600; // Convert seconds to hours

    // Define supported music extensions
    const musicExtensions = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac'];

    // Calculate total size by recursively traversing the library directory
    const totalSizeBytes = calculateDirectorySize(libraryPath, musicExtensions);

    // Convert bytes to GB
    const sizeInGB = totalSizeBytes / (1024 * 1024 * 1024);

    return { songCount, sizeInGB, totalPlays, totalDurationHours };
  } catch (error) {
    console.error('Error calculating library stats:', error);
    return { songCount: 0, sizeInGB: 0, totalPlays: 0, totalDurationHours: 0 };
  }
}

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'hihat',
      submenu: [
        {
          label: 'about hihat',
          selector: 'orderFrontStandardAboutPanel:',
        },
        {
          label: 'see library stats',
          click: () => {
            const stats = getLibraryStats();
            dialog.showMessageBox(this.mainWindow, {
              type: 'info',
              title: 'Library Stats',
              message: `Songs: ${stats.songCount}
Size: ${stats.sizeInGB.toFixed(2)} GB
Plays: ${stats.totalPlays.toLocaleString()}
Duration: ${stats.totalDurationHours.toFixed(1)} hours`,
            });
          },
        },
        {
          label: 'check for updates',
          click: () => {
            checkForUpdates(this.mainWindow);
          },
        },
        { type: 'separator' },
        {
          label: 'hide hihat',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'hide others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'show all', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'select all',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'reload',
          accelerator: 'Ctrl+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'toggle full screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'toggle developer tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'toggle sidebar',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            this.mainWindow.webContents.send('ui:toggleSidebar');
          },
        },
        {
          label: 'view settings',
          click: () => {
            this.mainWindow.webContents.send('ui:openSettings');
          },
        },
        {
          label: 'toggle developer tools',
          accelerator: 'Alt+Ctrl+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
        {
          label: 'zoom in',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomFactor();
              focusedWindow.webContents.setZoomFactor(currentZoom + 0.1);
            }
          },
        },
        {
          label: 'zoom out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomFactor();
              focusedWindow.webContents.setZoomFactor(currentZoom - 0.1);
            }
          },
        },
        {
          label: 'reset zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.setZoomFactor(1);
            }
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'toggle full screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        { type: 'separator' },
        {
          label: 'toggle sidebar',
          accelerator: 'Command+S',
          click: () => {
            this.mainWindow.webContents.send('ui:toggleSidebar');
          },
        },
        {
          label: 'view settings',
          click: () => {
            this.mainWindow.webContents.send('ui:openSettings');
          },
        },
        {
          label: 'zoom in',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomFactor();
              focusedWindow.webContents.setZoomFactor(currentZoom + 0.1);
            }
          },
        },
        {
          label: 'zoom out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomFactor();
              focusedWindow.webContents.setZoomFactor(currentZoom - 0.1);
            }
          },
        },
        {
          label: 'reset zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.setZoomFactor(1);
            }
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'bring all to front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuPlayback: MenuItemConstructorOptions = {
      label: 'Playback',
      submenu: [
        {
          label: 'next',
          accelerator: 'CmdOrCtrl+Right',
          click: () => {
            this.mainWindow.webContents.send('playback:next');
          },
        },
        {
          label: 'previous',
          accelerator: 'CmdOrCtrl+Left',
          click: () => {
            this.mainWindow.webContents.send('playback:previous');
          },
        },
        { type: 'separator' },
        {
          label: 'volume up',
          accelerator: 'CmdOrCtrl+Up',
          click: () => {
            this.mainWindow.webContents.send('playback:volumeUp');
          },
        },
        {
          label: 'volume down',
          accelerator: 'CmdOrCtrl+Down',
          click: () => {
            this.mainWindow.webContents.send('playback:volumeDown');
          },
        },
        { type: 'separator' },
        {
          label: 'toggle shuffle',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            this.mainWindow.webContents.send('playback:toggleShuffle');
          },
        },
        {
          label: 'toggle repeat modes',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            this.mainWindow.webContents.send('playback:toggleRepeat');
          },
        },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'learn more',
          click() {
            shell.openExternal('https://github.com/johnnyshankman/hihat');
          },
        },
        {
          label: 'report issues',
          click() {
            shell.openExternal(
              'https://github.com/johnnyshankman/hihat/issues',
            );
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [
      subMenuAbout,
      subMenuEdit,
      subMenuView,
      subMenuPlayback,
      subMenuWindow,
      subMenuHelp,
    ];
  }

  buildDefaultTemplate(): MenuItemConstructorOptions[] {
    const templateDefault = [
      {
        label: 'view',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: 'reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'toggle full screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                {
                  label: 'toggle developer tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
                { type: 'separator' } as any,
                {
                  label: 'toggle sidebar',
                  accelerator: 'Ctrl+S',
                  click: () => {
                    this.mainWindow.webContents.send('ui:toggleSidebar');
                  },
                },
                {
                  label: 'view settings',
                  click: () => {
                    this.mainWindow.webContents.send('ui:openSettings');
                  },
                },
              ]
            : [
                {
                  label: 'toggle full screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                { type: 'separator' } as any,
                {
                  label: 'toggle sidebar',
                  accelerator: 'CmdOrCtrl+S',
                  click: () => {
                    this.mainWindow.webContents.send('ui:toggleSidebar');
                  },
                },
                {
                  label: 'view settings',
                  click: () => {
                    this.mainWindow.webContents.send('ui:openSettings');
                  },
                },
                {
                  label: 'zoom in',
                  accelerator: 'CmdOrCtrl+Plus',
                  click: () => {
                    const focusedWindow = BrowserWindow.getFocusedWindow();
                    if (focusedWindow) {
                      const currentZoom =
                        focusedWindow.webContents.getZoomFactor();
                      focusedWindow.webContents.setZoomFactor(
                        currentZoom + 0.1,
                      );
                    }
                  },
                },
                {
                  label: 'zoom out',
                  accelerator: 'CmdOrCtrl+-',
                  click: () => {
                    const focusedWindow = BrowserWindow.getFocusedWindow();
                    if (focusedWindow) {
                      const currentZoom =
                        focusedWindow.webContents.getZoomFactor();
                      focusedWindow.webContents.setZoomFactor(
                        currentZoom - 0.1,
                      );
                    }
                  },
                },
                {
                  label: 'reset zoom',
                  accelerator: 'CmdOrCtrl+0',
                  click: () => {
                    const focusedWindow = BrowserWindow.getFocusedWindow();
                    if (focusedWindow) {
                      focusedWindow.webContents.setZoomFactor(1);
                    }
                  },
                },
              ],
      },
      {
        label: 'Playback',
        submenu: [
          {
            label: 'next',
            accelerator: 'Ctrl+Right',
            click: () => {
              this.mainWindow.webContents.send('playback:next');
            },
          },
          {
            label: 'previous',
            accelerator: 'Ctrl+Left',
            click: () => {
              this.mainWindow.webContents.send('playback:previous');
            },
          },
          { type: 'separator' },
          {
            label: 'volume up',
            accelerator: 'Ctrl+Up',
            click: () => {
              this.mainWindow.webContents.send('playback:volumeUp');
            },
          },
          {
            label: 'volume down',
            accelerator: 'Ctrl+Down',
            click: () => {
              this.mainWindow.webContents.send('playback:volumeDown');
            },
          },
          { type: 'separator' },
          {
            label: 'toggle shuffle',
            accelerator: 'CmdOrCtrl+=',
            click: () => {
              this.mainWindow.webContents.send('playback:toggleShuffle');
            },
          },
          {
            label: 'toggle repeat modes',
            accelerator: 'Ctrl+R',
            click: () => {
              this.mainWindow.webContents.send('playback:toggleRepeat');
            },
          },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'learn more',
            click() {
              shell.openExternal('https://github.com/johnnyshankman/hihat');
            },
          },
          {
            label: 'report issues',
            click() {
              shell.openExternal(
                'https://github.com/johnnyshankman/hihat/issues',
              );
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
