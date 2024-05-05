import { useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterListIcon from '@mui/icons-material/FilterList';
import { List } from 'react-virtualized';
import { LibraryMusic, PlayArrow, Today } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { SongSkeletonStructure, StoreStructure } from '../../common/common';
import useMainStore from '../store/main';
import { convertToMMSS } from '../utils/utils';
import usePlayerStore from '../store/player';
import ReusableSongMenu from './ReusableSongMenu';

const ROW_HEIGHT = 25.5;

type FilterTypes = 'title' | 'artist' | 'album' | 'playCount' | 'dateAdded';

type FilterDirections = 'asc' | 'desc';

type LibraryListProps = {
  /**
   * @dev the width of the list container
   */
  width: number;
  /**
   * @dev the height of the row container
   */
  rowContainerHeight: number;
  /**
   * @dev the height of the row container
   */
  initialScrollIndex: number | undefined;
  /**
   * @dev a hook for when the song is double clicked
   */
  playSong: (song: string, info: StoreStructure['library'][string]) => void;
  /**
   * @dev a hook for when the user wants to import their library
   */
  onImportLibrary: () => void;
};

type SongMenuState =
  | {
      song: string;
      anchorEl: HTMLElement | null;
      songInfo: SongSkeletonStructure;
      mouseX: number;
      mouseY: number;
    }
  | undefined;

export default function LibraryList({
  width,
  rowContainerHeight,
  initialScrollIndex,
  playSong,
  onImportLibrary,
}: LibraryListProps) {
  /**
   * @dev store hooks
   */
  const storeLibrary = useMainStore((store) => store.library);
  const currentSong = usePlayerStore((store) => store.currentSong);
  const filteredLibrary = usePlayerStore((store) => store.filteredLibrary);
  const overrideScrollToIndex = usePlayerStore(
    (store) => store.overrideScrollToIndex,
  );
  const setOverrideScrollToIndex = usePlayerStore(
    (store) => store.setOverrideScrollToIndex,
  );

  useEffect(() => {
    if (overrideScrollToIndex !== undefined) {
      setTimeout(() => {
        setOverrideScrollToIndex(undefined);
      }, 10);
    }
  }, [overrideScrollToIndex, setOverrideScrollToIndex]);

  const scrollToIndex =
    overrideScrollToIndex === undefined
      ? initialScrollIndex
      : overrideScrollToIndex;

  const setFilteredLibrary = usePlayerStore(
    (store) => store.setFilteredLibrary,
  );

  /**
   * @dev state
   */
  const [filterType, setFilterType] = useState<FilterTypes>('artist');
  const [filterDirection, setFilterDirection] =
    useState<FilterDirections>('desc');
  const [songMenu, setSongMenu] = useState<SongMenuState>(undefined);

  const filterByTitle = () => {
    if (!storeLibrary) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      const aTitle = filteredLibrary[a].common.title?.toLowerCase() || '';
      const bTitle = filteredLibrary[b].common.title?.toLowerCase() || '';
      const val = aTitle.localeCompare(bTitle);
      if (filterDirection === 'desc') {
        return val * -1;
      }
      return val;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('title');
  };

  const filterByArtist = () => {
    if (!storeLibrary) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      const artistA = filteredLibrary[a].common?.artist
        ?.toLowerCase()
        .replace(/^the /, '');
      const artistB = filteredLibrary[b].common?.artist
        ?.toLowerCase()
        .replace(/^the /, '');
      const albumA = filteredLibrary[a].common?.album?.toLowerCase();
      const albumB = filteredLibrary[b].common?.album?.toLowerCase();
      const trackA = filteredLibrary[a].common?.track?.no;
      const trackB = filteredLibrary[b].common?.track?.no;
      // handle null cases
      if (!artistA) return filterDirection === 'asc' ? -1 : 1;
      if (!artistB) return filterDirection === 'asc' ? 1 : -1;

      if (!albumA) return -1;
      if (!albumB) return 1;
      if (!trackA) return -1;
      if (!trackB) return 1;

      if (artistA < artistB) return filterDirection === 'asc' ? -1 : 1;
      if (artistA > artistB) return filterDirection === 'asc' ? 1 : -1;

      if (albumA < albumB) return -1;
      if (albumA > albumB) return 1;
      if (trackA < trackB) return -1;
      if (trackA > trackB) return 1;
      return 0;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('artist');
  };

  const filterByPlayCount = () => {
    if (!storeLibrary) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      const aPlayCount = filteredLibrary[a].additionalInfo?.playCount || 0;
      const bPlayCount = filteredLibrary[b].additionalInfo?.playCount || 0;
      if (aPlayCount < bPlayCount) return filterDirection === 'asc' ? -1 : 1;
      if (aPlayCount > bPlayCount) return filterDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('playCount');
  };

  const filterByAlbum = () => {
    if (!storeLibrary) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      // sort by album, then track number
      const albumA = filteredLibrary[a].common?.album?.toLowerCase();
      const albumB = filteredLibrary[b].common?.album?.toLowerCase();
      const trackA = filteredLibrary[a].common?.track?.no;
      const trackB = filteredLibrary[b].common?.track?.no;
      // handle null cases
      if (!albumA) return filterDirection === 'asc' ? -1 : 1;
      if (!albumB) return filterDirection === 'asc' ? 1 : -1;
      if (!trackA) return -1;
      if (!trackB) return 1;

      if (albumA < albumB) return filterDirection === 'asc' ? -1 : 1;
      if (albumA > albumB) return filterDirection === 'asc' ? 1 : -1;

      if (trackA < trackB) return -1;
      if (trackA > trackB) return 1;

      return 0;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('album');
  };

  const filterByDateAdded = () => {
    if (!storeLibrary) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      const aDateAdded = filteredLibrary[a].additionalInfo?.dateAdded || 0;
      const bDateAdded = filteredLibrary[b].additionalInfo?.dateAdded || 0;
      if (aDateAdded < bDateAdded) return filterDirection === 'asc' ? -1 : 1;
      if (aDateAdded > bDateAdded) return filterDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('dateAdded');
  };

  /**
   * @dev render the row for the virtualized table, reps a single song
   */
  const renderSongRow = ({
    index,
    key,
    style,
  }: {
    index: number;
    key: string;
    style: any;
  }) => {
    if (!filteredLibrary) return null;
    const song = Object.keys(filteredLibrary)[index];
    return (
      <div
        key={key}
        style={style}
        onDoubleClick={async () => {
          await playSong(song, filteredLibrary[song]);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setSongMenu({
            song,
            anchorEl: e.currentTarget,
            songInfo: filteredLibrary[song],
            mouseX: e.clientX - 2,
            mouseY: e.clientY - 4,
          });
        }}
        data-state={song === currentSong ? 'selected' : undefined}
        className="flex w-full items-center border-b border-neutral-800 transition-colors hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1 divide-neutral-50"
      >
        <div className="select-none whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].common.title}
        </div>
        <div className="select-none whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].common.artist}
        </div>
        <div className="select-none whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].common.album}
        </div>
        <div className="select-none w-16 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {convertToMMSS(filteredLibrary?.[song].format.duration || 0)}
        </div>
        <div className="select-none w-16 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {new Date(
            filteredLibrary?.[song].additionalInfo.dateAdded,
          ).toLocaleDateString('en-us', {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric',
          })}
        </div>
        <div className="select-none whitespace-nowrap	overflow-hidden w-12 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].additionalInfo.playCount || '-'}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full overflow-auto">
      {/**
       * @dev this is the menu that pops up when the user right clicks on a song
       */}
      {songMenu && (
        <ReusableSongMenu
          anchorEl={songMenu?.anchorEl}
          onClose={() => {
            setSongMenu(undefined);
          }}
          mouseX={songMenu.mouseX}
          mouseY={songMenu.mouseY}
          song={songMenu?.song}
          songInfo={songMenu?.songInfo}
        />
      )}
      <div className="w-full text-[11px]  mb-[1px]">
        <div className="sticky top-0 z-50 bg-[#0d0d0d] outline outline-offset-0 outline-1 mb-[1px] outline-neutral-800">
          <div className="flex transition-colors divide-neutral-800 divide-x mr-4">
            <button
              onClick={filterByTitle}
              type="button"
              className="select-none flex leading-[1em] items-center py-1.5 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
            >
              Song
              {/* if this is the selected filter add an up or down arrow represending the filter direction */}
              {filterType === 'title' && (
                <span
                  className={`${
                    filterDirection === 'asc'
                      ? 'rotate-180'
                      : 'relative bottom-[2px]'
                  } inline-block ml-2`}
                >
                  <FilterListIcon fontSize="inherit" />
                </span>
              )}
            </button>
            <button
              onClick={filterByArtist}
              type="button"
              className="select-none flex leading-[1em] items-center py-1.5 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
            >
              Artist
              {filterType === 'artist' && (
                <span
                  className={`${
                    filterDirection === 'asc'
                      ? 'rotate-180'
                      : 'relative bottom-[2px]'
                  } inline-block ml-2`}
                >
                  <FilterListIcon fontSize="inherit" />
                </span>
              )}
            </button>
            <button
              onClick={filterByAlbum}
              type="button"
              className="select-none flex leading-[1em] items-center py-1.5 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
            >
              Album
              {filterType === 'album' && (
                <span
                  className={`${
                    filterDirection === 'asc'
                      ? 'rotate-180'
                      : 'relative bottom-[2px]'
                  } inline-block ml-2`}
                >
                  <FilterListIcon fontSize="inherit" />
                </span>
              )}
            </button>
            {/**
             * @dev slightly diff size to accomodate the lack of scroll bar
             * next to it, unlike a normal row.
             */}
            <Tooltip title="Duration">
              <button
                type="button"
                aria-label="duration"
                className="select-none flex leading-[1em] items-center py-1.5 w-16 text-center px-4 align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                <AccessTimeIcon fontSize="inherit" />
              </button>
            </Tooltip>
            <Tooltip title="Date Added">
              <button
                type="button"
                aria-label="duration"
                onClick={filterByDateAdded}
                className="select-none flex leading-[1em] items-center py-1.5 w-16 text-center px-4 align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                <Today fontSize="inherit" />
              </button>
            </Tooltip>
            <Tooltip title="Plays">
              <button
                type="button"
                aria-label="duration"
                onClick={filterByPlayCount}
                className="select-none flex leading-[1em] items-center py-1.5 w-12 text-center px-4 align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                <PlayArrow fontSize="inherit" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/**
         * @dev since the list could be 1000s of songs long we must virtualize it
         */}
        {Object.keys(filteredLibrary || {}).length ? (
          <List
            width={width || 0}
            height={rowContainerHeight}
            rowRenderer={renderSongRow}
            rowCount={Object.keys(filteredLibrary || {}).length}
            rowHeight={ROW_HEIGHT}
            scrollToAlignment="center"
            scrollToIndex={scrollToIndex}
          />
        ) : (
          <div
            className="w-full flex items-center justify-center"
            style={{
              height: rowContainerHeight,
            }}
          >
            <div className="flex flex-col gap-4 items-center">
              <h1 className="text-neutral-500">
                Please import your library...
              </h1>
              <Tooltip title="Import Library">
                <button
                  onClick={() => {
                    onImportLibrary();
                  }}
                  type="button"
                  aria-label="select library folder"
                  className="nodrag items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-black
          hover:bg-white hover:text-black
          w-16
          px-4 py-[7px] text-2xl"
                >
                  <LibraryMusic
                    fontSize="inherit"
                    sx={{
                      position: 'relative',
                      bottom: '1px',
                    }}
                  />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
