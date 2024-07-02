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
import { StoreStructure, SongSkeletonStructure } from '../common/common';

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

const ALLOWED_EXTENSIONS = [
  'mp3',
  'flac',
  'm4a',
  'wav',
  'alac',
  'aiff',
  'ogg',
  'oga',
  'mogg',
  'aac',
  'm4p',
  'wma',
];

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

const addToLibrary = async (event: IpcMainEvent) => {
  if (!mainWindow) {
    return;
  }

  let result: OpenDialogReturnValue;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'openDirectory', 'multiSelections'],
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
  const filesToTags = {
    ...userConfig.library,
  };

  let destRootFolder = userConfig.libraryPath;
  if (!destRootFolder) {
    // @dev: fallback to picking out the first song and using its parent folder
    const dest = Object.keys(filesToTags)[0];
    destRootFolder = dest.substring(0, dest.lastIndexOf('/'));
  }

  // if there is only one filePath and it is a directory, then we want to
  // import all files in that directory and pretend like that was the selection
  const stat = fs.lstatSync(result.filePaths[0]);
  if (stat.isDirectory()) {
    const files = findAllMusicFilesRecursively(result.filePaths[0]);
    result.filePaths = files.map((f) => `${result.filePaths[0]}/${f}`);
  }

  for (let i = 0; i < result.filePaths.length; i += 1) {
    let metadata: mm.IAudioMetadata;

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

    if (metadata && metadata.format.duration && metadata.common.title) {
      // copy the music file over to the existing library folder
      fs.copyFileSync(result.filePaths[i], destination);

      // form the data we will save to the userConfig.json file
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
        additionalInfo: {
          playCount: 0,
          lastPlayed: 0,
          dateAdded: Date.now(),
        },
      } as SongSkeletonStructure;

      /**
       * @important if we already have a song file in the library with identical album, title,
       *            and artist, to the one trying to be added.
       * 1. remove the old file
       * 2. replace it with this new one
       * 3. keep the old additionalInfo so that playCount and lastPlayed are preserved.
       *
       * @note This allows users to "upgrade" a file in their library by re-importing it.
       */
      const allLibraryKeys = Object.keys(userConfig.library);
      if (userConfig.library && allLibraryKeys.length > 0) {
        allLibraryKeys.forEach((key) => {
          if (
            userConfig.library[key].common.artist === metadata.common.artist &&
            userConfig.library[key].common.album === metadata.common.album &&
            userConfig.library[key].common.title === metadata.common.title
          ) {
            delete filesToTags[key];
            filesToTags[destination] = {
              ...metadata,
              additionalInfo: {
                ...userConfig.library[key].additionalInfo,
              },
            };
          }
        });
      }
    }

    // report back to the front end so it can update its ux
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
  // and set that as the currentSongIndex so we can scroll to it
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

    // @IMPORTANT: if the song already exists in the user's library port over its additionalInfo
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
  );
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

/**
 * @dev for showing a file in Finder on OSX
 */
ipcMain.on('show-in-finder', async (event, arg): Promise<any> => {
  shell.showItemInFolder(arg.path);
});

/**
 * @dev for copying text to the user's OS clipboard
 */
ipcMain.on('copy-to-clipboard', async (event, arg): Promise<any> => {
  clipboard.writeText(arg.text);
});

/**
 * @dev for opening a link in the user's default browser
 */
ipcMain.on('open-in-browser', async (event, arg): Promise<any> => {
  opener(arg.text);
});

/**
 * @dev for coyping the artwork data of a song into the user's clipboard,
 * that way they can paste it into another app, like iMessage.
 */
ipcMain.on('copy-art-to-clipboard', async (event, arg): Promise<any> => {
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
ipcMain.on('download-artwork', async (event, arg): Promise<any> => {
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
    // @dev: for things like japanese characters we have to decode things like %E7
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
