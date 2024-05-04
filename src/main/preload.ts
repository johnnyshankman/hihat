import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPicture } from 'music-metadata';
import { StoreStructure } from '../common/common';

export type Channels =
  | 'select-library'
  | 'add-to-library'
  | 'set-last-played-song'
  | 'initialize'
  | 'get-album-art'
  | 'copy-to-clipboard'
  | 'modify-tag-of-file'
  | 'copy-art-to-clipboard'
  | 'download-artwork'
  | 'open-in-browser'
  | 'show-in-finder'
  | 'song-imported';

export type ArgsBase = Record<Channels, unknown>;

export interface SendMessageArgs extends ArgsBase {
  'select-library': undefined;
  'add-to-library': undefined;
  'get-album-art': string;
  'set-last-played-song': string;
  'modify-tag-of-file': {
    song: string;
    key: string;
    value: string;
  };
  'copy-art-to-clipboard': {
    song: string;
  };
  'download-artwork': {
    song: string;
  };
  'copy-to-clipboard': {
    text: string;
  };
  'open-in-browser': {
    text: string;
  };
  'show-in-finder': {
    path: string;
  };
}

export interface ResponseArgs extends ArgsBase {
  'add-to-library': StoreStructure & { scrollToIndex: number };
  'select-library': StoreStructure | undefined;
  initialize: StoreStructure;
  'get-album-art': IPicture;
  'song-imported': {
    songsImported: number;
    totalSongs: number;
  };
  'set-last-played-song': StoreStructure;
}

const electronHandler = {
  ipcRenderer: {
    sendMessage<T extends Channels>(channel: T, ...args: SendMessageArgs[T][]) {
      ipcRenderer.send(channel, ...args);
    },
    on<T extends Channels>(
      channel: T,
      func: (...args: ResponseArgs[T][]) => void,
    ) {
      const subscription = (
        _event: IpcRendererEvent,
        ...args: ResponseArgs[T][]
      ) => func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once<T extends Channels>(
      channel: T,
      func: (...args: ResponseArgs[T][]) => void,
    ) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
