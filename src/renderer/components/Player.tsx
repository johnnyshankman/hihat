import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Paper,
  Stack,
  Popover,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  VolumeUp,
  VolumeDown,
  VolumeMute,
  Repeat,
  RepeatOn,
  RepeatOne,
  Shuffle,
  ShuffleOn,
} from '@mui/icons-material';
import Marquee from 'react-fast-marquee';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { formatDuration } from '../utils/formatters';
import { useSettingsAndPlaybackStore, useUIStore } from '../stores';

// Album art placeholder component
function AlbumArtPlaceholder() {
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(to right, #1A1A1A, #121212, #0A0A0A)',
        borderRadius: '4px',
        boxShadow: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MusicNoteIcon
        sx={{
          color: 'rgba(255, 255, 255, 0.2)',
          width: '30%',
          height: '30%',
          animation: 'pulse 2s infinite ease-in-out',
          '@keyframes pulse': {
            '0%, 100%': {
              transform: 'translateY(0)',
            },
            '50%': {
              transform: 'translateY(-10px)',
            },
          },
        }}
      />
      <Typography
        sx={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          color: 'rgba(255, 255, 255, 0.5)',
        }}
        variant="caption"
      >
        hihat
      </Typography>
    </Box>
  );
}

export default function Player() {
  // Use selective state from the playback store to prevent unnecessary re-renders
  const currentTrack = useSettingsAndPlaybackStore(
    (state) => state.currentTrack,
  );
  const paused = useSettingsAndPlaybackStore((state) => state.paused);
  const position = useSettingsAndPlaybackStore((state) => state.position);
  const duration = useSettingsAndPlaybackStore((state) => state.duration);
  const volume = useSettingsAndPlaybackStore((state) => state.volume);
  const playbackSource = useSettingsAndPlaybackStore(
    (state) => state.playbackSource,
  );
  const repeatMode = useSettingsAndPlaybackStore((state) => state.repeatMode);
  const shuffleMode = useSettingsAndPlaybackStore((state) => state.shuffleMode);

  // Get actions from the store
  const setPaused = useSettingsAndPlaybackStore((state) => state.setPaused);
  const skipToNextTrack = useSettingsAndPlaybackStore(
    (state) => state.skipToNextTrack,
  );
  const skipToPreviousTrack = useSettingsAndPlaybackStore(
    (state) => state.skipToPreviousTrack,
  );
  const seekToPosition = useSettingsAndPlaybackStore(
    (state) => state.seekToPosition,
  );
  const setVolume = useSettingsAndPlaybackStore((state) => state.setVolume);
  const toggleRepeatMode = useSettingsAndPlaybackStore(
    (state) => state.toggleRepeatMode,
  );
  const toggleShuffleMode = useSettingsAndPlaybackStore(
    (state) => state.toggleShuffleMode,
  );
  const setSilentAudioRef = useSettingsAndPlaybackStore(
    (state) => state.setSilentAudioRef,
  );

  // Reference to the silent audio element
  const audioRef = useRef<HTMLAudioElement>(null);

  // Set up the silent audio ref in the playback store
  useEffect(() => {
    if (audioRef.current) {
      setSilentAudioRef(audioRef.current);
    }

    return () => {
      // Clean up the reference when the component unmounts
      setSilentAudioRef(null);
    };
  }, [setSilentAudioRef]);

  // local state
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumeAnchorEl, setVolumeAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [isTitleScrolling, setIsTitleScrolling] = useState(false);
  const [isArtistAlbumScrolling, setIsArtistAlbumScrolling] = useState(false);

  // Refs for title and artist+album text elements
  const titleRef = useRef<HTMLDivElement>(null);
  const titleRef2 = useRef<HTMLDivElement>(null);
  const artistAlbumRef = useRef<HTMLDivElement>(null);
  const artistAlbumRef2 = useRef<HTMLDivElement>(null);

  // Get the setCurrentView function from the UI store
  const setCurrentView = useUIStore((state) => state.setCurrentView);

  // Use Material UI's theme breakpoints
  const theme = useTheme();
  const isXsScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Fetch album art when current track changes
  useEffect(() => {
    if (currentTrack) {
      // Request album art from the main process
      window.electron.albumArt
        .get(currentTrack.filePath)
        .then((artData: string | null) => {
          setAlbumArt(artData);
          return artData;
        })
        .catch((error: Error) => {
          console.error('Error fetching album art:', error);
          setAlbumArt(null);
          return null;
        });

      // Send track update to main process for mini player sync
      window.electron.ipcRenderer.sendMessage(
        'player:trackUpdate',
        currentTrack,
      );
    } else {
      setAlbumArt(null);

      // Send null track update to main process for mini player sync
      window.electron.ipcRenderer.sendMessage('player:trackUpdate', null);
    }
  }, [currentTrack]);

  // Send playback state updates to main process for mini player sync
  useEffect(() => {
    window.electron.ipcRenderer.sendMessage('player:stateUpdate', {
      paused,
      duration,
      volume,
      repeatMode,
      shuffleMode,
      position,
    });
  }, [paused, duration, position, volume, repeatMode, shuffleMode]);

  // Memoize formatted duration values to prevent unnecessary recalculations
  const formattedSeekPosition = useMemo(
    () => formatDuration(position),
    [position],
  );

  // Calculate time left in the song with a negative sign
  const formattedTimeLeft = useMemo(() => {
    const timeLeftMs = duration - position;
    if (timeLeftMs <= 0 || !currentTrack) return '-0:00';
    return `-${formatDuration(timeLeftMs)}`;
  }, [duration, position, currentTrack]);

  const toggleVolumeControls = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setVolumeAnchorEl(volumeOpen ? null : event.currentTarget);
      setVolumeOpen(!volumeOpen);
    },
    [volumeOpen],
  );

  const handleVolumeClose = useCallback(() => {
    setVolumeAnchorEl(null);
    setVolumeOpen(false);
  }, []);

  // Open MiniPlayer in a new window
  const openMiniPlayer = () => {
    // Send a message to the main process to open a mini player window
    window.electron.miniPlayer.open();
  };

  // Listen for commands from mini player
  useEffect(() => {
    const unsubscribePlayPause = window.electron.ipcRenderer.on(
      'player:playPause' as any,
      () => {
        setPaused(!paused);
      },
    );

    const unsubscribeNextTrack = window.electron.ipcRenderer.on(
      'player:nextTrack' as any,
      () => {
        skipToNextTrack();
      },
    );

    const unsubscribePreviousTrack = window.electron.ipcRenderer.on(
      'player:previousTrack' as any,
      () => {
        skipToPreviousTrack();
      },
    );

    const unsubscribeSeek = window.electron.ipcRenderer.on(
      'player:seek' as any,
      (...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === 'number') {
          seekToPosition(args[0]);
        }
      },
    );

    const unsubscribeSetVolume = window.electron.ipcRenderer.on(
      'player:setVolume' as any,
      (...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === 'number') {
          setVolume(args[0]);
        }
      },
    );

    const unsubscribeToggleRepeat = window.electron.ipcRenderer.on(
      'player:toggleRepeat' as any,
      () => {
        toggleRepeatMode();
      },
    );

    const unsubscribeToggleShuffle = window.electron.ipcRenderer.on(
      'player:toggleShuffle' as any,
      () => {
        toggleShuffleMode();
      },
    );

    // Add listeners for menu keyboard shortcuts
    const unsubscribeMenuNext = window.electron.ipcRenderer.on(
      'playback:next' as any,
      () => {
        skipToNextTrack();
      },
    );

    const unsubscribeMenuPrevious = window.electron.ipcRenderer.on(
      'playback:previous' as any,
      () => {
        skipToPreviousTrack();
      },
    );

    const unsubscribeVolumeUp = window.electron.ipcRenderer.on(
      'playback:volumeUp' as any,
      () => {
        // Increase volume by 10%, capped at 1.0
        setVolume(Math.min(volume + 0.1, 1.0));
      },
    );

    const unsubscribeVolumeDown = window.electron.ipcRenderer.on(
      'playback:volumeDown' as any,
      () => {
        // Decrease volume by 10%, with minimum of 0
        setVolume(Math.max(volume - 0.1, 0));
      },
    );

    const unsubscribeMenuToggleRepeat = window.electron.ipcRenderer.on(
      'playback:toggleRepeat' as any,
      () => {
        toggleRepeatMode();
      },
    );

    const unsubscribeMenuToggleShuffle = window.electron.ipcRenderer.on(
      'playback:toggleShuffle' as any,
      () => {
        toggleShuffleMode();
      },
    );

    // Clean up listeners on unmount
    return () => {
      unsubscribePlayPause();
      unsubscribeNextTrack();
      unsubscribePreviousTrack();
      unsubscribeSeek();
      unsubscribeSetVolume();
      unsubscribeToggleRepeat();
      unsubscribeToggleShuffle();
      unsubscribeMenuNext();
      unsubscribeMenuPrevious();
      unsubscribeVolumeUp();
      unsubscribeVolumeDown();
      unsubscribeMenuToggleRepeat();
      unsubscribeMenuToggleShuffle();
    };
  }, [
    skipToNextTrack,
    skipToPreviousTrack,
    seekToPosition,
    setVolume,
    toggleRepeatMode,
    toggleShuffleMode,
    setPaused,
    paused,
    volume,
  ]);

  // Setup MediaSession API
  useEffect(() => {
    if (!navigator.mediaSession) {
      console.error('Media Session not supported');
      return () => {};
    }

    // Set up action handlers
    navigator.mediaSession.setActionHandler(
      'previoustrack',
      skipToPreviousTrack,
    );
    navigator.mediaSession.setActionHandler('nexttrack', skipToNextTrack);

    navigator.mediaSession.setActionHandler('play', () => {
      setPaused(false);
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      setPaused(true);
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seekToPosition(details.seekTime);
      }
    });

    // Update position state
    try {
      const safePosition = Math.min(position, duration);
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: safePosition,
      });
    } catch (error) {
      console.error('Failed to update media session position state:', error);
    }

    // Cleanup action handlers when component unmounts
    return () => {
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, [
    position,
    duration,
    skipToNextTrack,
    skipToPreviousTrack,
    setPaused,
    seekToPosition,
  ]);

  // Render volume icon based on volume level
  const renderVolumeIcon = () => {
    if (volume === 0) {
      return <VolumeMute />;
    }
    if (volume < 0.5) {
      return <VolumeDown />;
    }
    return <VolumeUp />;
  };

  // Render repeat icon based on repeat mode
  const renderRepeatIcon = () => {
    const iconSize = 'small';

    switch (repeatMode) {
      case 'track':
        return <RepeatOne color="primary" fontSize={iconSize} />;
      case 'all':
        return <RepeatOn color="primary" fontSize={iconSize} />;
      case 'off':
      default:
        return <Repeat fontSize={iconSize} />;
    }
  };

  // Get tooltip text based on repeat mode
  const getRepeatTooltipText = () => {
    switch (repeatMode) {
      case 'off':
        return 'Repeat: Off';
      case 'track':
        return 'Repeat: Current Track';
      case 'all':
        return 'Repeat: All';
      default:
        return 'Repeat';
    }
  };

  // Render shuffle icon based on shuffle mode
  const renderShuffleIcon = () => {
    const iconSize = 'small';

    if (shuffleMode) {
      return <ShuffleOn color="primary" fontSize={iconSize} />;
    }
    return <Shuffle fontSize={iconSize} />;
  };

  // Get tooltip text based on shuffle mode
  const getShuffleTooltipText = () => {
    return shuffleMode ? 'Shuffle: On' : 'Shuffle: Off';
  };

  // Handle click on track title to scroll to it in the appropriate view
  const handleTrackTitleClick = useCallback(() => {
    if (!currentTrack || !playbackSource) return;

    // First, navigate to the appropriate view if needed
    if (playbackSource === 'library') {
      setCurrentView('library');

      // Wait a short time for the view to change before scrolling
      setTimeout(() => {
        // @ts-ignore - Custom property added to window
        if (window.hihatScrollToLibraryTrack) {
          // @ts-ignore
          window.hihatScrollToLibraryTrack(currentTrack.id);
        }
      }, 100);
    } else if (playbackSource === 'playlist') {
      setCurrentView('playlists');

      // Wait a short time for the view to change before scrolling
      setTimeout(() => {
        // @ts-ignore - Custom property added to window
        if (window.hihatScrollToPlaylistTrack) {
          // @ts-ignore
          window.hihatScrollToPlaylistTrack(currentTrack.id);
        }
      }, 100);
    }
  }, [currentTrack, playbackSource, setCurrentView]);

  // Check if title text overflows its container
  useEffect(() => {
    const checkTitleOverflow = () => {
      if (titleRef.current) {
        const isOverflowing =
          titleRef.current.scrollWidth > titleRef.current.clientWidth;
        setIsTitleScrolling(isOverflowing);
      }
    };

    checkTitleOverflow();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkTitleOverflow);
    if (titleRef.current) {
      resizeObserver.observe(titleRef.current);
    }

    const currentTitleRef = titleRef.current;
    return () => {
      if (currentTitleRef) {
        resizeObserver.unobserve(currentTitleRef);
      }
    };
  }, [currentTrack?.title]);

  // Check if title text in marquee overflows
  useEffect(() => {
    const checkTitleOverflow2 = () => {
      if (titleRef2.current) {
        const isOverflowing =
          titleRef2.current.scrollWidth >
          (titleRef2.current.parentElement?.parentElement?.parentElement
            ?.clientWidth || 10000000);
        setIsTitleScrolling(isOverflowing);
      }
    };

    checkTitleOverflow2();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkTitleOverflow2);
    if (titleRef2.current) {
      resizeObserver.observe(titleRef2.current);
    }

    const currentTitleRef2 = titleRef2.current;
    return () => {
      if (currentTitleRef2) {
        resizeObserver.unobserve(currentTitleRef2);
      }
    };
  }, [currentTrack?.title]);

  // Check if artist+album text overflows its container
  useEffect(() => {
    const checkArtistAlbumOverflow = () => {
      if (artistAlbumRef.current) {
        const isOverflowing =
          artistAlbumRef.current.scrollWidth >
          artistAlbumRef.current.clientWidth;
        setIsArtistAlbumScrolling(isOverflowing);
      }
    };

    checkArtistAlbumOverflow();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkArtistAlbumOverflow);
    if (artistAlbumRef.current) {
      resizeObserver.observe(artistAlbumRef.current);
    }

    const currentArtistAlbumRef = artistAlbumRef.current;
    return () => {
      if (currentArtistAlbumRef) {
        resizeObserver.unobserve(currentArtistAlbumRef);
      }
    };
  }, [currentTrack?.artist, currentTrack?.album]);

  // Check if artist+album text in marquee overflows
  useEffect(() => {
    const checkArtistAlbumOverflow2 = () => {
      if (artistAlbumRef2.current) {
        const isOverflowing =
          artistAlbumRef2.current.scrollWidth >
          (artistAlbumRef2.current.parentElement?.parentElement?.parentElement
            ?.clientWidth || 10000000);
        setIsArtistAlbumScrolling(isOverflowing);
      }
    };

    checkArtistAlbumOverflow2();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkArtistAlbumOverflow2);
    if (artistAlbumRef2.current) {
      resizeObserver.observe(artistAlbumRef2.current);
    }

    const currentArtistAlbumRef2 = artistAlbumRef2.current;
    return () => {
      if (currentArtistAlbumRef2) {
        resizeObserver.unobserve(currentArtistAlbumRef2);
      }
    };
  }, [currentTrack?.artist, currentTrack?.album]);

  return (
    <Paper
      elevation={3}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderRadius: 0,
        WebkitAppRegion: 'no-drag', // Make sure the player is not draggable
      }}
    >
      {/* Silent audio element - used to keep media session alive */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        loop
        src="https://github.com/anars/blank-audio/raw/refs/heads/master/2-minutes-and-30-seconds-of-silence.mp3"
        style={{ display: 'none' }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: { xs: 1, sm: 2 },
          width: '100%',
          height: '100%',
          py: { xs: 1, sm: 2 },
          backgroundColor: (t) => t.palette.background.default,
          borderTop: '1px solid',
          borderColor: (t) => t.palette.divider,
        }}
      >
        {/* Album Art */}
        <Box
          onClick={currentTrack ? openMiniPlayer : undefined}
          sx={{
            height: '100%',
            mr: { xs: 1, sm: 2 },
            borderRadius: '4px',
            aspectRatio: '1/1',
            cursor: currentTrack ? 'pointer' : 'default',
            position: 'relative',
            '&:hover .overlay': {
              opacity: 1,
            },
          }}
        >
          {albumArt ? (
            <Box
              alt={currentTrack?.album || 'No album'}
              component="img"
              src={albumArt}
              sx={{
                width: '100%',
                height: '100%',
                aspectRatio: '1/1',
                objectFit: 'cover',
              }}
            />
          ) : (
            <AlbumArtPlaceholder />
          )}
          {currentTrack && (
            <Box
              className="overlay"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
            >
              <OpenInNewIcon sx={{ color: 'white' }} />
            </Box>
          )}
        </Box>

        {/* Track info */}
        <Box
          sx={{
            width: { xs: '15%', sm: '20%' },
            overflow: 'hidden',
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {currentTrack ? (
            <>
              <Tooltip
                arrow
                placement="top"
                title={
                  playbackSource
                    ? `Click to view in ${playbackSource === 'library' ? 'Library' : 'Playlist'}`
                    : ''
                }
              >
                <Typography
                  onClick={handleTrackTitleClick}
                  sx={{
                    cursor: playbackSource ? 'pointer' : 'default',
                    '&:hover': {
                      textDecoration: playbackSource ? 'underline' : 'none',
                      color: playbackSource ? 'primary.main' : 'inherit',
                    },
                    transition: 'color 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  variant="body1"
                >
                  {isTitleScrolling ? (
                    <Marquee delay={0.5} pauseOnHover speed={10}>
                      <div ref={titleRef2}>
                        {currentTrack.title}&nbsp;&nbsp;•&nbsp;&nbsp;
                      </div>
                    </Marquee>
                  ) : (
                    <div ref={titleRef}>{currentTrack.title}</div>
                  )}
                </Typography>
              </Tooltip>
              <Typography
                color="textSecondary"
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                variant="body2"
              >
                {isArtistAlbumScrolling ? (
                  <Marquee delay={0.5} pauseOnHover speed={10}>
                    <div ref={artistAlbumRef2}>
                      {currentTrack.artist} • {currentTrack.album}
                      &nbsp;&nbsp;•&nbsp;&nbsp;
                    </div>
                  </Marquee>
                ) : (
                  <div ref={artistAlbumRef}>
                    {currentTrack.artist} • {currentTrack.album}
                  </div>
                )}
              </Typography>
            </>
          ) : (
            <Typography color="textSecondary" variant="body1">
              No track playing
            </Typography>
          )}
        </Box>

        {/* Playback controls */}
        <Box
          sx={{
            width: { xs: '85%', sm: '50%' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 1, sm: 2 },
            py: 1,
            flexGrow: 1,
          }}
        >
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="center"
            spacing={{ xs: 0.25, sm: 1 }}
            sx={{ mb: 0.0, width: '100%' }}
          >
            <Tooltip title={getRepeatTooltipText()}>
              <span>
                <IconButton
                  disabled={!currentTrack}
                  onClick={toggleRepeatMode}
                  size="small"
                  sx={{
                    padding: { xs: '4px', sm: '8px' },
                  }}
                >
                  {renderRepeatIcon()}
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              disabled={!currentTrack}
              onClick={skipToPreviousTrack}
              size="medium"
              sx={{
                padding: { xs: '4px', sm: '8px' },
              }}
            >
              <SkipPrevious fontSize={isXsScreen ? 'small' : 'medium'} />
            </IconButton>
            <IconButton
              disabled={!currentTrack}
              onClick={() => setPaused(!paused)}
              size="large"
              sx={{
                mx: { xs: 0.25, sm: 1 },
                padding: { xs: '8px', sm: '12px' },
              }}
            >
              {!paused ? (
                <Pause fontSize={isXsScreen ? 'medium' : 'large'} />
              ) : (
                <PlayArrow fontSize={isXsScreen ? 'medium' : 'large'} />
              )}
            </IconButton>
            <IconButton
              disabled={!currentTrack}
              onClick={skipToNextTrack}
              size="medium"
              sx={{
                padding: { xs: '4px', sm: '8px' },
              }}
            >
              <SkipNext fontSize={isXsScreen ? 'small' : 'medium'} />
            </IconButton>
            <Tooltip title={getShuffleTooltipText()}>
              <span>
                <IconButton
                  disabled={!currentTrack}
                  onClick={toggleShuffleMode}
                  size="small"
                  sx={{
                    padding: { xs: '4px', sm: '8px' },
                  }}
                >
                  {renderShuffleIcon()}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {/* Seek slider */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mt: 0.0,
              mb: 0.5,
              maxWidth: '500px',
            }}
          >
            <Typography
              color="textSecondary"
              sx={{
                mr: 1,
                minWidth: { xs: '30px', sm: '40px' },
                textAlign: 'right',
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
              }}
              variant="caption"
            >
              {formattedSeekPosition}
            </Typography>
            <Slider
              disabled={!currentTrack}
              max={duration}
              onChange={(_, val) => {
                seekToPosition(val as number);
              }}
              size="small"
              sx={{
                mx: 0.5,
                color: (t) => t.palette.grey[500],
                '& .MuiSlider-thumb': {
                  height: 8,
                  width: 8,
                },
              }}
              value={position}
            />
            <Typography
              color="textSecondary"
              sx={{
                ml: 1,
                minWidth: { xs: '30px', sm: '40px' },
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
              }}
              variant="caption"
            >
              {formattedTimeLeft}
            </Typography>
          </Box>
        </Box>

        {/* Volume control */}
        <Box
          sx={{
            width: { xs: '25%', sm: '25%' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pr: { xs: 0, sm: 1 },
          }}
        >
          <IconButton onClick={toggleVolumeControls} size="medium">
            {renderVolumeIcon()}
          </IconButton>
          <Popover
            anchorEl={volumeAnchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            disableRestoreFocus
            onClose={handleVolumeClose}
            open={volumeOpen}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
          >
            <Box
              sx={{
                height: 120,
                width: 40,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Slider
                max={1}
                onChange={(_, value) => setVolume(value as number)}
                orientation="vertical"
                size="small"
                step={0.01}
                sx={{
                  height: '100%',
                  color: (t) => t.palette.primary.main,
                }}
                value={volume}
              />
            </Box>
          </Popover>
        </Box>
      </Box>
    </Paper>
  );
}
