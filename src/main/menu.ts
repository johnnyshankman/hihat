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

/**
 * Gets statistics about the music library
 * @returns Object containing songCount and sizeInGB
 */
function getLibraryStats() {
  try {
    // Get the library path from settings
    const settings = db.getSettings();
    const { libraryPath } = settings;

    if (!libraryPath || !fs.existsSync(libraryPath)) {
      return { songCount: 0, sizeInGB: 0 };
    }

    // Get all tracks from the database to count songs
    const tracks = db.getAllTracks();
    const songCount = tracks.length;

    // Define supported music extensions
    const musicExtensions = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac'];

    // Calculate total size by recursively traversing the library directory
    const totalSizeBytes = calculateDirectorySize(libraryPath, musicExtensions);

    // Convert bytes to GB
    const sizeInGB = totalSizeBytes / (1024 * 1024 * 1024);

    return { songCount, sizeInGB };
  } catch (error) {
    console.error('Error calculating library stats:', error);
    return { songCount: 0, sizeInGB: 0 };
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
              message: `Songs: ${
                stats.songCount
              }\nSize: ${stats.sizeInGB.toFixed(2)} GB`,
            });
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
          accelerator: 'Command+R',
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
          accelerator: 'Command+S',
          click: () => {
            this.mainWindow.webContents.send('ui:toggleSidebar');
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

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
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
                  accelerator: 'Ctrl+S',
                  click: () => {
                    this.mainWindow.webContents.send('ui:toggleSidebar');
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
        label: 'Help',
        submenu: [
          {
            label: 'learn more',
            click() {
              shell.openExternal('https://github.com/johnnyshankman/hihat');
            },
          },
          {
            label: 'Report Issues',
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
