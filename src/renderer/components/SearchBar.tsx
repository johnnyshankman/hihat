import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
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
  const debouncedValue = useDebouncedValue(value, 300);

  // Notify parent when the debounced value changes
  useEffect(() => {
    onDebouncedChange(debouncedValue);
  }, [debouncedValue, onDebouncedChange]);

  const handleClear = useCallback(() => {
    setValue('');
    inputRef.current?.focus();
  }, []);

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
        input: {
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton edge="end" onClick={handleClear} size="small">
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
      sx={{
        flexGrow: 1,
        flexShrink: 1,
        minWidth: '100px',
        '& .MuiOutlinedInput-root': { height: '32px' },
      }}
      value={value}
      variant="outlined"
    />
  );
}

export default React.memo(SearchBar);
