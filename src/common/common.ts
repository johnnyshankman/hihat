import { IPicture } from 'music-metadata';

export type AdditionalSongInfo = {
  playCount: number; // integer
  lastPlayed: number; // ms date timestamp
  dateAdded: number; // ms date timestamp
};

export type SongSkeletonStructure = {
  common: {
    artist?: string;
    album?: string;
    title?: string;
    track?: {
      no: number | null;
      of: number | null;
    };
    picture?: IPicture[];
    lyrics?: string[];
  };
  format: {
    duration?: number;
  };
  additionalInfo: AdditionalSongInfo;
};

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
