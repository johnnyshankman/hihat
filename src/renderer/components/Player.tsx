import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Paper,
  Stack,
  Popover,
  Tooltip,
  Badge,
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
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import Marquee from 'react-fast-marquee';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import MaterialSymbolIcon from './MaterialSymbolIcon';
import {
  useSettingsAndPlaybackStore,
  useUIStore,
  useLibraryStore,
} from '../stores';
import PositionDisplay from './PositionDisplay';

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

// Notification button component
function NotificationButton() {
  const notifications = useUIStore((state) => state.notifications);
  const panelOpen = useUIStore((state) => state.notificationPanelOpen);
  const setPanelOpen = useUIStore((state) => state.setNotificationPanelOpen);

  return (
    <Tooltip
      arrow
      placement="top"
      title={panelOpen ? 'Hide Notifications' : 'Show Notifications'}
    >
      <IconButton
        data-testid="notification-button"
        onClick={() => setPanelOpen(!panelOpen)}
        size="medium"
        sx={{
          color: panelOpen ? 'primary.main' : 'text.secondary',
          '&:hover': {
            color: panelOpen ? 'primary.dark' : 'text.primary',
          },
        }}
      >
        <Badge
          badgeContent={notifications.length}
          color="error"
          invisible={notifications.length === 0}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              height: '16px',
              minWidth: '16px',
              padding: '0 4px',
            },
          }}
        >
          <NotificationsIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}

function Player() {
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
  const skipInProgress = useSettingsAndPlaybackStore(
    (state) => state.skipInProgress,
  );

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
  const trackInfoRef = useRef<HTMLDivElement>(null);

  // Get the setCurrentView function from the UI store
  const setCurrentView = useUIStore((state) => state.setCurrentView);

  // Browser toggle state
  const browserOpen = useUIStore((state) => state.browserOpen);
  const setBrowserOpen = useUIStore((state) => state.setBrowserOpen);

  // Get the clearAllBrowserFilters function from the library store
  const clearAllBrowserFilters = useLibraryStore(
    (state) => state.clearAllBrowserFilters,
  );

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

  // Position-related formatting moved to PositionDisplay component to isolate updates

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

  // Get icon size for play/pause button
  const getPlayPauseIconSize = () => {
    if (isXsScreen) return 'medium';
    return 'large';
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

      // Clear any active browser filter to ensure the track is visible
      clearAllBrowserFilters();

      // Small delay to allow React to start mounting the Library component
      // The scrollToTrackWhenReady function will poll until the table is fully ready
      setTimeout(() => {
        if (window.hihatScrollToLibraryTrack) {
          window.hihatScrollToLibraryTrack(currentTrack.id);
        }
      }, 50);
    } else if (playbackSource === 'playlist') {
      setCurrentView('playlists');

      // Small delay to allow React to start mounting the Playlists component
      // The scrollToTrackWhenReady function will poll until the table is fully ready
      setTimeout(() => {
        if (window.hihatScrollToPlaylistTrack) {
          window.hihatScrollToPlaylistTrack(currentTrack.id);
        }
      }, 50);
    }
  }, [currentTrack, playbackSource, setCurrentView, clearAllBrowserFilters]);

  // Check if title text overflows its container
  useEffect(() => {
    const checkTitleOverflow = () => {
      // Try to measure from the static ref first
      if (titleRef.current) {
        const isOverflowing =
          titleRef.current.scrollWidth > titleRef.current.clientWidth;
        setIsTitleScrolling(isOverflowing);
        return;
      }

      // If marquee is showing, measure the text width against the Typography container
      if (titleRef2.current) {
        const container =
          titleRef2.current.parentElement?.parentElement?.parentElement;
        if (container) {
          const textWidth = titleRef2.current.scrollWidth;
          const containerWidth = container.clientWidth;
          setIsTitleScrolling(textWidth > containerWidth);
        }
      }
    };

    checkTitleOverflow();

    // Create a ResizeObserver to watch for size changes on the Typography parent container
    const resizeObserver = new ResizeObserver(checkTitleOverflow);

    // Observe the Track Info Box which always resizes with the window
    const typographyContainer = trackInfoRef.current;
    if (typographyContainer) {
      resizeObserver.observe(typographyContainer);
    }

    return () => {
      if (typographyContainer) {
        resizeObserver.unobserve(typographyContainer);
      }
    };
  }, [currentTrack?.title]);

  // Check if artist+album text overflows its container
  useEffect(() => {
    const checkArtistAlbumOverflow = () => {
      // Try to measure from the static ref first
      if (artistAlbumRef.current) {
        const isOverflowing =
          artistAlbumRef.current.scrollWidth >
          artistAlbumRef.current.clientWidth;
        setIsArtistAlbumScrolling(isOverflowing);
        return;
      }

      // If marquee is showing, measure the text width against the Typography container
      if (artistAlbumRef2.current) {
        const container =
          artistAlbumRef2.current.parentElement?.parentElement?.parentElement;
        if (container) {
          const textWidth = artistAlbumRef2.current.scrollWidth;
          const containerWidth = container.clientWidth;
          setIsArtistAlbumScrolling(textWidth > containerWidth);
        }
      }
    };

    checkArtistAlbumOverflow();

    // Create a ResizeObserver to watch for size changes on the Typography parent container
    const resizeObserver = new ResizeObserver(checkArtistAlbumOverflow);

    // Observe the Typography component that's always present
    const typographyContainer =
      artistAlbumRef.current?.parentElement ||
      artistAlbumRef2.current?.parentElement?.parentElement?.parentElement;
    if (typographyContainer) {
      resizeObserver.observe(typographyContainer);
    }

    return () => {
      if (typographyContainer) {
        resizeObserver.unobserve(typographyContainer);
      }
    };
  }, [currentTrack?.artist, currentTrack?.album]);

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: (t) => t.palette.background.paper,
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
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          px: 2,
          width: '100%',
          height: '100%',
          py: 0,
          borderTop: '1px solid',
          borderColor: (t) => t.palette.divider,
        }}
      >
        {/* Left cell: Album Art + Track Info */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflow: 'hidden',
            minWidth: 0,
            height: '100%',
            py: 1,
          }}
        >
          {/* Album Art */}
          <Tooltip
            arrow
            placement="top"
            title={currentTrack ? 'Open MiniPlayer' : ''}
          >
            <Box
              onClick={currentTrack ? openMiniPlayer : undefined}
              sx={{
                height: '100%',
                mr: { xs: 1, sm: 2 },
                borderRadius: '4px',
                aspectRatio: '1/1',
                cursor: currentTrack ? 'pointer' : 'default',
                position: 'relative',
                flexShrink: 0,
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
          </Tooltip>

          {/* Track info */}
          <Box
            ref={trackInfoRef}
            sx={{
              flex: 1,
              minWidth: 0,
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
                      ? `Scroll to song in ${playbackSource === 'library' ? 'library' : 'playlist'}`
                      : ''
                  }
                >
                  <Typography
                    component="div"
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
                      width: 'fit-content',
                      maxWidth: '100%',
                    }}
                    variant="body1"
                  >
                    {isTitleScrolling ? (
                      <Marquee
                        gradient
                        gradientColor={theme.palette.background.default}
                        gradientWidth={10}
                        speed={10}
                      >
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
                  component="div"
                  sx={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: '500',
                  }}
                  variant="body2"
                >
                  {isArtistAlbumScrolling ? (
                    <Marquee
                      gradient
                      gradientColor={theme.palette.background.default}
                      gradientWidth={10}
                      speed={10}
                    >
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
                ---
              </Typography>
            )}
          </Box>
        </Box>

        {/* Center cell: Playback controls */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 1, sm: 2 },
            py: 1,
            minWidth: 0,
            width: 'clamp(200px, 40vw, 500px)',
          }}
        >
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="center"
            spacing={0.75}
            sx={{ mb: 0.0, width: '100%' }}
          >
            <Tooltip arrow placement="top" title={getShuffleTooltipText()}>
              <span>
                <IconButton
                  disabled={!currentTrack}
                  onClick={toggleShuffleMode}
                  size="small"
                  sx={{
                    padding: { xs: '4px', sm: '4px' },
                  }}
                >
                  {renderShuffleIcon()}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip arrow placement="top" title="Previous">
              <span>
                <IconButton
                  disabled={!currentTrack || skipInProgress}
                  onClick={skipToPreviousTrack}
                  size="medium"
                  sx={{
                    padding: { xs: '4px', sm: '4px' },
                  }}
                >
                  <SkipPrevious fontSize={isXsScreen ? 'small' : 'medium'} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip arrow placement="top" title={paused ? 'Play' : 'Pause'}>
              <span>
                <IconButton
                  disabled={!currentTrack}
                  onClick={() => setPaused(!paused)}
                  size="large"
                  sx={{
                    mx: { xs: 0.25, sm: 1 },
                    padding: { xs: '2px', sm: '2px' },
                    backgroundColor: 'text.primary',
                    color: 'background.default',
                    borderRadius: '50%',
                    '&:hover': { backgroundColor: 'text.secondary' },
                    '&.Mui-disabled': {
                      backgroundColor: 'action.disabledBackground',
                      color: 'action.disabled',
                    },
                  }}
                >
                  {!paused ? (
                    <Pause fontSize={getPlayPauseIconSize()} />
                  ) : (
                    <PlayArrow fontSize={getPlayPauseIconSize()} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip arrow placement="top" title="Next">
              <span>
                <IconButton
                  disabled={!currentTrack || skipInProgress}
                  onClick={skipToNextTrack}
                  size="medium"
                  sx={{
                    padding: { xs: '4px', sm: '4px' },
                  }}
                >
                  <SkipNext fontSize={isXsScreen ? 'small' : 'medium'} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip arrow placement="top" title={getRepeatTooltipText()}>
              <span>
                <IconButton
                  disabled={!currentTrack}
                  onClick={toggleRepeatMode}
                  size="small"
                  sx={{
                    padding: { xs: '4px', sm: '4px' },
                  }}
                >
                  {renderRepeatIcon()}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          <PositionDisplay disabled={!currentTrack} />
        </Box>

        {/* Right cell: Volume control and notifications */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pr: { xs: 0, sm: 1 },
            gap: 1,
            minWidth: 0,
          }}
        >
          {/* Notification button */}
          <NotificationButton />
          <Tooltip
            arrow
            placement="top"
            title={browserOpen ? 'Hide Browser' : 'Show Browser'}
          >
            <IconButton
              data-testid="browser-toggle"
              onClick={() => setBrowserOpen(!browserOpen)}
              size="medium"
              sx={{
                color: browserOpen ? 'primary.main' : 'text.secondary',
                '&:hover': {
                  color: browserOpen ? 'primary.dark' : 'text.primary',
                },
              }}
            >
              <MaterialSymbolIcon icon="top_panel_open" />
            </IconButton>
          </Tooltip>
          <Tooltip arrow placement="top" title="Volume">
            <IconButton onClick={toggleVolumeControls} size="medium">
              {renderVolumeIcon()}
            </IconButton>
          </Tooltip>
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

// Memoize Player component to prevent unnecessary re-renders
export default React.memo(Player);
