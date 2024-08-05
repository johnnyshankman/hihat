import { ICommonTagsResult, IFormat } from 'music-metadata';

export type AdditionalSongInfo = {
  playCount: number; // integer
  lastPlayed: number; // ms date timestamp
  dateAdded: number; // ms date timestamp
};

/**
 * Refactor this type as it's just IAudioMetaData from music-metadata
 * with AdditionalSongInfo.
 * We could just store all metadata, it's not that much data.
 */

export type LightweightAudioMetadata = {
  common: {
    artist?: ICommonTagsResult['artist'];
    album?: ICommonTagsResult['album'];
    title?: ICommonTagsResult['title'];
    track?: ICommonTagsResult['track'];
    disk: ICommonTagsResult['disk'];
  };
  format: {
    duration?: IFormat['duration'];
  };
  additionalInfo: AdditionalSongInfo;
};

export type Playlist = {
  name: string;
  songs: string[];
};

export type Library = {
  [key: string]: LightweightAudioMetadata;
};

export type StoreStructure = {
  library: {
    [key: string]: LightweightAudioMetadata;
  };
  playlists: Playlist[];
  lastPlayedSong: string; // a key into "library"
  libraryPath: string;
  initialized: boolean;
};

export const ALLOWED_EXTENSIONS = [
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
