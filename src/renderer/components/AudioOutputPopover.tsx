import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useSettingsAndPlaybackStore, useUIStore } from '../stores';
import { useSettings } from '../queries';

interface OutputDevice {
  deviceId: string;
  label: string;
}

/**
 * Normalize the raw MediaDeviceInfo list into the rows we render.
 *
 * The OS-reported `'default'` (and the rare empty-string) output device is
 * collapsed onto our `''` sentinel so the "System Default" row always maps
 * to the value we persist (`selectedAudioOutputDeviceId === null/''`).
 * Real devices keep their `deviceId`; empty labels (Chromium hides them
 * until media permission is granted) degrade to a generic name rather than
 * us prompting for microphone access. A System Default row is guaranteed
 * even when the platform reports no `'default'` device.
 */
function buildDeviceList(infos: MediaDeviceInfo[]): OutputDevice[] {
  const seen = new Set<string>();
  const devices: OutputDevice[] = [];

  infos
    .filter((info) => info.kind === 'audiooutput')
    .forEach((info) => {
      const isSystemDefault =
        info.deviceId === 'default' || info.deviceId === '';
      const deviceId = isSystemDefault ? '' : info.deviceId;
      if (seen.has(deviceId)) return;
      seen.add(deviceId);
      devices.push({
        deviceId,
        label: isSystemDefault
          ? 'System Default'
          : info.label || 'Output device',
      });
    });

  if (!seen.has('')) {
    devices.unshift({ deviceId: '', label: 'System Default' });
  }

  return devices;
}

interface AudioOutputPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  open: boolean;
}

/**
 * Popover launched from the Player's Speaker button. Lists the available
 * audio output devices, marks the active one, and routes playback to a
 * new device on click via the store's `setSinkId` action (which persists
 * the choice). Anchored above the player bar, mirroring the MiniPlayer
 * volume popover.
 */
export default function AudioOutputPopover({
  anchorEl,
  onClose,
  open,
}: AudioOutputPopoverProps) {
  const [devices, setDevices] = useState<OutputDevice[]>([]);

  const setSinkId = useSettingsAndPlaybackStore((state) => state.setSinkId);
  const canSetSinkId = useSettingsAndPlaybackStore(
    (state) => state.player?.canSetSinkId ?? true,
  );
  const showNotification = useUIStore((state) => state.showNotification);
  const currentDeviceId = useSettings().data?.selectedAudioOutputDeviceId ?? '';

  const refreshDevices = useCallback(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((infos) => setDevices(buildDeviceList(infos)))
      .catch((error: unknown) => {
        console.error('Failed to enumerate audio output devices:', error);
      });
  }, []);

  // Enumerate on mount and whenever the OS device set changes (a headset
  // is plugged in, a monitor's speakers appear, etc.).
  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () =>
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        refreshDevices,
      );
  }, [refreshDevices]);

  // Refresh each time the popover opens so it reflects current hardware
  // without waiting for a devicechange event.
  useEffect(() => {
    if (open) refreshDevices();
  }, [open, refreshDevices]);

  const handleSelect = async (device: OutputDevice) => {
    try {
      await setSinkId(device.deviceId);
      showNotification(`Output set to ${device.label}`, 'success');
      onClose();
    } catch {
      showNotification('Could not switch audio output device', 'error');
    }
  };

  return (
    <Popover
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      onClose={onClose}
      open={open}
      transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Box sx={{ minWidth: 240, maxWidth: 360, pb: 1 }}>
        <Typography
          sx={{
            px: 1,
            py: 1,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: (t) => t.palette.text.secondary,
            opacity: 0.7,
            userSelect: 'none',
          }}
        >
          Audio Output
        </Typography>
        {!canSetSinkId ? (
          <Typography sx={{ px: 2, py: 1 }} variant="body2">
            Output device selection isn&apos;t supported here.
          </Typography>
        ) : (
          <List data-testid="output-device-list" dense disablePadding>
            {devices.map((device) => {
              const selected = device.deviceId === currentDeviceId;
              return (
                <ListItemButton
                  key={device.deviceId || 'default'}
                  data-selected={selected ? 'true' : 'false'}
                  data-testid={`output-device-option-${device.deviceId || 'default'}`}
                  onClick={() => handleSelect(device)}
                  selected={selected}
                  sx={{
                    py: 0,
                    px: 0.5,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 26 }}>
                    {selected ? <CheckIcon fontSize="small" /> : null}
                  </ListItemIcon>
                  <ListItemText primary={device.label} />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Popover>
  );
}
