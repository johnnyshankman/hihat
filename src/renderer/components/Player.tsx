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
import { usePlaybackStore } from '../stores';

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
        variant="caption"
        sx={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          color: 'rgba(255, 255, 255, 0.5)',
        }}
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

    const unsubscribePausePlayback = window.electron.ipcRenderer.on(
      'player:pausePlayback' as any,
      () => {
        setPaused(true);
      },
    );

    const unsubscribeResumePlayback = window.electron.ipcRenderer.on(
      'player:resumePlayback' as any,
      () => {
        setPaused(false);
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
      unsubscribePausePlayback();
      unsubscribeResumePlayback();
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
          onClick={currentTrack ? openMiniPlayer : undefined}
        >
          {albumArt ? (
            <Box
              component="img"
              src={albumArt}
              alt={currentTrack?.album || 'No album'}
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
                title={
                  playbackSource
                    ? `Click to view in ${playbackSource === 'library' ? 'Library' : 'Playlist'}`
                    : ''
                }
                placement="top"
                arrow
              >
                <Typography
                  variant="body1"
                  noWrap
                  sx={{
                    cursor: playbackSource ? 'pointer' : 'default',
                    '&:hover': {
                      textDecoration: playbackSource ? 'underline' : 'none',
                      color: playbackSource ? 'primary.main' : 'inherit',
                    },
                    transition: 'color 0.2s',
                  }}
                >
                  {currentTrack.title}
                </Typography>
              </Tooltip>
              <Typography variant="body2" color="textSecondary" noWrap>
                {currentTrack.artist} • {currentTrack.album}
              </Typography>
            </>
          ) : (
            <Typography variant="body1" color="textSecondary">
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
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ mb: 0.0, width: '100%' }}
          >
            <Tooltip title={getRepeatTooltipText()}>
              <IconButton onClick={toggleRepeatMode} size="small">
                {renderRepeatIcon()}
              </IconButton>
            </Tooltip>
            <IconButton
              onClick={skipToPreviousTrack}
              disabled={!currentTrack}
              size="medium"
            >
              <SkipPrevious fontSize="medium" />
            </IconButton>
            <IconButton
              onClick={() => setPaused(!paused)}
              disabled={!currentTrack}
              sx={{ mx: 1 }}
              size="large"
            >
              {!paused ? (
                <Pause fontSize="large" />
              ) : (
                <PlayArrow fontSize="large" />
              )}
            </IconButton>
            <IconButton
              onClick={skipToNextTrack}
              disabled={!currentTrack}
              size="medium"
            >
              <SkipNext fontSize="medium" />
            </IconButton>
            <Tooltip title={getShuffleTooltipText()}>
              <IconButton
                onClick={toggleShuffleMode}
                size="small"
                disabled={!currentTrack}
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
              variant="caption"
              color="textSecondary"
              sx={{ mr: 1, minWidth: '40px', textAlign: 'right' }}
            >
              {formattedSeekPosition}
            </Typography>
            <Slider
              size="small"
              value={position}
              max={duration}
              onChange={(_, val) => {
                seekToPosition(val as number);
              }}
              disabled={!currentTrack}
              sx={{
                mx: 0.5,
                color: (theme) => theme.palette.grey[500],
                '& .MuiSlider-thumb': {
                  height: 8,
                  width: 8,
                },
              }}
            />
            <Typography
              variant="caption"
              color="textSecondary"
              sx={{ ml: 1, minWidth: '40px' }}
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
            open={volumeOpen}
            anchorEl={volumeAnchorEl}
            onClose={handleVolumeClose}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            disableRestoreFocus
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
                orientation="vertical"
                size="small"
                value={volume}
                max={1}
                step={0.01}
                onChange={(_, value) => setVolume(value as number)}
                sx={{
                  height: '100%',
                  color: (theme) => theme.palette.primary.main,
                }}
              />
            </Box>
          </Popover>
        </Box>
      </Box>
    </Paper>
  );
}
