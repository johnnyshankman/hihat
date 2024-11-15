import Tooltip from '@mui/material/Tooltip';
import { LibraryAdd } from '@mui/icons-material';
import useMainStore from '../store/main';

interface ImportNewSongsButtonProps {
  setShowImportingProgress: (show: boolean) => void;
  setSongsImported: (count: number) => void;
  setTotalSongs: (count: number) => void;
  setEstimatedTimeRemainingString: (time: string) => void;
}

export default function ImportNewSongsButton({
  setShowImportingProgress,
  setSongsImported,
  setTotalSongs,
  setEstimatedTimeRemainingString,
}: ImportNewSongsButtonProps) {
  /**
   * @dev global store hooks
   */
  const setFilteredLibrary = useMainStore((store) => store.setFilteredLibrary);
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const setOverrideScrollToIndex = useMainStore(
    (store) => store.setOverrideScrollToIndex,
  );

  const importNewSongs = async () => {
    setSongsImported(0);
    setTotalSongs(1);

    window.electron.ipcRenderer.on('song-imported', (args) => {
      setShowImportingProgress(true);
      setSongsImported(args.songsImported);
      setTotalSongs(args.totalSongs);

      const estimatedTimeRemaining = Math.floor(
        (args.totalSongs - args.songsImported) * 5,
      );

      const minutes = Math.floor(estimatedTimeRemaining / 60000);
      const seconds = Math.floor(estimatedTimeRemaining / 1000);
      const timeRemainingString =
        // eslint-disable-next-line no-nested-ternary
        minutes < 1
          ? seconds === 0
            ? 'Processing Metadata...'
            : `${seconds}s left`
          : `${minutes}mins left`;
      setEstimatedTimeRemainingString(timeRemainingString);
    });

    window.electron.ipcRenderer.once('add-to-library', (arg) => {
      if (!arg || !arg.library) {
        setShowImportingProgress(false);
        return;
      }

      setLibraryInStore(arg.library);
      setFilteredLibrary(arg.library);
      setOverrideScrollToIndex(arg.scrollToIndex);
      setShowImportingProgress(false);

      window.setTimeout(() => {
        setSongsImported(0);
        setTotalSongs(1);
      }, 1000);
    });

    window.electron.ipcRenderer.sendMessage('add-to-library');
  };

  return (
    <Tooltip title="Import New Songs">
      <button
        aria-label="import to songs"
        className="absolute top-[60px] md:top-4 right-4 items-center justify-center
    rounded-md text-[18px] ring-offset-background transition-colors
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
    focus-visible:ring-offset-2 disabled:pointer-events-none
    disabled:opacity-50 border border-neutral-800 bg-black
    hover:bg-white hover:text-black
    px-4 py-[7px] text-sm"
        onClick={importNewSongs}
        type="button"
      >
        <LibraryAdd
          fontSize="inherit"
          sx={{
            position: 'relative',
            bottom: '1px',
          }}
        />
      </button>
    </Tooltip>
  );
}
