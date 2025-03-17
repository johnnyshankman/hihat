/**
 * MiniPlayer Component
 *
 * This component serves as a puppet UI for the main player window.
 * It doesn't implement any playback logic directly, but instead
 * sends IPC messages to the main window to control playback.
 * All state is received from the main process and displayed here.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Stack,
  Tooltip,
  Popover,
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
  DragIndicator,
  MusicNote,
} from '@mui/icons-material';

import { formatDuration } from '../utils/formatters';

// Album art placeholder component
function AlbumArtPlaceholder() {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #1A1A1A, #0A0A0A)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitAppRegion: 'drag', // Make this area draggable
      }}
    >
      <MusicNote
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
          bottom: '16px',
          left: '16px',
          color: 'rgba(255, 255, 255, 0.5)',
        }}
        variant="caption"
      >
        hihat
      </Typography>
    </Box>
  );
}

export default function MiniPlayer() {
  // State for playback - only used for UI display
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [repeatMode, setRepeatMode] = useState<'off' | 'track' | 'all'>('off');
  const [shuffleMode, setShuffleMode] = useState(false);
  const [albumArt, setAlbumArt] = useState<string | null>(null);

  // UI state
  const [seekPosition, setSeekPosition] = useState(0);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [volumeAnchorEl, setVolumeAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  // Sync with main player
  useEffect(() => {
    // Listen for playback state updates from the main process
    const unsubscribeTrack = window.electron.miniPlayer.onTrackChange(
      (track: any) => {
        setCurrentTrack(track);
      },
    );

    const unsubscribeState = window.electron.miniPlayer.onStateChange(
      (state: any) => {
        setPaused(state.paused);
        setDuration(state.duration);
        setVolume(state.volume);
        setRepeatMode(state.repeatMode);
        setShuffleMode(state.shuffleMode);
      },
    );

    const unsubscribePosition = window.electron.miniPlayer.onPositionChange(
      (pos: number) => {
        setSeekPosition(pos);
      },
    );

    const unsubscribeAlbumArt = window.electron.miniPlayer.onAlbumArtChange(
      (art: string | null) => {
        setAlbumArt(art);
      },
    );

    // Request initial state immediately when component mounts
    window.electron.miniPlayer.requestState();

    // Set up a periodic state refresh to ensure sync
    const refreshInterval = setInterval(() => {
      window.electron.miniPlayer.requestState();
    }, 1000); // Refresh every 1 second

    // Cleanup listeners
    return () => {
      unsubscribeTrack();
      unsubscribeState();
      unsubscribePosition();
      unsubscribeAlbumArt();
      clearInterval(refreshInterval);
    };
  }, []);

  // Memoize formatted duration values
  const formattedSeekPosition = useMemo(
    () => formatDuration(seekPosition),
    [seekPosition],
  );

  // Calculate time left in the song with a negative sign
  const formattedTimeLeft = useMemo(() => {
    const timeLeftMs = duration - seekPosition;
    if (timeLeftMs <= 0 || !currentTrack) return '-0:00';
    return `-${formatDuration(timeLeftMs)}`;
  }, [duration, seekPosition, currentTrack]);

  // Handlers - all now simply forward commands to the main window
  const handlePlayPause = () => {
    // Simply send the command to the main window
    window.electron.miniPlayer.playPause();
  };

  const handleNextTrack = () => {
    // Simply send the command to the main window
    window.electron.miniPlayer.nextTrack();
  };

  const handlePreviousTrack = () => {
    if (!currentTrack) return;

    // Simply send the command to the main window
    // Let the main window handle the logic for restart vs previous
    if (seekPosition > 3) {
      window.electron.miniPlayer.seek(0);
    } else {
      window.electron.miniPlayer.previousTrack();
    }
  };

  const handleSeekChange = (_: Event, value: number | number[]) => {
    if (currentTrack) {
      setSeekPosition(value as number);
      window.electron.miniPlayer.seek(value as number);
    }
  };

  const handleVolumeChange = (_: Event, value: number | number[]) => {
    const newVolume = value as number;
    // Update local state for immediate UI feedback
    setVolume(newVolume);
    // Send the volume command directly to the main window
    window.electron.miniPlayer.setVolume(newVolume);
  };

  const toggleVolumeControls = (event: React.MouseEvent<HTMLElement>) => {
    setVolumeAnchorEl(volumeOpen ? null : event.currentTarget);
    setVolumeOpen(!volumeOpen);
  };

  const handleVolumeClose = () => {
    setVolumeAnchorEl(null);
    setVolumeOpen(false);
  };

  const toggleRepeatMode = () => {
    // Send the command directly to the main window
    window.electron.miniPlayer.toggleRepeat();
  };

  const toggleShuffleMode = () => {
    // Send the command directly to the main window
    window.electron.miniPlayer.toggleShuffle();
  };

  // Handle double-click to toggle between mini player and main window
  const handleDoubleClick = () => {
    // Close mini player and show main window
    window.electron.miniPlayer.close();
  };

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
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        bgcolor: 'black',
      }}
    >
      {/* Full-size Album Art as background - draggable area */}
      <Box
        onDoubleClick={handleDoubleClick}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          WebkitAppRegion: 'drag', // Make this area draggable
        }}
      >
        {albumArt ? (
          <Tooltip
            placement="top"
            title="Double-click to return to main window"
          >
            <Box
              alt={currentTrack?.album || 'No album'}
              component="img"
              src={albumArt}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                display: 'block',
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip
            placement="top"
            title="Double-click to return to main window"
          >
            <Box sx={{ width: '100%', height: '100%' }}>
              <AlbumArtPlaceholder />
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Drag indicator and volume control in a single container */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          padding: '2px',
        }}
      >
        <Tooltip placement="bottom" title="Adjust volume">
          <span>
            <IconButton
              onClick={toggleVolumeControls}
              size="small"
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                WebkitAppRegion: 'no-drag',
                padding: '4px',
              }}
            >
              {renderVolumeIcon()}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip placement="bottom" title="Drag to move window">
          <Box
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              WebkitAppRegion: 'drag',
              display: 'flex',
              padding: '4px',
              '&:hover': {
                color: 'rgba(255, 255, 255, 1)',
              },
            }}
          >
            <DragIndicator fontSize="small" />
          </Box>
        </Tooltip>
      </Box>

      {/* Semi-transparent overlay for better text readability - draggable area */}
      <Box
        onDoubleClick={handleDoubleClick}
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0) 100%)',
          height: '50%',
          zIndex: 1,
          WebkitAppRegion: 'drag', // Make this area draggable
        }}
      />

      {/* Content container - positioned above the album art */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          padding: '16px',
          paddingBottom: '12px',
        }}
      >
        {/* Track Info - at the bottom of the image - draggable area */}
        <Box
          onDoubleClick={handleDoubleClick}
          sx={{
            mb: 2,
            WebkitAppRegion: 'drag', // Make this area draggable
          }}
        >
          <Typography
            noWrap
            sx={{ color: 'white', textShadow: '0px 1px 3px rgba(0,0,0,0.8)' }}
            variant="h6"
          >
            {currentTrack?.title || 'No track playing'}
          </Typography>
          <Typography
            noWrap
            sx={{
              color: 'rgba(255,255,255,0.8)',
              textShadow: '0px 1px 2px rgba(0,0,0,0.6)',
            }}
            variant="body2"
          >
            {currentTrack
              ? `${currentTrack.artist} • ${currentTrack.album}`
              : ''}
          </Typography>
        </Box>

        {/* Playback Controls - non-draggable area */}
        <Box sx={{ WebkitAppRegion: 'no-drag' }}>
          {/* Seek slider */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Typography
              sx={{
                mr: 1,
                minWidth: '40px',
                textAlign: 'right',
                color: 'white',
              }}
              variant="caption"
            >
              {formattedSeekPosition}
            </Typography>
            <Slider
              disabled={!currentTrack}
              max={duration}
              onChange={handleSeekChange}
              size="small"
              sx={{
                mx: 0.5,
                color: (theme) => theme.palette.grey[500],
                '& .MuiSlider-thumb': {
                  height: 8,
                  width: 8,
                },
              }}
              value={seekPosition}
            />
            <Typography
              sx={{ ml: 1, minWidth: '40px', color: 'white' }}
              variant="caption"
            >
              {formattedTimeLeft}
            </Typography>
          </Box>

          {/* Control buttons */}
          <Stack
            alignItems="center"
            direction="row"
            justifyContent="center"
            spacing={1}
            sx={{ mb: 0 }}
          >
            <Tooltip title={getRepeatTooltipText()}>
              <span>
                <IconButton
                  onClick={toggleRepeatMode}
                  size="small"
                  sx={{ color: 'white' }}
                >
                  {renderRepeatIcon()}
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              disabled={!currentTrack}
              onClick={handlePreviousTrack}
              size="medium"
              sx={{ color: 'white' }}
            >
              <SkipPrevious fontSize="medium" />
            </IconButton>
            <IconButton
              disabled={!currentTrack}
              onClick={handlePlayPause}
              size="large"
              sx={{
                mx: 1,
                color: 'white',
              }}
            >
              {!paused ? (
                <Pause fontSize="large" />
              ) : (
                <PlayArrow fontSize="large" />
              )}
            </IconButton>
            <IconButton
              disabled={!currentTrack}
              onClick={handleNextTrack}
              size="medium"
              sx={{ color: 'white' }}
            >
              <SkipNext fontSize="medium" />
            </IconButton>
            <Tooltip title={getShuffleTooltipText()}>
              <span>
                <IconButton
                  onClick={toggleShuffleMode}
                  size="small"
                  sx={{ color: 'white' }}
                >
                  {renderShuffleIcon()}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {/* Volume Popover */}
          <Popover
            anchorEl={volumeAnchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            disableRestoreFocus
            onClose={handleVolumeClose}
            open={volumeOpen}
            transformOrigin={{
              vertical: 'top',
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
                onChange={handleVolumeChange}
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
    </Box>
  );
}
