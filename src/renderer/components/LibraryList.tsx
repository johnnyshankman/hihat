import { useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterListIcon from '@mui/icons-material/FilterList';
import { List } from 'react-virtualized';
import {
  DragIndicator,
  LibraryMusic,
  PlayArrowRounded,
  Today,
} from '@mui/icons-material';
import { CircularProgress, Tooltip } from '@mui/material';
import Draggable from 'react-draggable';
import { LightweightAudioMetadata, StoreStructure } from '../../common/common';
import useMainStore from '../store/main';
import { convertToMMSS } from '../utils/utils';
import usePlayerStore from '../store/player';
import SongRightClickMenu from './SongRightClickMenu';

const ROW_HEIGHT = 25.5;

type FilterTypes =
  | 'title'
  | 'artist'
  | 'album'
  | 'playCount'
  | 'dateAdded'
  | 'duration';
const FILTER_TYPES: FilterTypes[] = [
  'title',
  'artist',
  'album',
  'duration',
  'playCount',
  'dateAdded',
];

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
      songInfo: LightweightAudioMetadata;
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
  const initialized = useMainStore((store) => store.initialized);
  const storeLibrary = useMainStore((store) => store.library);
  const currentSong = usePlayerStore((store) => store.currentSong);
  const filteredLibrary = usePlayerStore((store) => store.filteredLibrary);
  const overrideScrollToIndex = usePlayerStore(
    (store) => store.overrideScrollToIndex,
  );
  const setOverrideScrollToIndex = usePlayerStore(
    (store) => store.setOverrideScrollToIndex,
  );
  const [staleWidth, setStaleWidth] = useState(width);
  const [isDragging, setIsDragging] = useState(false);

  const [columnUXInfo, setColumnUXInfo] = useState([
    {
      id: 'title',
      label: 'Song',
      width: width * 0.6 - 70 - 40 - 70,
    },
    {
      id: 'artist',
      label: 'Artist',
      width: width * 0.2,
    },
    {
      id: 'album',
      label: 'Album',
      width: width * 0.2,
    },
    {
      id: 'duration',
      label: 'Time',
      width: 70,
      icon: <AccessTimeIcon fontSize="inherit" />,
    },
    {
      id: 'dateAdded',
      label: 'Added',
      width: 70,
      icon: <Today fontSize="inherit" />,
    },
    {
      id: 'playCount',
      label: 'Plays',
      width: 40,
      icon: <PlayArrowRounded fontSize="inherit" />,
    },
  ]);

  useEffect(() => {
    // recalculate the width of each column proportionally using staleWidth as the base
    if (staleWidth !== width) {
      setColumnUXInfo(
        columnUXInfo.map((column) => {
          if (
            column.id === 'dateAdded' ||
            column.id === 'playCount' ||
            column.id === 'duration'
          ) {
            return column; // Keep these columns at their initial width
          }
          return {
            ...column,
            width: Math.max((column.width / staleWidth) * width, 60),
          };
        }),
      );
      setStaleWidth(width);
    }
  }, [width]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * @dev anytime overrideScrollToIndex changes, set a timeout to
   * reset it to undefined after 10ms. this is to prevent the
   * library list from scrolling to the wrong index when the
   * library is updated.
   */
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

  const updateColumnWidth = (index: number, deltaX: number) => {
    const newColumnUXInfo = [...columnUXInfo];
    newColumnUXInfo[index].width += deltaX;

    if (newColumnUXInfo[index].width < 90) {
      newColumnUXInfo[index].width = 90;
    }

    const totalWidth = newColumnUXInfo.reduce(
      (acc, column) => acc + column.width,
      0,
    );

    if (totalWidth !== width) {
      const diff = totalWidth - width;

      if (index === 2) {
        // Album column
        newColumnUXInfo[1].width -= diff; // Adjust Artist column
      } else if (index < 3) {
        // Title or Artist column
        newColumnUXInfo[index + 1].width -= diff;
      }
    }

    if (index === 1 && newColumnUXInfo[1].width < 90) {
      newColumnUXInfo[1].width = 90;
      newColumnUXInfo[0].width -= 90 - newColumnUXInfo[1].width + deltaX;
    }

    if (index === 2 && newColumnUXInfo[2].width < 90) {
      newColumnUXInfo[2].width = 90;
      newColumnUXInfo[1].width -= 90 - newColumnUXInfo[2].width + deltaX;
    }

    if (newColumnUXInfo[0].width < 90) {
      newColumnUXInfo[0].width = 90;
    }

    setColumnUXInfo(newColumnUXInfo);
  };

  /**
   * @dev state
   */
  const [filterType, setFilterType] = useState<FilterTypes>('artist');
  const [filterDirection, setFilterDirection] =
    useState<FilterDirections>('desc');
  const [songMenu, setSongMenu] = useState<SongMenuState>(undefined);

  // create a monolothic filter function that takes in the filter type as the first param
  const filterLibrary = (filter: FilterTypes): void => {
    if (isDragging) return;
    if (!storeLibrary) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    let filtered;
    switch (filter) {
      case 'title':
        filtered = Object.keys(filteredLibrary).sort((a, b) => {
          const aTitle = filteredLibrary[a].common.title?.toLowerCase() || '';
          const bTitle = filteredLibrary[b].common.title?.toLowerCase() || '';
          const val = aTitle.localeCompare(bTitle);
          if (filterDirection === 'desc') {
            return val * -1;
          }
          return val;
        });
        break;
      case 'artist':
        filtered = Object.keys(filteredLibrary).sort((a, b) => {
          const artistA =
            filteredLibrary[a].common?.albumartist ||
            filteredLibrary[a].common?.artist;
          const artistB =
            filteredLibrary[b].common?.albumartist ||
            filteredLibrary[b].common?.artist;
          const normalizedArtistA = artistA?.toLowerCase().replace(/^the /, '');
          const normalizedArtistB = artistB?.toLowerCase().replace(/^the /, '');
          const albumA = filteredLibrary[a].common?.album?.toLowerCase();
          const albumB = filteredLibrary[b].common?.album?.toLowerCase();
          const trackA = filteredLibrary[a].common?.track?.no;
          const trackB = filteredLibrary[b].common?.track?.no;
          // handle null cases
          if (!normalizedArtistA) return filterDirection === 'asc' ? -1 : 1;
          if (!normalizedArtistB) return filterDirection === 'asc' ? 1 : -1;

          if (!albumA) return -1;
          if (!albumB) return 1;
          if (!trackA) return -1;
          if (!trackB) return 1;

          if (normalizedArtistA < normalizedArtistB)
            return filterDirection === 'asc' ? -1 : 1;
          if (normalizedArtistA > normalizedArtistB)
            return filterDirection === 'asc' ? 1 : -1;

          if (albumA < albumB) return -1;
          if (albumA > albumB) return 1;
          if (trackA < trackB) return -1;
          if (trackA > trackB) return 1;
          return 0;
        });
        break;
      case 'album':
        filtered = Object.keys(filteredLibrary).sort((a, b) => {
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
        break;
      case 'playCount':
        filtered = Object.keys(filteredLibrary).sort((a, b) => {
          const aPlayCount = filteredLibrary[a].additionalInfo?.playCount || 0;
          const bPlayCount = filteredLibrary[b].additionalInfo?.playCount || 0;
          if (aPlayCount < bPlayCount)
            return filterDirection === 'asc' ? -1 : 1;
          if (aPlayCount > bPlayCount)
            return filterDirection === 'asc' ? 1 : -1;
          return 0;
        });
        break;
      case 'dateAdded':
        filtered = Object.keys(filteredLibrary).sort((a, b) => {
          const aDateAdded = filteredLibrary[a].additionalInfo?.dateAdded || 0;
          const bDateAdded = filteredLibrary[b].additionalInfo?.dateAdded || 0;
          if (aDateAdded < bDateAdded)
            return filterDirection === 'asc' ? -1 : 1;
          if (aDateAdded > bDateAdded)
            return filterDirection === 'asc' ? 1 : -1;
          return 0;
        });
        break;
      default:
        filtered = Object.keys(filteredLibrary);
    }

    // why am i doing this? cant i just set directly?
    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType(filter);
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
        className="flex w-full items-center border-b last:border-b-0 border-neutral-800 transition-colors hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1 divide-neutral-50"
        data-state={song === currentSong ? 'selected' : undefined}
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
        onDoubleClick={async () => {
          await playSong(song, filteredLibrary[song]);
        }}
        style={style}
      >
        <div
          className={`select-none whitespace-nowrap	overflow-hidden py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0`}
          style={{
            width: `${columnUXInfo[0].width}px`,
          }}
        >
          {filteredLibrary?.[song].common.title}
        </div>
        <div
          className="select-none whitespace-nowrap	overflow-hidden py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0"
          style={{
            width: `${columnUXInfo[1].width}px`,
          }}
        >
          {filteredLibrary?.[song].common.artist}
        </div>
        <div
          className="select-none whitespace-nowrap	overflow-hidden py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0"
          style={{
            width: `${columnUXInfo[2].width}px`,
          }}
        >
          {filteredLibrary?.[song].common.album}
        </div>
        <div
          className="select-none py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0"
          style={{
            width: `${columnUXInfo[3].width}px`,
          }}
        >
          {convertToMMSS(filteredLibrary?.[song].format.duration || 0)}
        </div>
        <div
          className="select-none py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0"
          style={{
            width: `${columnUXInfo[4].width}px`,
          }}
        >
          {new Date(
            filteredLibrary?.[song].additionalInfo.dateAdded,
          ).toLocaleDateString('en-us', {
            year: '2-digit',
            month: 'numeric',
            day: 'numeric',
          })}
        </div>
        <div
          className="select-none whitespace-nowrap	overflow-hidden py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0"
          style={{
            width: `${columnUXInfo[5].width}px`,
          }}
        >
          {filteredLibrary?.[song].additionalInfo.playCount || '-'}
        </div>
      </div>
    );
  };

  const hasSongs = Object.keys(filteredLibrary || {}).length;

  return (
    <div className="w-full">
      {/**
       * @dev this is the menu that pops up when the user right clicks on a song
       */}
      {songMenu && (
        <SongRightClickMenu
          anchorEl={songMenu?.anchorEl}
          mouseX={songMenu.mouseX}
          mouseY={songMenu.mouseY}
          onClose={() => {
            setSongMenu(undefined);
          }}
          song={songMenu?.song}
          songInfo={songMenu?.songInfo}
        />
      )}
      <div className="w-full text-[11px]">
        <div className="sticky top-0 z-50 bg-[#0d0d0d] outline outline-offset-0 outline-1 mb-[1px] outline-neutral-800">
          <div className="flex transition-colors divide-neutral-800 divide-x mr-4">
            {FILTER_TYPES.map((filter, index) => (
              <button
                key={filter}
                className={`select-none flex flow-row leading-[1em] items-center justify-between py-1.5 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0`}
                onClick={() => filterLibrary(filter)}
                style={{
                  width: `${columnUXInfo[index].width}px`,
                }}
                type="button"
              >
                <span
                  className={`select-none flex items-center text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0`}
                >
                  {columnUXInfo[index].icon || columnUXInfo[index].label}
                  {filterType === filter && (
                    <span
                      className={`${
                        filterDirection === 'asc' ? 'rotate-180' : 'relative'
                      } inline-block ml-2`}
                    >
                      <FilterListIcon fontSize="inherit" />
                    </span>
                  )}
                </span>
                {
                  // dont show when the last column
                  filter !== 'playCount' &&
                    filter !== 'dateAdded' &&
                    filter !== 'duration' && (
                      <Draggable
                        axis="x"
                        bounds="parent"
                        defaultClassName="DragHandle"
                        defaultClassNameDragging="DragHandleActive"
                        onDrag={(event, { deltaX }) => {
                          updateColumnWidth(index, deltaX);
                        }}
                        onStart={() => {
                          setIsDragging(true);
                        }}
                        onStop={() => {
                          window.setTimeout(() => {
                            setIsDragging(false);
                          }, 100);
                        }}
                        // @ts-expect-error - purposely breaking the lib so transform results in bunk transform
                        position={{ x: 0 }}
                      >
                        <DragIndicator fontSize="inherit" />
                      </Draggable>
                    )
                }
              </button>
            ))}
          </div>
        </div>

        {/**
         * @dev Loading UX for when the library is being loaded from main process over IPC
         */}
        {!initialized && (
          <div
            className="w-full flex items-center justify-center"
            style={{
              height: rowContainerHeight,
            }}
          >
            <div className="flex flex-col gap-4 items-center">
              <h1 className="text-neutral-500 text-base">Loading</h1>
              <CircularProgress
                className="ml-2"
                size={20}
                sx={{
                  color: 'white',
                }}
              />
            </div>
          </div>
        )}

        {/**
         * @dev since the list could be 1000s of songs long we must virtualize it
         */}
        {initialized && width && hasSongs && (
          <List
            height={rowContainerHeight}
            rowCount={Object.keys(filteredLibrary || {}).length}
            rowHeight={ROW_HEIGHT}
            rowRenderer={renderSongRow}
            scrollToAlignment="center"
            scrollToIndex={scrollToIndex}
            width={width}
          />
        )}

        {/**
         * @dev FTUE for when the user has no songs in their library
         */}
        {!hasSongs && initialized && (
          <div
            className="w-full flex items-center justify-center"
            style={{
              height: rowContainerHeight,
            }}
          >
            <div className="flex flex-col gap-4 items-center">
              <h1 className="text-neutral-500">
                Please select your library folder...
              </h1>
              <Tooltip title="Import Library">
                <button
                  aria-label="select library folder"
                  className="nodrag items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-black
          hover:bg-white hover:text-black
          w-16
          px-4 py-[7px] text-2xl"
                  onClick={() => {
                    onImportLibrary();
                  }}
                  type="button"
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
