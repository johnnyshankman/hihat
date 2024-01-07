/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  protocol,
  IpcMainEvent,
  OpenDialogReturnValue,
  clipboard,
  nativeImage,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import * as mm from 'music-metadata';
import { File } from 'node-taglib-sharp';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { StoreStructure, SongSkeletonStructure } from '../common/common';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function parseData(fp: string) {
  const defaultData = {};
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (error) {
    return defaultData;
  }
}

let mainWindow: BrowserWindow | null = null;

/**
 * @dev for requesting album art data. taking every music metadata album art
 *      in library and sending it over is much too large for the IPC
 *      so we lazy the art for one song at a time when the user clicks on a song
 *      via this event.
 */
ipcMain.on('get-album-art', async (event, arg: string) => {
  const songFilePath = arg;
  const metadata = await mm.parseFile(songFilePath);
  event.reply('get-album-art', metadata.common.picture?.[0] || '');
});

/**
 * @dev sets lastPlayedSong in the userConfig.json file to provided arg.path
 */
ipcMain.on('set-last-played-song', async (event, arg: string) => {
  const songFilePath = arg;
  const userConfig = parseData(
    path.join(app.getPath('userData'), 'userConfig.json'),
  ) as StoreStructure;

  userConfig.lastPlayedSong = songFilePath;

  fs.writeFileSync(
    path.join(app.getPath('userData'), 'userConfig.json'),
    JSON.stringify(userConfig),
  );

  event.reply('set-last-played-song');
});

const findAllFilesRecursively = (dir: string) => {
  const result = [];

  const files = [dir];
  do {
    const filepath = files.pop();

    if (!filepath) {
      break;
    }

    const stat = fs.lstatSync(filepath);
    if (stat.isDirectory()) {
      fs.readdirSync(filepath).forEach((f) =>
        files.push(path.join(filepath, f)),
      );
    } else if (stat.isFile()) {
      result.push(path.relative(dir, filepath));
    }
  } while (files.length !== 0);

  return result;
};

const addToLibrary = async (event: IpcMainEvent) => {
  if (!mainWindow) {
    return;
  }

  let result: OpenDialogReturnValue;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
    });
  } catch (e) {
    console.log(e);
    return;
  }

  if (result.canceled) {
    event.reply('add-to-library', {});
    return;
  }

  const userConfig = parseData(
    path.join(app.getPath('userData'), 'userConfig.json'),
  ) as StoreStructure;
  const filesToTags = userConfig.library;

  let destRootFolder = userConfig.libraryPath;
  if (!destRootFolder) {
    // @dev: fallback to picking out the first song and using its parent folder
    const dest = Object.keys(filesToTags)[0];
    destRootFolder = dest.substring(0, dest.lastIndexOf('/'));
  }

  for (let i = 0; i < result.filePaths.length; i += 1) {
    let metadata;

    try {
      // eslint-disable-next-line no-await-in-loop
      metadata = await mm.parseFile(`${result.filePaths[i]}`);
    } catch (e) {
      event.reply('song-imported', {
        songsImported: i,
        totalSongs: result.filePaths.length,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    const destination = `${destRootFolder}/${path.basename(
      result.filePaths[i],
    )}`;

    // copy the file over to the existing library folder
    fs.copyFileSync(result.filePaths[i], destination);

    if (metadata && metadata.format.duration && metadata.common.title) {
      filesToTags[destination] = {
        common: {
          ...metadata.common,
          picture: [],
          lyrics: [],
        },
        format: {
          ...metadata.format,
          duration: metadata.format.duration,
        },
      } as SongSkeletonStructure;
    }

    event.reply('song-imported', {
      songsImported: i,
      totalSongs: result.filePaths.length,
    });
  }

  // sort filesToTags by artist, album, then track number
  const orderedFilesToTags: { [key: string]: SongSkeletonStructure } = {};
  Object.keys(filesToTags)
    .sort((a, b) => {
      const artistA = filesToTags[a].common?.artist
        ?.toLowerCase()
        .replace(/^the /, '');
      const artistB = filesToTags[b].common?.artist
        ?.toLowerCase()
        .replace(/^the /, '');
      const albumA = filesToTags[a].common?.album?.toLowerCase();
      const albumB = filesToTags[b].common?.album?.toLowerCase();
      const trackA = filesToTags[a].common?.track?.no;
      const trackB = filesToTags[b].common?.track?.no;

      if (!artistA) return -1;
      if (!artistB) return 1;
      if (!albumA) return -1;
      if (!albumB) return 1;
      if (!trackA) return -1;
      if (!trackB) return 1;

      if (artistA < artistB) return -1;
      if (artistA > artistB) return 1;
      if (albumA < albumB) return -1;
      if (albumA > albumB) return 1;
      if (trackA < trackB) return -1;
      if (trackA > trackB) return 1;
      return 0;
    })
    .forEach((key) => {
      orderedFilesToTags[key] = filesToTags[key];
    });

  // find the index of the first result.filePath in the orderedFilesToTags
  // and set that as the currentSongIndex
  const currentSongIndex = Object.keys(orderedFilesToTags).findIndex(
    (key) => key === `${destRootFolder}/${path.basename(result.filePaths[0])}`,
  );

  const initialStore = {
    ...userConfig,
    library: orderedFilesToTags,
    scrollToIndex: currentSongIndex,
  };
  event.reply('add-to-library', initialStore);

  const dataPath = app.getPath('userData');
  const filePath = path.join(dataPath, 'userConfig.json');
  fs.writeFileSync(filePath, JSON.stringify(initialStore));
};

const selectLibrary = async (event: IpcMainEvent) => {
  if (!mainWindow) {
    return;
  }

  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
  } catch (e) {
    console.log(e);
    return;
  }

  if (result.canceled) {
    event.reply('select-library');
    return;
  }

  const files = findAllFilesRecursively(result.filePaths[0]);

  // create an empty mapping of files to tags we want to cache and re-import on boot
  const filesToTags: { [key: string]: SongSkeletonStructure } = {};

  for (let i = 0; i < files.length; i += 1) {
    let metadata;

    try {
      // eslint-disable-next-line no-await-in-loop
      metadata = await mm.parseFile(`${result.filePaths[0]}/${files[i]}`);
    } catch (e) {
      event.reply('song-imported', {
        songsImported: i,
        totalSongs: files.length,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    if (metadata && metadata.format.duration && metadata.common.title) {
      filesToTags[`${result.filePaths[0]}/${files[i]}`] = {
        common: {
          ...metadata.common,
          picture: [],
          lyrics: [],
        },
        format: {
          ...metadata.format,
          duration: metadata.format.duration,
        },
      } as SongSkeletonStructure;
    }

    event.reply('song-imported', {
      songsImported: i,
      totalSongs: files.length,
    });
  }

  // sort filesToTags by artist, album, then track number
  const orderedFilesToTags: { [key: string]: SongSkeletonStructure } = {};
  Object.keys(filesToTags)
    .sort((a, b) => {
      const artistA = filesToTags[a].common?.artist
        ?.toLowerCase()
        .replace(/^the /, '');
      const artistB = filesToTags[b].common?.artist
        ?.toLowerCase()
        .replace(/^the /, '');
      const albumA = filesToTags[a].common?.album?.toLowerCase();
      const albumB = filesToTags[b].common?.album?.toLowerCase();
      const trackA = filesToTags[a].common?.track?.no;
      const trackB = filesToTags[b].common?.track?.no;

      if (!artistA) return -1;
      if (!artistB) return 1;
      if (!albumA) return -1;
      if (!albumB) return 1;
      if (!trackA) return -1;
      if (!trackB) return 1;

      if (artistA < artistB) return -1;
      if (artistA > artistB) return 1;
      if (albumA < albumB) return -1;
      if (albumA > albumB) return 1;
      if (trackA < trackB) return -1;
      if (trackA > trackB) return 1;
      return 0;
    })
    .forEach((key) => {
      orderedFilesToTags[key] = filesToTags[key];
    });

  const initialStore = {
    library: orderedFilesToTags,
    playlists: [],
    lastPlayedSong: '',
    libraryPath: result.filePaths[0],
  };
  event.reply('select-library', initialStore);

  // write the json file to the user data directory as userConfig.json
  // for caching purposes. we re-use this during future boots of the app.
  const dataPath = app.getPath('userData');
  const filePath = path.join(dataPath, 'userConfig.json');
  fs.writeFileSync(filePath, JSON.stringify(initialStore));
};

/**
 * @dev for requesting the modification of a tag of a media file
 *      and then modifying it in the app as well as cache'ing it
 *      in the user's app data directory.
 */
ipcMain.on('modify-tag-of-file', async (event, arg): Promise<any> => {
  const filePath = arg.song as string;
  const file = File.createFromPath(filePath);
  // @ts-ignore - `tag` is not supposed to be indexed into use array syntax
  file.tag[arg.tag] = arg.value;
  file.save();

  // now modify the userConfig.json file to reflect the changes
  const userConfig = parseData(
    path.join(app.getPath('userData'), 'userConfig.json'),
  ) as StoreStructure;
  // @ts-ignore - `common` is not supposed to be indexed into use array syntax
  userConfig.library[filePath].common[arg.key] = arg.value;
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'userConfig.json'),
    JSON.stringify(userConfig),
  );

  // reply with the updated song info
  event.reply('modify-tag-of-file', userConfig.library[filePath]);
});

/**
 * @dev for requesting the directory of music the user wants to import
 *      and then importing it into the app as well as cache'ing it
 *     in the user's app data directory.
 */
ipcMain.on('add-to-library', async (event): Promise<any> => {
  await addToLibrary(event);
});

/**
 * @dev for requesting the directory of music the user wants to import
 *      and then importing it into the app as well as cache'ing it
 *     in the user's app data directory.
 */
ipcMain.on('select-library', async (event): Promise<any> => {
  await selectLibrary(event);
});

ipcMain.on('show-in-finder', async (event, arg): Promise<any> => {
  shell.showItemInFolder(arg.path);
});

ipcMain.on('copy-to-clipboard', async (event, arg): Promise<any> => {
  clipboard.writeText(arg.text);
});

ipcMain.on('copy-art-to-clipboard', async (event, arg): Promise<any> => {
  const filePath = arg.song;
  const metadata = await mm.parseFile(filePath);
  if (metadata.common.picture?.[0].data) {
    clipboard.writeImage(
      nativeImage.createFromBuffer(metadata.common.picture?.[0].data),
    );
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  /**
   * @dev create a custom protocol to handle requests for media files
   *      from the renderer process. This is necessary because the
   *      renderer process cannot access the file system directly.
   */
  protocol.registerFileProtocol('my-magic-protocol', (request, callback) => {
    const url = request.url.replace('my-magic-protocol://getMediaFile/', '');
    // @dev: for things like japanese characters we have to decode things like %E7
    const decodedUrl = decodeURIComponent(url);
    try {
      return callback(decodedUrl);
    } catch (error) {
      console.error(error);
      return callback(404);
    }
  });

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  /**
   * @dev create the main window of the app. This is the window that
   *      the user will interact with. It is a BrowserWindow instance.
   *      We also set the icon for the app here.
   *      We also set the preload script here. This is a script that
   *      runs in the renderer process before any other scripts run.
   *      We use this to set up the ipcRenderer and other things that
   *      we need to use in the renderer + main processes.
   * @see https://www.electronjs.org/docs/api/browser-window
   */
  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    minWidth: 360,
    minHeight: 500,
    icon: getAssetPath('icons/1024x1024.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }

    /**
     * @dev read the userConfig.json file from the user data directory
     *     and send the contents to the renderer process to initialize
     *    the app.
     */
    const dataPath = app.getPath('userData');
    const filePath = path.join(dataPath, 'userConfig.json');
    const contents = parseData(filePath);
    mainWindow.webContents.send('initialize', contents as StoreStructure);
  });

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
