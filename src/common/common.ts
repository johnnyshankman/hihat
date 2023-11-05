import { IPicture } from 'music-metadata';

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
};

export type Playlist = {
  name: string;
  songs: string[];
};

export type StoreStructure = {
  library: {
    [key: string]: SongSkeletonStructure;
  };
  playlists: Playlist[];
};
