import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';
import ReplayCircleFilledIcon from '@mui/icons-material/ReplayCircleFilled';

export default function PlaylistDrawer({
  open,
  onToggle,
  onClose,
  onKeyDown,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  return (
    <div>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box
          sx={{ width: 250 }}
          role="presentation"
          onClick={onToggle}
          onKeyDown={onKeyDown}
        >
          <ListItem key="Recently Played" disablePadding>
            <ListItemButton>
              <ListItemText primary="Playlists" />
            </ListItemButton>
          </ListItem>
          <Divider />
          <List>
            <ListItem key="Recently Played" disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <ReplayCircleFilledIcon />
                </ListItemIcon>
                <ListItemText primary="Recently Played" />
              </ListItemButton>
            </ListItem>
            <ListItem key="Most Played" disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <ReplayCircleFilledIcon />
                </ListItemIcon>
                <ListItemText primary="Most Played" />
              </ListItemButton>
            </ListItem>
            <ListItem key="Recently Added" disablePadding>
              <ListItemButton>
                <ListItemIcon>
                  <ReplayCircleFilledIcon />
                </ListItemIcon>
                <ListItemText primary="Recently Added" />
              </ListItemButton>
            </ListItem>
          </List>
          {/* <Divider />
          <List>
            {['All mail', 'Trash', 'Spam'].map((text, index) => (
              <ListItem key={text} disablePadding>
                <ListItemButton>
                  <ListItemIcon>
                    {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List> */}
        </Box>
      </Drawer>
    </div>
  );
}
