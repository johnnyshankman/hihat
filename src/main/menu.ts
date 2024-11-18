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

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

/**
 * Get JSON data from a file at some filepath
 *
 * @param fp filepath
 * @returns the parsed data from the file at the filepath
 */
function parseData(fp: string): any {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as any;
  } catch (error) {
    return {};
  }
}

/**
 * Get the user's configuration data from the userConfig.json file
 *
 * @returns the user's configuration data as a StoreStructure
 */
function getUserConfig(): any {
  return parseData(path.join(app.getPath('userData'), 'userConfig.json'));
}

function getLibraryStats(): { songCount: number; sizeInGB: number } {
  const userConfig = getUserConfig();
  const { library } = userConfig;
  const songCount = Object.keys(library).length;

  let totalSize = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const filePath of Object.keys(library)) {
    try {
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error reading file size for ${filePath}:`, error);
    }
  }

  const sizeInGB = totalSize / (1024 * 1024 * 1024);

  return { songCount, sizeInGB };
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
    const subMenuHihat: DarwinMenuItemConstructorOptions = {
      label: 'hihat',
      submenu: [
        {
          label: 'about hihat',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        {
          label: 'import new songs',
          click: () => {
            this.mainWindow.webContents.send('menu-add-songs');
          },
        },
        {
          label: 'rescan library folder',
          click: () => {
            this.mainWindow.webContents.send('menu-rescan-library');
          },
        },
        { type: 'separator' },
        {
          label: 'max volume',
          accelerator: 'Command+Up',
          click: () => {
            this.mainWindow.webContents.send('menu-max-volume');
          },
        },
        {
          label: 'mute volume',
          accelerator: 'Command+Down',
          click: () => {
            this.mainWindow.webContents.send('menu-mute-volume');
          },
        },
        {
          label: 'quiet',
          accelerator: 'Option+Command+Down',
          click: () => {
            this.mainWindow.webContents.send('menu-quiet-mode');
          },
        },

        { type: 'separator' },
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
          label: 'close hihat',
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
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Browser View',
          accelerator: 'Command+B',
          click: () => {
            this.mainWindow.webContents.send('menu-toggle-browser');
          },
        },
        {
          label: 'reset all hihat data',
          click: () => {
            this.mainWindow.webContents.send('menu-reset-library');
          },
        },
      ],
    };
    const subMenuAdvanced: DarwinMenuItemConstructorOptions = {
      label: 'Advanced',
      submenu: [
        {
          label: 'change library folder',
          click: () => {
            this.mainWindow.webContents.send('menu-select-library');
          },
        },
        {
          label: 'backup / sync library',
          click: () => {
            this.mainWindow.webContents.send('menu-backup-library');
          },
        },
        { type: 'separator' },
        {
          label: 'hide duplicate songs',
          click: () => {
            this.mainWindow.webContents.send('menu-hide-dupes');
          },
        },
        {
          label: 'delete duplicate songs',
          click: () => {
            this.mainWindow.webContents.send('menu-delete-dupes');
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        { type: 'separator' },
        {
          label: 'Toggle Browser View',
          accelerator: 'Command+B',
          click: () => {
            this.mainWindow.webContents.send('menu-toggle-browser');
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click() {
            shell.openExternal('https://github.com/johnnyshankman/hihat');
          },
        },
        {
          label: 'Search Issues',
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
      subMenuHihat,
      subMenuEdit,
      subMenuView,
      subMenuAdvanced,
      subMenuWindow,
      subMenuHelp,
    ];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
              ]
            : [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
              ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click() {
              shell.openExternal('https://github.com/johnnyshankman/hihat');
            },
          },
          {
            label: 'Search Issues',
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
