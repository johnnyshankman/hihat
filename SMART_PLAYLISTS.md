# Smart Playlists System

## Overview

HiHat includes a built-in smart playlist system that automatically generates playlists based on rules. This document explains how the system works and how to safely rename smart playlists.

## Architecture

The smart playlist system uses **stable identifiers** (`smartPlaylistId`) to track built-in smart playlists. This allows you to change their display names without creating duplicates or breaking the self-healing mechanism.

### Key Components

1. **`src/types/smartPlaylists.ts`** - Contains the canonical definitions of all smart playlists
2. **`src/types/dbTypes.ts`** - Defines the `Playlist` interface with `smartPlaylistId` field
3. **`src/main/db/index.ts`** - Database layer with self-healing mechanism

## How It Works

### Stable IDs

Each built-in smart playlist has a permanent `smartPlaylistId`:

- `recently-added` → "Recently Added"
- `recently-played` → "Recently Played"
- `most-played` → "Most Played"

**Never change these stable IDs!** They are used to identify playlists across app versions and database migrations.

### Self-Healing Mechanism

On every app launch, the `initDefaultPlaylists()` function:

1. Checks if each smart playlist exists by `smartPlaylistId`
2. If missing → Creates it with the current display name
3. If exists but name differs → Updates to the new display name
4. Prevents creation of duplicates

### Database Migration

The system includes an automatic migration (`migrateExistingSmartPlaylists()`) that runs on app launch to handle existing databases:

1. **Adds `smartPlaylistId` column** to the playlists table if it doesn't exist
2. **Deletes old smart playlists** that don't have a `smartPlaylistId` (orphaned from the old system)
3. **Recreates smart playlists** via `initDefaultPlaylists()` with proper stable IDs

This ensures a clean migration with no duplicates. Old smart playlists are removed and recreated with stable IDs.

## How to Rename a Smart Playlist

To rename a smart playlist, simply update the `name` field in `src/types/smartPlaylists.ts`:

```typescript
export const SMART_PLAYLISTS: SmartPlaylistDefinition[] = [
  {
    smartPlaylistId: 'recently-added', // ← NEVER CHANGE THIS
    name: 'New Cool Name Here',        // ← CHANGE THIS FREELY
    ruleSet: {
      type: 'recentlyAdded',
      limit: 50,
    },
  },
  // ... more playlists
];
```

### What Happens When You Deploy the Change

1. User launches the app with your new version
2. Database migrations run:
   - Adds `smartPlaylistId` column if needed
   - Removes old smart playlists without stable IDs (from pre-refactor versions)
3. `initDefaultPlaylists()` detects missing/changed playlists:
   - Creates missing smart playlists
   - Updates names of existing smart playlists if they've changed
4. User sees exactly 3 smart playlists with the new names - no duplicates!

### Playlist Ordering

Smart playlists always appear **first** in the playlist list, in the order defined in `SMART_PLAYLISTS` array:
1. Recently Added (or your renamed version)
2. Recently Played (or your renamed version)
3. Most Played (or your renamed version)
4. [User's custom playlists follow...]

This ordering is enforced in `getAllPlaylists()` and cannot be changed by users.

## How to Add a New Smart Playlist

1. **Add a new playlist rule type** (if needed) in `src/types/dbTypes.ts`:
   ```typescript
   export interface PlaylistRule {
     type: 'recentlyPlayed' | 'mostPlayed' | 'recentlyAdded' | 'yourNewType';
     limit: number;
   }
   ```

2. **Implement the query** in `src/main/db/index.ts` in `getSmartPlaylistTracks()`:
   ```typescript
   case 'yourNewType':
     query = `SELECT * FROM tracks WHERE ... LIMIT ?`;
     break;
   ```

3. **Add to SMART_PLAYLISTS** in `src/types/smartPlaylists.ts`:
   ```typescript
   {
     smartPlaylistId: 'your-new-playlist-id', // Use kebab-case
     name: 'Your New Playlist Name',
     ruleSet: {
       type: 'yourNewType',
       limit: 50,
     },
   }
   ```

4. **Update test fixtures** (optional) in `e2e/fixtures/test-db.sql`

That's it! The self-healing mechanism will create the new playlist for all users automatically.

## Technical Details

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,              -- UUID for this specific playlist instance
  name TEXT NOT NULL,               -- Display name (can be changed)
  isSmart INTEGER NOT NULL,         -- 1 for smart playlists
  smartPlaylistId TEXT,             -- Stable identifier (e.g., 'recently-added')
  ruleSet TEXT,                     -- JSON rule definition
  trackIds TEXT                     -- Empty array for smart playlists
);
```

### Protection Against Deletion

Built-in smart playlists cannot be deleted. The `deletePlaylist()` function checks for `smartPlaylistId` and prevents deletion if present.

User-created playlists (those without a `smartPlaylistId`) can be deleted normally.

## Testing

To test smart playlist changes:

1. **Run the app in development**:
   ```bash
   npm run start
   ```

2. **Verify existing playlists** are preserved and names are updated

3. **Run E2E tests**:
   ```bash
   npm run test:e2e
   ```

4. **Test migration** by:
   - Making a copy of your test database
   - Manually removing the `smartPlaylistId` column
   - Running the app to see migration in action

## Benefits

✅ **Rename playlists** without fear of duplicates
✅ **Self-healing** - Missing playlists are automatically restored
✅ **Clean migrations** - Old playlists get updated, not duplicated
✅ **Future-proof** - Easy to add new smart playlists
✅ **Type-safe** - Full TypeScript support throughout