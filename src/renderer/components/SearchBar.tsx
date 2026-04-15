import React, { useState, useEffect, useRef } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useDebouncedValue } from '../utils/hooks';

interface SearchBarProps {
  initialValue: string;
  onDebouncedChange: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
}

/**
 * Self-contained search input that debounces internally.
 * The parent only receives debounced values, so it never re-renders
 * during fast typing — only this component re-renders per keystroke.
 */
function SearchBar({
  initialValue,
  onDebouncedChange,
  onClose,
  placeholder = 'Filter tracks',
}: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedValue = useDebouncedValue(value, 150);

  // Sync internal value when initialValue changes (e.g. playlist switch)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Notify parent when the debounced value changes
  useEffect(() => {
    onDebouncedChange(debouncedValue);
  }, [debouncedValue, onDebouncedChange]);

  const handleClear = () => {
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <TextField
      autoFocus
      inputRef={inputRef}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      placeholder={placeholder}
      size="small"
      slotProps={{
        htmlInput: { 'data-testid': 'search-input' },
        input: {
          startAdornment: (
            <InputAdornment position="start" sx={{ mr: 0.5 }}>
              <SearchIcon
                sx={{
                  fontSize: 16,
                  color: 'text.secondary',
                  opacity: 0.6,
                }}
              />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                onClick={handleClear}
                size="small"
                sx={{
                  padding: '2px',
                  color: 'text.secondary',
                  opacity: 0.6,
                  transition: 'opacity 150ms ease',
                  '&:hover': { opacity: 1, backgroundColor: 'transparent' },
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
      sx={{
        flexGrow: 1,
        flexShrink: 1,
        minWidth: '100px',
        '& .MuiOutlinedInput-root': {
          height: '28px',
          fontSize: '13px',
          borderRadius: '8px',
          backgroundColor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(0, 0, 0, 0.04)',
          transition:
            'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
          '& fieldset': {
            borderColor: (t) =>
              t.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.12)',
            transition: 'border-color 150ms ease',
          },
          '&:hover': {
            backgroundColor: (t) =>
              t.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.06)',
            '& fieldset': {
              borderColor: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
            },
          },
          '&.Mui-focused': {
            backgroundColor: (t) =>
              t.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.05)',
            '& fieldset': {
              borderWidth: '1px',
              borderColor: (t) =>
                t.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.3)'
                  : 'rgba(0, 0, 0, 0.3)',
            },
          },
        },
        '& .MuiOutlinedInput-input': {
          padding: '4px 0',
          '&::placeholder': {
            color: 'text.secondary',
            opacity: 0.5,
          },
        },
      }}
      value={value}
      variant="outlined"
    />
  );
}

// Memo skips parent re-renders from Library/Playlists that aren't tied to
// the search value (track selection, sort, currentTrack ticks). Props are
// stable: primitive initialValue, literal placeholder, parent-useCallback'd
// onClose/onDebouncedChange — the latter is also load-bearing for correctness
// since SearchBar's debounce-flush effect depends on a stable reference.
export default React.memo(SearchBar);
