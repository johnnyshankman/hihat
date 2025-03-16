import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Paper,
  Stack,
  Popover,
  Tooltip,
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
  RepeatOne,
  Shuffle,
} from '@mui/icons-material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { formatDuration } from '../utils/formatters';
import { usePlaybackStore, useUIStore } from '../stores';

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
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const paused = usePlaybackStore((state) => state.paused);
  const position = usePlaybackStore((state) => state.position);
  const duration = usePlaybackStore((state) => state.duration);
  const volume = usePlaybackStore((state) => state.volume);
  const playbackSource = usePlaybackStore((state) => state.playbackSource);
  const repeatMode = usePlaybackStore((state) => state.repeatMode);
  const shuffleMode = usePlaybackStore((state) => state.shuffleMode);

  // Get actions from the store
  const setPaused = usePlaybackStore((state) => state.setPaused);
  const skipToNextTrack = usePlaybackStore((state) => state.skipToNextTrack);
  const skipToPreviousTrack = usePlaybackStore(
    (state) => state.skipToPreviousTrack,
  );
  const seekToPosition = usePlaybackStore((state) => state.seekToPosition);
  const setVolume = usePlaybackStore((state) => state.setVolume);
  const toggleRepeatMode = usePlaybackStore((state) => state.toggleRepeatMode);
  const toggleShuffleMode = usePlaybackStore(
    (state) => state.toggleShuffleMode,
  );

  // local state
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumeAnchorEl, setVolumeAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const [albumArt, setAlbumArt] = useState<string | null>(null);

  // Get the setCurrentView function from the UI store
  const setCurrentView = useUIStore((state) => state.setCurrentView);

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

    // Clean up listeners on unmount
    return () => {
      unsubscribePlayPause();
      unsubscribeNextTrack();
      unsubscribePreviousTrack();
      unsubscribeSeek();
      unsubscribeSetVolume();
      unsubscribeToggleRepeat();
      unsubscribeToggleShuffle();
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
    switch (repeatMode) {
      case 'track':
        return <RepeatOne color="primary" fontSize="small" />;
      case 'all':
        return <Repeat color="primary" fontSize="small" />;
      case 'off':
      default:
        return <Repeat fontSize="small" />;
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
    if (shuffleMode) {
      return <Shuffle color="primary" fontSize="small" />;
    }
    return <Shuffle fontSize="small" />;
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
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        autoPlay={!paused && !!currentTrack}
        className="hidden"
        loop
        src="https://github.com/anars/blank-audio/raw/refs/heads/master/2-minutes-and-30-seconds-of-silence.mp3"
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          width: '100%',
          height: '100%',
          py: 2,
        }}
      >
        {/* Album Art */}
        <Box
          onClick={currentTrack ? openMiniPlayer : undefined}
          sx={{
            width: '80px',
            height: '80px',
            mr: 2,
            borderRadius: '4px',
            overflow: 'hidden',
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
        <Box sx={{ width: '20%', overflow: 'hidden' }}>
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
                  noWrap
                  onClick={handleTrackTitleClick}
                  sx={{
                    cursor: playbackSource ? 'pointer' : 'default',
                    '&:hover': {
                      textDecoration: playbackSource ? 'underline' : 'none',
                      color: playbackSource ? 'primary.main' : 'inherit',
                    },
                    transition: 'color 0.2s',
                  }}
                  variant="body1"
                >
                  {currentTrack.title}
                </Typography>
              </Tooltip>
              <Typography color="textSecondary" noWrap variant="body2">
                {currentTrack.artist} • {currentTrack.album}
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
            width: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            py: 1,
          }}
        >
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="center"
            spacing={2}
            sx={{ mb: 0.0, width: '100%' }}
          >
            <Tooltip title={getRepeatTooltipText()}>
              <IconButton onClick={toggleRepeatMode} size="small">
                {renderRepeatIcon()}
              </IconButton>
            </Tooltip>
            <IconButton
              disabled={!currentTrack}
              onClick={skipToPreviousTrack}
              size="medium"
            >
              <SkipPrevious fontSize="medium" />
            </IconButton>
            <IconButton
              disabled={!currentTrack}
              onClick={() => setPaused(!paused)}
              size="large"
              sx={{ mx: 1 }}
            >
              {!paused ? (
                <Pause fontSize="large" />
              ) : (
                <PlayArrow fontSize="large" />
              )}
            </IconButton>
            <IconButton
              disabled={!currentTrack}
              onClick={skipToNextTrack}
              size="medium"
            >
              <SkipNext fontSize="medium" />
            </IconButton>
            <Tooltip title={getShuffleTooltipText()}>
              <IconButton
                disabled={!currentTrack}
                onClick={toggleShuffleMode}
                size="small"
              >
                {renderShuffleIcon()}
              </IconButton>
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
              sx={{ mr: 1, minWidth: '40px', textAlign: 'right' }}
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
                color: (theme) => theme.palette.grey[500],
                '& .MuiSlider-thumb': {
                  height: 8,
                  width: 8,
                },
              }}
              value={position}
            />
            <Typography
              color="textSecondary"
              sx={{ ml: 1, minWidth: '40px' }}
              variant="caption"
            >
              {formattedTimeLeft}
            </Typography>
          </Box>
        </Box>

        {/* Volume control */}
        <Box
          sx={{
            width: '25%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pr: 1,
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
                  color: (theme) => theme.palette.primary.main,
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
