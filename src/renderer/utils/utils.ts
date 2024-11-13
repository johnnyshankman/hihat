import { LightweightAudioMetadata } from '../../common/common';

export const bufferToDataUrl = async (
  buffer: Buffer,
  format: string,
): Promise<string> => {
  const blob = new Blob([buffer], { type: format });
  const reader = new FileReader();
  reader.readAsDataURL(blob);

  const res = (await new Promise((resolve) => {
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
  })) as string;

  return res;
};

/**
 * @dev self explanatory, converts to '00:00' format a la itunes
 */
export const convertToMMSS = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};

type NextSongResult = {
  songPath: string;
  index: number;
};

export const findNextSong = (
  currentSong: string,
  filteredLibrary: { [key: string]: LightweightAudioMetadata },
  shuffle: boolean,
): NextSongResult => {
  const keys = Object.keys(filteredLibrary);
  const currentIndex = keys.indexOf(currentSong || '');

  if (shuffle) {
    const randomIndex = Math.floor(Math.random() * keys.length);
    return {
      songPath: keys[randomIndex],
      index: randomIndex,
    };
  }

  const nextIndex = currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
  return {
    songPath: keys[nextIndex],
    index: nextIndex,
  };
};

export const updateMediaSession = (metadata: LightweightAudioMetadata) => {
  const mediaData = {
    title: metadata.common.title,
    artist: metadata.common.artist,
    album: metadata.common.album,
  };

  if (navigator.mediaSession.metadata) {
    Object.assign(navigator.mediaSession.metadata, mediaData);
  } else {
    navigator.mediaSession.metadata = new MediaMetadata(mediaData);
  }
};
