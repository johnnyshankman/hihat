import { ElectronHandler } from '../main/preload';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    hihatScrollToLibraryTrack?: (
      trackId: string,
      options?: { immediate?: boolean },
    ) => void;
    hihatScrollToPlaylistTrack?: (trackId: string) => void;
  }
}

export {};
