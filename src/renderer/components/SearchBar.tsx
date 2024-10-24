import React from 'react';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import { StoreStructure } from '../../common/common';
import useMainStore from '../store/main';
import usePlayerStore from '../store/player';
import {
  Search,
  SearchIconWrapper,
  StyledInputBase,
} from './SimpleStyledMaterialUIComponents';

type SearchBarProps = {
  // eslint-disable-next-line react/require-default-props
  className?: string;
};

export default function SearchBar({ className }: SearchBarProps) {
  const storeLibrary = useMainStore((store) => store.library);
  const setFilteredLibrary = usePlayerStore(
    (store) => store.setFilteredLibrary,
  );

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    if (!storeLibrary) return;
    const filtered = Object.keys(storeLibrary).filter((song) => {
      const meta = storeLibrary[song];
      return (
        meta.common.title?.toLowerCase().includes(query.toLowerCase()) ||
        meta.common.artist?.toLowerCase().includes(query.toLowerCase()) ||
        meta.common.album?.toLowerCase().includes(query.toLowerCase())
      );
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
  };

  return (
    <Box className={className}>
      <Search
        sx={{
          borderRadius: '0.375rem',
        }}
      >
        <StyledInputBase
          inputProps={{ 'aria-label': 'search' }}
          onChange={handleSearch}
          placeholder="Search"
        />
        <SearchIconWrapper className="text-[16px]">
          <SearchIcon fontSize="inherit" />
        </SearchIconWrapper>
      </Search>
    </Box>
  );
}
