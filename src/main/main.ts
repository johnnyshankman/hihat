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
import opener from 'opener';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  StoreStructure,
  SongSkeletonStructure,
  ALLOWED_EXTENSIONS,
} from '../common/common';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function parseData(fp: string): StoreStructure {
  const defaultData = {};
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as StoreStructure;
  } catch (error) {
    return defaultData as StoreStructure;
  }
}

const findAllMusicFilesRecursively = (dir: string) => {
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
      const ext = path.extname(filepath).substring(1);
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        result.push(path.relative(dir, filepath));
      }
    }
  } while (files.length !== 0);

  return result;
};

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
 * and then also updates that songs lastPlaye timestamp and increased that
 * songs playCount by 1.
 */
ipcMain.on('set-last-played-song', async (event, arg: string) => {
  const songFilePath = arg;
  const userConfig = parseData(
    path.join(app.getPath('userData'), 'userConfig.json'),
  ) as StoreStructure;

  userConfig.lastPlayedSong = songFilePath;

  Object.keys(userConfig.library).forEach((key) => {
    if (key === songFilePath) {
      userConfig.library[key].additionalInfo.lastPlayed = Date.now();
      userConfig.library[key].additionalInfo.playCount += 1;
    }
  });

  fs.writeFileSync(
    path.join(app.getPath('userData'), 'userConfig.json'),
    JSON.stringify(userConfig),
  );

  event.reply('set-last-played-song', {
    song: songFilePath,
    songData: userConfig.library[songFilePath],
  });
});

const addToLibrary = async (event: IpcMainEvent) => {
  if (!mainWindow) {
    return;
  }

  let result: OpenDialogReturnValue;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections', 'openDirectory'],
      filters: [{ name: 'Music', extensions: ALLOWED_EXTENSIONS }],
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

  const files = result.filePaths;
  // seed the mapping of files to tags with the user's current library
  const filesToTags = userConfig.library;

  let lastFileNameAdded = '';

  for (let i = 0; i < files.length; i += 1) {
    let metadata: mm.IAudioMetadata;

    // check if the file is a directory and if so, find all music files in it
    if (fs.lstatSync(files[i]).isDirectory()) {
      const musicFiles = findAllMusicFilesRecursively(files[i]);
      musicFiles.forEach((file) => {
        files.push(`${files[i]}/${file}`);
      });
      // skip over the directory reference itself
      // eslint-disable-next-line no-continue
      continue;
    }

    // give me the file name itself
    const fileName = path.basename(files[i]);
    const newFilePath = `${userConfig.libraryPath}/${fileName}`;
    // copy over file into the user's existing library folder, flatten all directories
    fs.cpSync(files[i], newFilePath);

    // replace files[i] with the new path so we save the path of the file in the user's library not the path of the file from the user's file system
    files[i] = newFilePath;

    try {
      // eslint-disable-next-line no-await-in-loop
      metadata = await mm.parseFile(files[i]);
    } catch (e) {
      event.reply('song-imported', {
        songsImported: i,
        totalSongs: files.length,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    if (metadata && metadata.format.duration && metadata.common.title) {
      filesToTags[files[i]] = {
        common: {
          ...metadata.common,
          picture: [],
          lyrics: [],
        },
        format: {
          ...metadata.format,
          duration: metadata.format.duration,
        },
        additionalInfo: {
          playCount: 0,
          lastPlayed: 0,
          dateAdded: Date.now(),
        },
      } as SongSkeletonStructure;
    }

    /**
     * @IMPORTANT if the song already exists in the user's library
     * we must port over its `additionalInfo` to keep playcounts in tact
     */
    if (userConfig?.library?.[files[i]]) {
      filesToTags[files[i]].additionalInfo = {
        ...userConfig.library[files[i]].additionalInfo,
      };
    }

    event.reply('song-imported', {
      songsImported: i,
      totalSongs: files.length,
    });

    lastFileNameAdded = fileName;
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

  const updatedStore = {
    ...userConfig,
    library: orderedFilesToTags,
  } as StoreStructure & {
    scrollToIndex: number;
  };

  // scroll to the last song added
  const scrollToIndex = Object.keys(updatedStore.library).findIndex((key) =>
    key.includes(lastFileNameAdded),
  );

  if (scrollToIndex > -1) {
    updatedStore.scrollToIndex = scrollToIndex;
  }

  event.reply('add-to-library', updatedStore);

  /**
   * @note write the json file to the user data directory as userConfig.json
   * for caching purposes. We will re-use this during future boots of the app.
   */
  const dataPath = app.getPath('userData');
  const filePath = path.join(dataPath, 'userConfig.json');
  fs.writeFileSync(filePath, JSON.stringify(updatedStore));
};

const selectLibrary = async (event: IpcMainEvent) => {
  if (!mainWindow) {
    return;
  }

  let result: OpenDialogReturnValue;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      filters: [{ name: 'Music', extensions: ALLOWED_EXTENSIONS }],
    });
  } catch (e) {
    console.log(e);
    return;
  }

  if (result.canceled) {
    event.reply('select-library');
    return;
  }

  const files = findAllMusicFilesRecursively(result.filePaths[0]);

  // create an empty mapping of files to tags we want to cache and re-import on boot
  const filesToTags: { [key: string]: SongSkeletonStructure } = {};

  const userConfig = parseData(
    path.join(app.getPath('userData'), 'userConfig.json'),
  ) as StoreStructure;

  for (let i = 0; i < files.length; i += 1) {
    let metadata: mm.IAudioMetadata;

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
        additionalInfo: {
          playCount: 0,
          lastPlayed: 0,
          dateAdded: Date.now(),
        },
      } as SongSkeletonStructure;
    }

    /**
     * @IMPORTANT if the song already exists in the user's library
     * we must port over its additionalInfo to keep playcounts in tact
     */
    if (userConfig?.library?.[`${result.filePaths[0]}/${files[i]}`]) {
      filesToTags[`${result.filePaths[0]}/${files[i]}`].additionalInfo = {
        ...userConfig.library[`${result.filePaths[0]}/${files[i]}`]
          .additionalInfo,
      };
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

  /**
   * @note write the json file to the user data directory as userConfig.json
   * for caching purposes. We will re-use this during future boots of the app.
   */
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
  // @ts-ignore - `tag` is not supposed to be indexed into using array syntax
  file.tag[arg.tag] = arg.value;
  file.save();

  // now modify the userConfig.json file to reflect the changes
  const userConfig = parseData(
    path.join(app.getPath('userData'), 'userConfig.json'),
  );

  // @ts-expect-error - `common` is not supposed to be indexed into using array syntax
  userConfig.library[filePath].common[arg.key] = arg.value;
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'userConfig.json'),
    JSON.stringify(userConfig),
  );

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

/**
 * @dev for showing a file in Finder on OSX
 */
ipcMain.on('show-in-finder', async (_event, arg): Promise<any> => {
  shell.showItemInFolder(arg.path);
});

/**
 * @dev for reseting all the user's data in the app
 */
ipcMain.on('menu-reset-library', async (_event, _arg): Promise<any> => {
  // set the userConfig.json file to an empty object
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'userConfig.json'),
    JSON.stringify({}),
  );
  // reload the app
  app.relaunch();
  app.exit();
});

/**
 * @dev for copying text to the user's OS clipboard
 */
ipcMain.on('copy-to-clipboard', async (_event, arg): Promise<any> => {
  clipboard.writeText(arg.text);
});

/**
 * @dev for opening a link in the user's default browser
 */
ipcMain.on('open-in-browser', async (_event, arg): Promise<any> => {
  opener(arg.text);
});

/**
 * @dev for coyping the artwork data of a song into the user's clipboard,
 * that way they can paste it into another app, like iMessage.
 */
ipcMain.on('copy-art-to-clipboard', async (_event, arg): Promise<any> => {
  const filePath = arg.song;
  const metadata = await mm.parseFile(filePath);
  if (metadata.common.picture?.[0].data) {
    clipboard.writeImage(
      nativeImage.createFromBuffer(metadata.common.picture?.[0].data),
    );
  }
});

/**
 * @dev for downloading the artwork data of a song to the user's computer,
 * that way they can share it with others or use it as a wallpaper.
 */
ipcMain.on('download-artwork', async (_event, arg): Promise<any> => {
  if (!mainWindow) {
    return;
  }

  const filePath = arg.song;
  const metadata = await mm.parseFile(filePath);
  if (metadata.common.picture?.[0].data) {
    const buffer = metadata.common.picture?.[0].data;
    const dest = dialog.showSaveDialogSync(mainWindow, {
      defaultPath: `${metadata.common.artist} - ${metadata.common.album}.jpg`,
      filters: [{ name: 'JPEG Image', extensions: ['jpg'] }],
    });

    if (dest) {
      fs.writeFileSync(dest, buffer);
    }
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
    // @dev: for things like japanese characters we have to decode (e.g. %E7)
    const decodedUrl = decodeURIComponent(url);
    try {
      return callback(decodedUrl);
    } catch (error) {
      console.error(error);
      return callback(404);
    }
  });

  /**
   * @importnat Set the global asset path to /assets
   */
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  /**
   * @dev create the main window of the app. This is the window that
   * the user will interact with. It is a BrowserWindow instance.
   *
   * @important We also set the icon for the app here.
   * @important We also set the preload script here. This is a script that
   * runs in the renderer process before any other scripts run.
   * We use this to set up the ipcRenderer and other things that
   * we need to use in the renderer + main processes.
   *
   * @see https://www.electronjs.org/docs/api/browser-window
   */
  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    minWidth: 420,
    minHeight: 500,
    icon: getAssetPath('icon.png'),
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

    /**
     * @important shim any missing data from updates between versions of app
     * 1. add lastPlayed to all songs and save it back to the userConfig.json file
     * 2. TBD
     */
    if (contents.library) {
      Object.keys(contents.library).forEach((key) => {
        const song = {
          ...contents.library[key],
        };
        if (song.additionalInfo === undefined) {
          song.additionalInfo = {
            playCount: 0,
            lastPlayed: 0,
            dateAdded: Date.now(),
          };
        }

        if (song.additionalInfo.dateAdded === undefined) {
          song.additionalInfo.dateAdded = Date.now();
        }

        contents.library[key] = song;
      });
    }

    fs.writeFileSync(filePath, JSON.stringify(contents));

    mainWindow.webContents.send('initialize', contents);
  });

  /**
   * @dev enables showing the app minimized to start if the user wants
   */
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
