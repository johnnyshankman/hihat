import React, { useMemo, useRef, useEffect } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Collapse,
  Paper,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PeopleIcon from '@mui/icons-material/People';
import { useLibraryStore } from '../stores';

interface ArtistBrowserProps {
  open: boolean;
  onToggle: () => void;
  selectedArtist: string | null;
  onArtistSelect: (artist: string | null) => void;
  width?: number;
}

export default function ArtistBrowser({
  open,
  onToggle,
  selectedArtist,
  onArtistSelect,
  width = 200,
}: ArtistBrowserProps) {
  const theme = useTheme();
  const tracks = useLibraryStore((state) => state.tracks);
  const isMobile = useMediaQuery('(max-width:768px)');
  const isSmallScreen = useMediaQuery('(max-width:900px)');
  const listRef = useRef<HTMLUListElement>(null);

  // Adjust width based on screen size
  let browserWidth = width;
  if (isMobile) {
    browserWidth = 150;
  } else if (isSmallScreen) {
    browserWidth = 180;
  }

  // Extract unique artists sorted alphabetically
  const artists = useMemo(() => {
    const artistSet = new Set<string>();
    tracks.forEach((track) => {
      const artist = track.albumArtist || track.artist || 'Unknown Artist';
      artistSet.add(artist);
    });
    return Array.from(artistSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [tracks]);

  // Track count per artist
  const artistTrackCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tracks.forEach((track) => {
      const artist = track.albumArtist || track.artist || 'Unknown Artist';
      counts[artist] = (counts[artist] || 0) + 1;
    });
    return counts;
  }, [tracks]);

  const handleArtistClick = (artist: string) => {
    if (selectedArtist === artist) {
      onArtistSelect(null); // Deselect if clicking the same artist
    } else {
      onArtistSelect(artist);
    }
  };

  const handleClearSelection = () => {
    onArtistSelect(null);
  };

  // Helper functions for selected text colors
  const getSelectedPrimaryColor = () => {
    return theme.palette.mode === 'dark'
      ? theme.palette.grey[900]
      : theme.palette.grey[100];
  };

  const getSelectedSecondaryColor = () => {
    return theme.palette.mode === 'dark'
      ? theme.palette.grey[700]
      : theme.palette.grey[400];
  };

  // Scroll to selected artist when it changes or when browser opens
  useEffect(() => {
    if (open && selectedArtist && listRef.current) {
      // Use setTimeout to ensure the browser is fully opened before scrolling
      setTimeout(() => {
        const selectedElement = listRef.current?.querySelector(
          `[data-artist="${CSS.escape(selectedArtist)}"]`,
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: 'auto', // Instant scroll instead of smooth
            block: 'center',
          });
        }
      }, 300); // Increased timeout to ensure collapse animation completes
    }
  }, [open, selectedArtist]);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        position: 'relative',
      }}
    >
      <Collapse
        in={open}
        orientation="horizontal"
        sx={{
          height: '100%',
          '& .MuiCollapse-wrapperInner': {
            height: '100%',
          },
        }}
      >
        <Paper
          sx={{
            width: browserWidth,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundColor:
              theme.palette.mode === 'dark'
                ? theme.palette.grey[900]
                : theme.palette.grey[50],
          }}
        >
          {/* Header */}
          <Box
            sx={{
              minHeight: '64px',
              px: 1.5,
              py: 1,
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <PeopleIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
              <Typography
                sx={{
                  fontWeight: 500,
                  fontSize: '1.25rem',
                  lineHeight: 1.6,
                }}
                variant="h6"
              >
                Artists
              </Typography>
            </Box>
            <Tooltip title="Hide artist browser">
              <IconButton
                onClick={onToggle}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Artist list */}
          <List
            ref={listRef}
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              py: 0,
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.1)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(0,0,0,0.2)',
                },
              },
            }}
          >
            {/* All Artists option */}
            <ListItemButton
              onClick={handleClearSelection}
              selected={selectedArtist === null}
              sx={{
                py: 0.4,
                px: 1.5,
                minHeight: 32,
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.05)',
                },
                '&.Mui-selected': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? theme.palette.grey[200]
                      : theme.palette.grey[800],
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? theme.palette.grey[200]
                        : theme.palette.grey[800],
                  },
                },
              }}
            >
              <ListItemText
                primary="All Artists"
                primaryTypographyProps={{
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: selectedArtist === null ? 600 : 400,
                  lineHeight: 1.2,
                  color:
                    selectedArtist === null
                      ? getSelectedPrimaryColor()
                      : undefined,
                }}
                secondary={`${tracks.length} tracks`}
                secondaryTypographyProps={{
                  fontSize: isMobile ? '10px' : '11px',
                  lineHeight: 1.2,
                  color:
                    selectedArtist === null
                      ? getSelectedSecondaryColor()
                      : theme.palette.text.secondary,
                }}
                sx={{ my: 0 }}
              />
            </ListItemButton>

            {artists.map((artist) => (
              <ListItemButton
                key={artist}
                data-artist={artist}
                onClick={() => handleArtistClick(artist)}
                selected={selectedArtist === artist}
                sx={{
                  py: 0.4,
                  px: 1.5,
                  minHeight: 32,
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.05)',
                  },
                  '&.Mui-selected': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? theme.palette.grey[200]
                        : theme.palette.grey[800],
                    '&:hover': {
                      backgroundColor:
                        theme.palette.mode === 'dark'
                          ? theme.palette.grey[200]
                          : theme.palette.grey[800],
                    },
                  },
                }}
              >
                <ListItemText
                  primary={artist}
                  primaryTypographyProps={{
                    fontSize: isMobile ? '12px' : '13px',
                    fontWeight: selectedArtist === artist ? 600 : 400,
                    noWrap: true,
                    lineHeight: 1.2,
                    color:
                      selectedArtist === artist
                        ? getSelectedPrimaryColor()
                        : undefined,
                  }}
                  secondary={`${artistTrackCounts[artist]} track${
                    artistTrackCounts[artist] !== 1 ? 's' : ''
                  }`}
                  secondaryTypographyProps={{
                    fontSize: isMobile ? '10px' : '11px',
                    lineHeight: 1.2,
                    color:
                      selectedArtist === artist
                        ? getSelectedSecondaryColor()
                        : theme.palette.text.secondary,
                  }}
                  sx={{ my: 0 }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Collapse>

      {/* Collapsed state - show toggle button */}
      {!open && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: '90%',
            transform: 'translateY(-90%)',
            zIndex: 10,
          }}
        >
          <Tooltip placement="right" title="Show artist browser">
            <IconButton
              onClick={onToggle}
              sx={{
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? theme.palette.grey[800]
                    : theme.palette.grey[200],
                // same radius as the sidebar playlist buttons
                borderRadius: '0 4px 4px 0',
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? theme.palette.grey[700]
                      : theme.palette.grey[300],
                },
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
