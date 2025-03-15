/**
 * Playback IPC Handlers
 *
 * This module provides IPC handlers for playback-related operations.
 */

import * as playback from '../playback';

/**
 * Playback-related IPC handlers
 */
const playbackHandlers = {
  'playback:play': async ({ trackId }: { trackId: string }) => {
    try {
      const success = playback.playTrack(trackId);
      return success;
    } catch (error) {
      console.error('Error in playback:play handler:', error);
      return false;
    }
  },

  'playback:pause': async () => {
    try {
      const success = playback.pausePlayback();
      return success;
    } catch (error) {
      console.error('Error in playback:pause handler:', error);
      return false;
    }
  },

  'playback:resume': async () => {
    try {
      const success = playback.resumePlayback();
      return success;
    } catch (error) {
      console.error('Error in playback:resume handler:', error);
      return false;
    }
  },

  'playback:stop': async () => {
    try {
      const success = playback.stopPlayback();
      return success;
    } catch (error) {
      console.error('Error in playback:stop handler:', error);
      return false;
    }
  },

  'playback:next': async () => {
    try {
      const success = playback.playNextTrack();
      return success;
    } catch (error) {
      console.error('Error in playback:next handler:', error);
      return false;
    }
  },

  'playback:previous': async () => {
    try {
      const success = playback.playPreviousTrack();
      return success;
    } catch (error) {
      console.error('Error in playback:previous handler:', error);
      return false;
    }
  },

  'playback:seek': async ({ position }: { position: number }) => {
    try {
      const success = playback.seekToPosition(position);
      return success;
    } catch (error) {
      console.error('Error in playback:seek handler:', error);
      return false;
    }
  },

  'playback:setVolume': async ({ volume }: { volume: number }) => {
    try {
      const success = playback.setVolume(volume);
      return success;
    } catch (error) {
      console.error('Error in playback:setVolume handler:', error);
      return false;
    }
  },

  'playback:getStatus': async () => {
    try {
      return playback.getPlaybackStatus();
    } catch (error) {
      console.error('Error in playback:getStatus handler:', error);
      return {
        isPlaying: false,
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 0.75,
        queue: [],
        queueIndex: -1,
      };
    }
  },

  'playback:setQueue': async ({
    trackIds,
    startIndex = 0,
  }: {
    trackIds: string[];
    startIndex?: number;
  }) => {
    try {
      playback.setQueue(trackIds, startIndex);
      return true;
    } catch (error) {
      console.error('Error in playback:setQueue handler:', error);
      return false;
    }
  },
};

export default playbackHandlers;
