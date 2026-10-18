import { useEffect, useState } from 'react';
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
 * Map MediaDeviceInfo to rows. OS 'default' collapses to '' (System Default),
 * which is always present. Unlabeled devices get a generic name.
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

export default function AudioOutputPopover({
  anchorEl,
  onClose,
  open,
}: AudioOutputPopoverProps) {
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  // Disable the list mid-switch so rapid clicks can't race.
  const [switching, setSwitching] = useState(false);

  const setSinkId = useSettingsAndPlaybackStore((state) => state.setSinkId);
  const canSetSinkId = useSettingsAndPlaybackStore(
    (state) => state.player?.canSetSinkId ?? false,
  );
  const showNotification = useUIStore((state) => state.showNotification);
  const persistedDeviceId =
    useSettings().data?.selectedAudioOutputDeviceId ?? '';
  // Saved device missing = playing via System Default.
  const currentDeviceId = devices.some((d) => d.deviceId === persistedDeviceId)
    ? persistedDeviceId
    : '';

  // Enumerate while open; refresh on devicechange.
  useEffect(() => {
    if (!open) return undefined;
    const refreshDevices = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((infos) => setDevices(buildDeviceList(infos)))
        .catch((error: unknown) => {
          console.error('Failed to enumerate audio output devices:', error);
        });
    };
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () =>
      navigator.mediaDevices.removeEventListener(
        'devicechange',
        refreshDevices,
      );
  }, [open]);

  const handleSelect = async (device: OutputDevice) => {
    setSwitching(true);
    try {
      await setSinkId(device.deviceId);
      showNotification(`Output set to ${device.label}`, 'success');
      onClose();
    } catch (error) {
      console.error('Failed to switch audio output device:', error);
      showNotification('Could not switch audio output device', 'error');
    } finally {
      setSwitching(false);
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
                  disabled={switching}
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
