import { IAudioMetadata } from 'music-metadata';

export type AdditionalSongInfo = {
  playCount: number; // integer
  lastPlayed: number; // ms date timestamp
  dateAdded: number; // ms date timestamp
};

/**
 * Rename to LibrarySongInfo
 */
export interface SongSkeletonStructure extends IAudioMetadata {
  additionalInfo: AdditionalSongInfo;
}

export type Playlist = {
  name: string;
  songs: string[];
};

export type Library = {
  [key: string]: SongSkeletonStructure;
};

export type StoreStructure = {
  library: {
    [key: string]: SongSkeletonStructure;
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
