import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { Tooltip } from '@mui/material';
import Marquee from 'react-fast-marquee';
import { LessOpaqueTinyText } from './SimpleStyledMaterialUIComponents';
import useMainStore from '../store/main';
import { useWindowDimensions } from '../hooks/useWindowDimensions';

export default function SongProgressAndSongDisplay({
  value,
  onManualChange,
  max,
}: {
  value: number;
  onManualChange: (value: number) => void;
  max: number;
}) {
  /**
   * @dev component state
   */
  const [position, setPosition] = useState(32);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isArtistScrolling, setIsArtistScrolling] = useState(false);

  /**
   * @dev window provider hook
   */
  const { width, height } = useWindowDimensions();

  /**
   * @dev main store hooks
   */
  const filteredLibrary = useMainStore((state) => state.filteredLibrary);
  const currentSongMetadata = useMainStore(
    (state) => state.currentSongMetadata,
  );
  const setOverrideScrollToIndex = useMainStore(
    (store) => store.setOverrideScrollToIndex,
  );

  /**
   * @dev component refs
   */
  const titleRef = useRef<HTMLDivElement>(null);
  const titleRef2 = useRef<HTMLDivElement>(null);
  const artistRef = useRef<HTMLDivElement>(null);
  const artistRef2 = useRef<HTMLDivElement>(null);

  const convertToMMSS = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    // Ensuring the format is two-digits both for minutes and seconds
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  /**
   * on click, scroll to the song in the library if possible,
   * then try to scroll to the artist if the song is not found
   */
  const scrollToSong = () => {
    const libraryArray = Object.values(filteredLibrary);
    let index = libraryArray.findIndex(
      (song) =>
        song.common.title === currentSongMetadata.common?.title &&
        song.common.artist === currentSongMetadata.common?.artist &&
        song.common.album === currentSongMetadata.common?.album,
    );

    if (index === -1) {
      index = libraryArray.findIndex(
        (song) => song.common.artist === currentSongMetadata.common?.artist,
      );
    }
    setOverrideScrollToIndex(index);
  };

  useEffect(() => {
    setPosition(value);
  }, [value]);

  useEffect(() => {
    const checkOverflow1 = () => {
      if (titleRef.current) {
        // requires going up three parent elements to get out of the marquee
        const isOverflowing =
          titleRef.current.scrollWidth >
          (titleRef.current.parentElement?.parentElement?.parentElement
            ?.scrollWidth || 10000000);
        setIsScrolling(isOverflowing);
      }
    };

    checkOverflow1();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkOverflow1);
    if (titleRef.current) {
      resizeObserver.observe(titleRef.current);
    }

    const currentTitleRef = titleRef.current;
    // Clean up the observer when the component unmounts
    return () => {
      if (currentTitleRef) {
        resizeObserver.unobserve(currentTitleRef);
      }
    };
  }, [currentSongMetadata.common?.title, width, height]);

  useEffect(() => {
    const checkOverflow2 = () => {
      if (titleRef2.current) {
        // requires going up three parent elements to get out of the marquee
        const isOverflowing =
          titleRef2.current.scrollWidth >
          (titleRef2.current.parentElement?.parentElement?.parentElement
            ?.clientWidth || 10000000);
        setIsScrolling(isOverflowing);
      }
    };

    checkOverflow2();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkOverflow2);
    if (titleRef2.current) {
      resizeObserver.observe(titleRef2.current);
    }

    // Clean up the observer when the component unmounts
    const currentTitleRef2 = titleRef2.current;
    return () => {
      if (currentTitleRef2) {
        resizeObserver.unobserve(currentTitleRef2);
      }
    };
  }, [currentSongMetadata.common?.title, width, height]);

  useEffect(() => {
    const checkOverflow3 = () => {
      if (artistRef.current) {
        // requires going up three parent elements to get out of the marquee
        const isOverflowing =
          artistRef.current.scrollWidth > artistRef.current.clientWidth;
        setIsArtistScrolling(isOverflowing);
      }
    };

    checkOverflow3();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkOverflow3);
    if (artistRef.current) {
      resizeObserver.observe(artistRef.current);
    }

    const currentArtistRef = artistRef.current;
    return () => {
      if (currentArtistRef) {
        resizeObserver.unobserve(currentArtistRef);
      }
    };
  }, [currentSongMetadata.common?.artist, width, height]);

  useEffect(() => {
    const checkOverflow4 = () => {
      if (artistRef2.current) {
        // requires going up three parent elements to get out of the marquee
        const isOverflowing =
          artistRef2.current.scrollWidth >
          (artistRef2.current.parentElement?.parentElement?.parentElement
            ?.clientWidth || 10000000);
        setIsArtistScrolling(isOverflowing);
      }
    };

    checkOverflow4();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkOverflow4);
    if (artistRef2.current) {
      resizeObserver.observe(artistRef2.current);
    }

    const currentArtistRef = artistRef2.current;
    return () => {
      if (currentArtistRef) {
        resizeObserver.unobserve(currentArtistRef);
      }
    };
  }, [currentSongMetadata.common?.artist, width, height]);

  return (
    <Box
      className="sm:w-1/3 w-full sm:px-0 px-4"
      sx={{ display: 'flex', flexDirection: 'column' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Tooltip arrow placement="top" title="Scroll to song">
          <LessOpaqueTinyText
            aria-label="current-title"
            onClick={() => {
              scrollToSong();
            }}
            sx={{
              margin: 0,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 0.75,
              },
            }}
          >
            {isScrolling ? (
              <Marquee delay={0.5} pauseOnHover speed={10}>
                <div ref={titleRef2}>
                  {currentSongMetadata.common?.title || 'No song selected'}
                  &nbsp;&nbsp;•&nbsp;&nbsp;
                </div>
              </Marquee>
            ) : (
              <div ref={titleRef}>
                {currentSongMetadata.common?.title || 'No song selected'}
              </div>
            )}
          </LessOpaqueTinyText>
        </Tooltip>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Slider
          aria-label="time-indicator"
          color="primary"
          max={max}
          min={0}
          onChange={(_, val) => {
            setPosition(val as number);
            onManualChange(val as number);
          }}
          size="small"
          step={1}
          sx={{
            color: 'rgba(133, 133, 133)',
            padding: '6px 0',
            '& .MuiSlider-thumb': {
              height: 8,
              width: 8,
            },
          }}
          value={position}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <LessOpaqueTinyText aria-label="current-time">
          {convertToMMSS(position)}
        </LessOpaqueTinyText>
        <LessOpaqueTinyText
          aria-label="current-title"
          onClick={() => {
            scrollToSong();
          }}
          sx={{
            margin: 0,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            '&:hover': {
              opacity: 0.75,
            },
          }}
        >
          {isArtistScrolling ? (
            <Marquee pauseOnHover speed={10}>
              <div ref={artistRef2}>
                {currentSongMetadata.common?.artist || 'No song selected'}
                &nbsp;&nbsp;•&nbsp;&nbsp;
              </div>
            </Marquee>
          ) : (
            <div ref={artistRef}>
              {currentSongMetadata.common?.artist || 'No song selected'}
            </div>
          )}
        </LessOpaqueTinyText>
        <LessOpaqueTinyText aria-label="current-max-time">
          -{convertToMMSS(max - position)}
        </LessOpaqueTinyText>
      </Box>
    </Box>
  );
}
