export { queryClient } from './client';
export { queryKeys } from './keys';
export { useScanCompleteInvalidator } from './scanCompleteInvalidator';
export { useLibraryReady } from './useLibraryReady';

// Tracks
export {
  useTracks,
  useTrack,
  useUpdateTrack,
  useUpdateTrackMetadata,
  useUpdatePlayCount,
  useDeleteTrack,
  getTracksSnapshot,
  type TracksData,
} from './tracks';

// Playlists
export {
  usePlaylists,
  usePlaylist,
  useSmartPlaylistTracks,
  useCreatePlaylist,
  useUpdatePlaylist,
  useDeletePlaylist,
  useAddTrackToPlaylist,
  useUpdatePlaylistSortPreference,
  getPlaylistsSnapshot,
} from './playlists';

// Settings
export { useSettings, useUpdateSettings } from './settings';

// Library scan / import / backup / restore / reset
export {
  useScanLibrary,
  useImportFiles,
  useBackupLibrary,
  useRestoreLibrary,
  useResetDatabase,
  useResetTracks,
} from './library';

// Album art
export { useAlbumArt, useDownloadAlbumArt } from './albumArt';

// File system
export { useFileExists, useDeleteFile } from './fileSystem';

// Dialogs
export { useSelectDirectory, useSelectFiles } from './dialogs';

// App
export { useLogFilePath } from './app';
