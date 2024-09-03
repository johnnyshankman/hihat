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
import Rsync from 'rsync';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  StoreStructure,
  LightweightAudioMetadata,
  ALLOWED_EXTENSIONS,
} from '../common/common';
import { SendMessageArgs } from './preload';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

/**
 * Utility functions
 */

/**
 * @dev installs the React DevTools and Redux DevTools as extensions
 */
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
function getUserConfig(): StoreStructure {
  return parseData(path.join(app.getPath('userData'), 'userConfig.json'));
}

/**
 * Get the user's userConfig.json filepath and write the data to it
 * in a synchronous and stringified manner. Ensures that we always
 * write a bonafide StoreStructure object to the file.
 *
 * @param data | a StoreStructure object
 * @returns void
 */
function writeFileSyncToUserConfig(data: StoreStructure) {
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'userConfig.json'),
    JSON.stringify(data),
  );
}

/**
 * @dev recursively find all music files in a directory
 * @param dir the directory to search for music files in
 */
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

/**
 * Sorts a group of files considered to be duplicates, but of varying quality.
 * The sorting is based on the following criteria:
 * 1. Lossless files are better than lossy files
 * 2. Higher bitrate is better
 * 3. Higher sample rate is better
 * 4. Higher bit depth is better
 * 5. Files with album art are better
 * 6. If none of the above distinctions help, consider them equal
 *
 * @param files | an array of file paths
 * @returns an array of file paths sorted by quality
 */
async function sortFilesByQuality(files: string[]) {
  // setup: fetch metadata for all files because we cant do async in sort()
  const metadataArray = await Promise.all(
    files.map(async (file) => {
      const metadata = await mm.parseFile(file);
      return { file, metadata };
    }),
  );

  const sorted = metadataArray.sort((a, b) => {
    const metadataA = a.metadata;
    const metadataB = b.metadata;

    // If one of the metadata is null, push it to the end (assuming valid metadata is better)
    if (!metadataA) return 1;
    if (!metadataB) return -1;

    // If one is lossless and the other isn't, the lossless one is better
    if (metadataA.format.lossless && !metadataB.format.lossless) return -1;
    if (!metadataA.format.lossless && metadataB.format.lossless) return 1;

    // If one has a higher bitrate, it's better
    if (metadataA.format.bitrate && metadataB.format.bitrate) {
      if (metadataA.format.bitrate !== metadataB.format.bitrate) {
        return metadataB.format.bitrate - metadataA.format.bitrate;
      }
    }

    // If one has a higher sample rate, it's better
    if (metadataA.format.sampleRate && metadataB.format.sampleRate) {
      if (metadataA.format.sampleRate !== metadataB.format.sampleRate) {
        return metadataB.format.sampleRate - metadataA.format.sampleRate;
      }
    }

    // If one has a higher bit depth (bits per sample), it's better
    if (metadataA.format.bitsPerSample && metadataB.format.bitsPerSample) {
      if (metadataA.format.bitsPerSample !== metadataB.format.bitsPerSample) {
        return metadataB.format.bitsPerSample - metadataA.format.bitsPerSample;
      }
    }

    // If one has album art and the other doesn't, the one with album art is better
    if (metadataA.common.picture && !metadataB.common.picture) return -1;
    if (!metadataA.common.picture && metadataB.common.picture) return 1;

    // If none of the above distinctions help, consider them equal
    return 0;
  });

  // Step 3: Extract the sorted files
  return sorted.map((item) => item.file);
}

const hideOrDeleteDupes = async (event: IpcMainEvent, del: boolean) => {
  const userConfig = getUserConfig();
  const { library } = userConfig;

  // in miliseconds
  // const dedupeTime = 5.65237006;

  const duplicatesMap: Record<string, string[]> = {};

  const libraryKeys = Object.keys(library);
  for (let i = 0; i < libraryKeys.length; i += 1) {
    const libraryKey = libraryKeys[i];
    const songData = library[libraryKey];

    // create an idempotent key for the song
    const { title, artist, album } = songData.common;
    const key = `${title?.toLowerCase().trim()}-${artist
      ?.toLowerCase()
      .trim()}-${album?.toLowerCase().trim()}`;

    console.log('Processing Key', key);

    // if the duplicates map already has this key, skip it.
    // that means we've already found the duplicates and queued the bad ones for deletion
    if (duplicatesMap[key]) {
      console.log('Skipping Key Already Processed', key);
      // eslint-disable-next-line no-continue
      continue;
    }

    // find all dupes of this song
    // which means the title, artist, and album are identical
    const dupesOfThisSong = Object.keys(library).filter(
      (nestedLibraryKey) =>
        library[nestedLibraryKey].common.title?.toLowerCase().trim() ===
          title?.toLowerCase().trim() &&
        library[nestedLibraryKey].common.artist?.toLowerCase().trim() ===
          artist?.toLowerCase().trim() &&
        library[nestedLibraryKey].common.album?.toLowerCase().trim() ===
          album?.toLowerCase().trim(),
    );

    // eslint-disable-next-line no-await-in-loop
    const sorted = await sortFilesByQuality(dupesOfThisSong);

    // remove the best version from the list and delete the rest from the library
    sorted.shift();
    if (sorted.length) {
      console.log('Files to Delete', sorted);
      duplicatesMap[key] = sorted;
    }
  }

  // delete all the files in the duplicates map
  Object.keys(duplicatesMap).forEach((key) => {
    const filesToDelete = duplicatesMap[key];
    for (let i = 0; i < filesToDelete.length; i += 1) {
      delete library[filesToDelete[i]];

      if (del) {
        fs.unlinkSync(filesToDelete[i]);
      }
    }
  });

  // update the long term and short term stores with the new library
  const updatedStore = {
    ...userConfig,
    library,
  };

  return updatedStore;
};

/**
 * IPC Main Handlers
 */

/**
 * @dev for requesting album art data.
 * @important storing album art in the user's config file and sending it over
 * is much too large for the IPC so we lazy load the art for one song at
 * a time when the user clicks on a song via this event.
 * @note I would take a similar approach to lyrics, and any other large data
 */
ipcMain.on('get-album-art', async (event, arg: string) => {
  const songFilePath = arg;
  const metadata = await mm.parseFile(songFilePath);
  event.reply('get-album-art', metadata.common.picture?.[0] || '');
});

/**
 * @dev removes the requested song from the library but not from the filesystem
 */
ipcMain.on('hide-song', async (event, arg) => {
  const userConfig = getUserConfig();

  delete userConfig.library[arg.song];
  const updatedStore = {
    ...userConfig,
  };
  writeFileSyncToUserConfig(updatedStore);

  // @todo: rename to update-store not update-store
  event.reply('update-store', updatedStore);
});

/**
 * @dev removes the requested song from the library and from the filesystem
 */
ipcMain.on('delete-song', async (event, arg) => {
  const userConfig = getUserConfig();

  delete userConfig.library[arg.song];
  fs.unlinkSync(arg.song);
  const updatedStore = {
    ...userConfig,
  };
  writeFileSyncToUserConfig(updatedStore);

  event.reply('update-store', updatedStore);
});

/**
 * @dev removes the requested album of songs from the library and the filesystem
 *     by filtering the library for all songs with the same artist and album
 */
ipcMain.on('delete-album', async (event, arg) => {
  const userConfig = getUserConfig();
  const { song } = arg;

  const { artist } = userConfig.library[song].common;
  const { album } = userConfig.library[song].common;

  const songsToDelete = Object.keys(userConfig.library).filter(
    (key) =>
      userConfig.library[key].common.artist === artist &&
      userConfig.library[key].common.album === album,
  );

  songsToDelete.forEach((songToDelete) => {
    delete userConfig.library[songToDelete];
    fs.unlinkSync(songToDelete);
  });

  const updatedStore = {
    ...userConfig,
  };

  writeFileSyncToUserConfig(updatedStore);

  event.reply('update-store', updatedStore);
});

/**
 * @dev for hiding duplicate songs in the user's library
 */
ipcMain.on('menu-hide-dupes', async (event) => {
  const updatedStore = await hideOrDeleteDupes(event, false);
  writeFileSyncToUserConfig(updatedStore);
  event.reply('update-store', updatedStore);
});

/**
 * @dev for deleting duplicate songs in the user's library
 */
ipcMain.on('menu-delete-dupes', async (event) => {
  const updatedStore = await hideOrDeleteDupes(event, true);
  writeFileSyncToUserConfig(updatedStore);
  event.reply('update-store', updatedStore);
});

/**
 * @dev sets lastPlayedSong in the userConfig.json file to provided arg.path
 * and then also updates that songs lastPlaye timestamp and increased that
 * songs playCount by 1.
 */
ipcMain.on('set-last-played-song', async (event, arg: string) => {
  const songFilePath = arg;
  const userConfig = getUserConfig();

  userConfig.lastPlayedSong = songFilePath;

  Object.keys(userConfig.library).forEach((key) => {
    if (key === songFilePath) {
      userConfig.library[key].additionalInfo.lastPlayed = Date.now();
      userConfig.library[key].additionalInfo.playCount += 1;
    }
  });

  writeFileSyncToUserConfig(userConfig);

  event.reply('set-last-played-song', {
    song: songFilePath,
    songData: userConfig.library[songFilePath],
  });
});

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

  const userConfig = getUserConfig();
  // @ts-expect-error - `common` is not supposed to be indexed into using array syntax
  userConfig.library[filePath].common[arg.key] = arg.value;
  writeFileSyncToUserConfig(userConfig);

  event.reply('modify-tag-of-file', userConfig.library[filePath]);
});

/**
 * @dev for requesting the directory of music the user wants to import
 *      and then importing it into the app as well as cache'ing it
 *     in the user's app data directory.
 */
ipcMain.on('add-to-library', async (event): Promise<any> => {
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

  const userConfig = getUserConfig();

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

    const fileName = path.basename(files[i]);
    // copy file into the user's existing library folder, flatten all directories
    const newFilePath = `${userConfig.libraryPath}/${fileName}`;
    // if src and dest are the same, skip the copy because it's a no op
    if (files[i] !== newFilePath) {
      try {
        fs.cpSync(files[i], newFilePath);
      } catch (e) {
        console.error(e);
        console.error('continuing after failed copy');
      }
    }

    // replace reference to the file with the new path
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
          artist: metadata.common.artist,
          album: metadata.common.album,
          title: metadata.common.title,
          track: metadata.common.track,
          disk: metadata.common.disk,
          /**
           * purposely do not store the picture data in the user's config
           * because it's too large and we can lazy load it when needed
           */
        },
        format: {
          duration: metadata.format.duration,
        },
        additionalInfo: {
          playCount: 0,
          lastPlayed: 0,
          dateAdded: Date.now(),
        },
      } as LightweightAudioMetadata;
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
  const orderedFilesToTags: { [key: string]: LightweightAudioMetadata } = {};
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
      const diskA = filesToTags[a].common?.disk?.no;
      const diskB = filesToTags[b].common?.disk?.no;

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
      if (diskA && diskB) {
        if (diskA < diskB) return -1;
        if (diskA > diskB) return 1;
      }
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
    scrollToIndex?: number;
  };

  // scroll to the last song added
  const scrollToIndex = Object.keys(updatedStore.library).findIndex((key) =>
    key.includes(lastFileNameAdded),
  );

  if (scrollToIndex > -1) {
    updatedStore.scrollToIndex = scrollToIndex;
  }

  /**
   * @note write the json file to the user data directory as userConfig.json
   * for caching purposes. We re-use this during future boots of the app.
   */
  writeFileSyncToUserConfig(updatedStore);
  event.reply('add-to-library', updatedStore);
});

/**
 * @dev for requesting the directory of music the user wants to import
 *      and then importing it into the app as well as cache'ing it
 *     in the user's app data directory.
 */
ipcMain.on(
  'select-library',
  async (event, args: SendMessageArgs['select-library']): Promise<any> => {
    if (!mainWindow) {
      return;
    }

    let result: OpenDialogReturnValue;

    // when rescan is true, we skip the dialog and just rescan the existing library
    // from the user's config file
    if (args.rescan) {
      const userConfig = getUserConfig();
      result = { filePaths: [userConfig.libraryPath] } as OpenDialogReturnValue;
    } else {
      try {
        result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openDirectory'],
          filters: [{ name: 'Music', extensions: ALLOWED_EXTENSIONS }],
        });
      } catch (e) {
        console.log(e);
        return;
      }
    }

    if (result.canceled) {
      event.reply('select-library');
      return;
    }

    const files = findAllMusicFilesRecursively(result.filePaths[0]);

    // create an empty mapping that will become the library
    const filesToTags: { [key: string]: LightweightAudioMetadata } = {};

    const userConfig = getUserConfig();

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
        // if the song already exists in the user's library, skip it
        if (filesToTags[`${result.filePaths[0]}/${files[i]}`]) {
          // eslint-disable-next-line no-continue
          continue;
        }

        filesToTags[`${result.filePaths[0]}/${files[i]}`] = {
          common: {
            artist: metadata.common.artist,
            album: metadata.common.album,
            title: metadata.common.title,
            track: metadata.common.track,
            disk: metadata.common.disk,
            /**
             * purposely do not store the picture data in the user's config
             * because it's too large and we can lazy load it when needed
             */
          },
          format: {
            duration: metadata.format.duration,
          },
          additionalInfo: {
            playCount: 0,
            lastPlayed: 0,
            dateAdded: Date.now(),
          },
        } as LightweightAudioMetadata;
      }

      /**
       * @IMPORTANT if the song already exists in the user's library
       * we must port over its additionalInfo to keep playcounts in tact.
       * we find the song with identical name, artist, and album.
       * @NOTE if there are dupes and only one has the legacy data, we will
       * not consistently port over the correct additional data.
       */
      const preexistingSong = Object.keys(userConfig.library).find(
        (key) =>
          userConfig.library[key].common.title === metadata.common.title &&
          userConfig.library[key].common.artist === metadata.common.artist &&
          userConfig.library[key].common.album === metadata.common.album,
      );

      if (preexistingSong) {
        filesToTags[`${result.filePaths[0]}/${files[i]}`].additionalInfo = {
          ...userConfig.library[preexistingSong].additionalInfo,
        };
      }

      event.reply('song-imported', {
        songsImported: i,
        totalSongs: files.length,
      });
    }

    // sort filesToTags by artist, album, then track number
    const orderedFilesToTags: { [key: string]: LightweightAudioMetadata } = {};
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
        const diskA = filesToTags[a].common?.disk?.no;
        const diskB = filesToTags[b].common?.disk?.no;

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
        if (diskA && diskB) {
          if (diskA < diskB) return -1;
          if (diskA > diskB) return 1;
        }
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
      initialized: true,
    };

    /**
     * @note write the json file to the user data directory as userConfig.json
     * for caching purposes. We will re-use this during future boots of the app.
     */
    writeFileSyncToUserConfig(initialStore);
    event.reply('select-library', initialStore);
  },
);

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
  writeFileSyncToUserConfig({
    library: {},
    playlists: [],
    lastPlayedSong: '',
    libraryPath: '',
    initialized: true,
  });
  // reload the app
  app.relaunch();
  app.exit();
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
 * @dev for backing up the user's library to a certain directory/path
 * by using rsync.
 */
ipcMain.on('menu-backup-library', async (event, _arg): Promise<any> => {
  const userConfig = getUserConfig();
  const { libraryPath } = userConfig;

  // null check the mainWindow
  if (!mainWindow) {
    return;
  }

  let result: OpenDialogReturnValue;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
  } catch (e) {
    console.log(e);
    return;
  }

  if (result.canceled) {
    return;
  }

  const backupPath = result.filePaths[0];

  if (
    backupPath === libraryPath ||
    backupPath.startsWith(libraryPath + path.sep)
  ) {
    event.reply(
      'backup-library-error',
      'Cannot backup to the same folder or its subfolder',
    );
    return;
  }

  if (backupPath) {
    const rsync = new Rsync();

    rsync
      .set('ignore-existing')
      .flags(['v', 'P', 'r', 'h'])
      .source(libraryPath)
      .destination(backupPath);

    // Execute the command
    rsync.execute((error, code, cmd) => {
      // we are done, respond to the renderer process
      console.log('rsync error:', error);
      console.log('rsync command:', cmd);
      event.reply('backup-library-success');
    });
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
      return callback({
        statusCode: 404,
      });
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
    minWidth: 500,
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

    const userConfig = getUserConfig();

    /**
     * @important shim any missing data from updates between versions of app
     * 1. add lastPlayed to all songs and save it back to the userConfig.json file
     * 2. TBD
     */
    if (userConfig.library) {
      Object.keys(userConfig.library).forEach((key) => {
        const song = {
          ...userConfig.library[key],
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

        userConfig.library[key] = song;
      });
    }

    writeFileSyncToUserConfig(userConfig);
    mainWindow.webContents.send('initialize', userConfig);
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
