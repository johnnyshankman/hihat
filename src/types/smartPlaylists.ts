/**
 * Smart Playlist Constants
 *
 * This file defines the stable identifiers and display names for built-in smart playlists.
 * Changing the display names here will automatically update them throughout the app
 * without creating duplicate playlists.
 */

import { PlaylistRule } from './dbTypes';

export interface SmartPlaylistDefinition {
  smartPlaylistId: string; // Stable identifier - never change this
  name: string; // Display name - can be changed at any time
  ruleSet: PlaylistRule;
}

/**
 * Built-in smart playlists
 *
 * To rename a smart playlist:
 * 1. Simply update the 'name' field
 * 2. DO NOT change the 'smartPlaylistId' field
 *
 * The system will automatically update the playlist name in the database
 * for all users on their next app launch.
 */
export const SMART_PLAYLISTS: SmartPlaylistDefinition[] = [
  {
    smartPlaylistId: 'recently-added',
    name: 'Recently Added',
    ruleSet: {
      type: 'recentlyAdded',
      limit: 50,
    },
  },
  {
    smartPlaylistId: 'recently-played',
    name: 'Recently Played',
    ruleSet: {
      type: 'recentlyPlayed',
      limit: 50,
    },
  },
  {
    smartPlaylistId: 'most-played',
    name: 'Most Played',
    ruleSet: {
      type: 'mostPlayed',
      limit: 50,
    },
  },
];
