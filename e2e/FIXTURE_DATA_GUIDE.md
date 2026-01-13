# E2E Test Fixture Data Guide

## Overview

This guide explains how fixture data is used **exclusively** for E2E testing without affecting production or development environments.

## How It Works

### 1. Fixture Data Location

All test fixtures are stored in `e2e/fixtures/`:

```
e2e/fixtures/
├── test-db.sql          # SQL schema and seed data with placeholders (200 tracks)
├── test-db.sqlite       # Generated SQLite database (created by tests)
├── new-user-db.sql      # SQL schema for brand new user (empty library)
├── new-user-db.sqlite   # Generated new user database (created by tests)
└── test-songs-large/    # Test audio files (200 generated MP3s, 10 sec each)
```

### 2. Environment-Based Isolation

The application uses **environment variables** to determine which database to use:

| Environment | Database Location | Description |
|-------------|-------------------|-------------|
| **Production** | `~/Library/Application Support/hihat/library.db` | Real user data |
| **Development** | `~/Library/Application Support/hihat-dev/library.db` | Development data |
| **E2E Tests** | `e2e/fixtures/test-db.sqlite` | Test fixture data (existing user) |
| **E2E Tests (New User)** | `e2e/fixtures/new-user-db.sqlite` | Test fixture data (brand new user) |

### 3. TEST_MODE Environment Variables

During E2E tests, these environment variables are set:

```typescript
{
  NODE_ENV: 'test',
  TEST_MODE: 'true',
  TEST_DB_PATH: '/absolute/path/to/e2e/fixtures/test-db.sqlite',
  TEST_SONGS_PATH: '/absolute/path/to/e2e/fixtures/test-songs-large'
}
```

**Important:** These variables are ONLY set by Playwright during E2E test execution.

### 4. Database Path Resolution

The database layer (`src/main/db/index.ts`) determines which database to use:

```typescript
const DB_PATH = (() => {
  // TEST_MODE: Only use test database during E2E tests
  if (process.env.TEST_MODE === 'true' && process.env.TEST_DB_PATH) {
    // Safety check: TEST_MODE should never be set in packaged production builds
    if (app.isPackaged && process.env.NODE_ENV === 'production') {
      console.error('WARNING: TEST_MODE is set in production build!');
      return path.join(getUserDataPath(), 'library.db');
    }
    return process.env.TEST_DB_PATH;
  }

  // Normal operation: Use standard library database
  return path.join(getUserDataPath(), 'library.db');
})();
```

### 5. Test Database Initialization

Before each test run, the test helper:

1. **Deletes** the old test database if it exists
2. **Reads** `test-db.sql` or `new-user-db.sql` template (depending on test type)
3. **Replaces** `{{TEST_SONGS_PATH}}` placeholders with actual paths
4. **Creates** a fresh SQLite database with resolved paths

```typescript
// From e2e/helpers/test-helpers.ts

// For tests with existing library data
static async initializeTestDatabase(dbPath: string, testSongsPath: string) {
  let sqlContent = fs.readFileSync('test-db.sql', 'utf-8');
  sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

  const db = new sqlite3.Database(dbPath);
  db.exec(sqlContent);
  db.close();
}

// For brand new user experience tests (empty library)
static async initializeNewUserDatabase(dbPath: string, testSongsPath: string) {
  let sqlContent = fs.readFileSync('new-user-db.sql', 'utf-8');
  sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

  const db = new sqlite3.Database(dbPath);
  db.exec(sqlContent);
  db.close();
}
```

## Safety Guarantees

### ✅ Production Builds Cannot Use Test Data

1. **Electron-builder excludes `e2e/` directory**
   - Only `dist/`, `node_modules/`, and `package.json` are packaged
   - Test fixtures physically cannot be included in `.dmg` files

2. **Production runtime check**
   - If `TEST_MODE` is somehow set in a packaged production build, it's ignored
   - Database falls back to normal user data path

3. **Environment variable scope**
   - `TEST_MODE` is only set by Playwright during test execution
   - It's not stored in any config files or environment

### ✅ Development Mode Cannot Use Test Data

- `npm run start` does NOT set `TEST_MODE=true`
- Development uses its own isolated database at `hihat-dev/library.db`
- Test fixtures are only accessible when explicitly launched by Playwright

### ✅ Test Data Is Always Fresh

- Each test run deletes and recreates the test database
- No state carries over between test runs
- File paths are dynamically resolved based on test environment

## Test Database Schemas

### Standard Test Database (`test-db.sql`)

Used for testing with an existing library. Includes:

**Tracks (200 generated songs):**
- Aurora Synth, The Jazz Collective, Indie Folk Band, Electronic Pulse, etc.
- Each track has unique metadata (title, artist, album, track number)
- 10 different artists, 20 albums (one per artist cycle)
- Files are 10-second silent MP3s for fast testing

**Playlists (5 playlists):**
- Test Playlist (3 tracks)
- Jazz Favorites (2 tracks)
- Recently Added (smart playlist)
- Recently Played (smart playlist)
- Most Played (smart playlist)

**Settings:**
- Library path: Points to test-songs-large directory
- Theme: Dark mode
- Last played: test-large-007 (Found Dream of Love)
- Volume: 1.0

### New User Database (`new-user-db.sql`)

Used for testing the brand new user experience. Includes:

**Tracks:** EMPTY - No songs loaded

**Playlists (3 smart playlists only):**
- Recently Added (smart playlist)
- Recently Played (smart playlist)
- Most Played (smart playlist)

**Settings:**
- Library path: Points to test-songs-large directory (but no songs scanned)
- Theme: Dark mode
- Last played: NULL (never played anything)
- Volume: 1.0

This simulates the first-launch experience where a user has installed the app but hasn't imported any music yet.

## Adding New Test Fixtures

### Regenerating Test Songs

To regenerate the 200 test songs:
```bash
node e2e/scripts/generate-test-songs.js
```

This creates MP3 files and updates `test-db.sql` with matching entries.

### Modifying Test Data

Edit `e2e/fixtures/test-db.sql` and use `{{TEST_SONGS_PATH}}` for file paths:

```sql
-- ✅ Correct: Use placeholder
INSERT INTO tracks (id, filePath, ...) VALUES
('test-1', '{{TEST_SONGS_PATH}}/song.m4a', ...);

-- ❌ Wrong: Hardcoded path won't work
INSERT INTO tracks (id, filePath, ...) VALUES
('test-1', '/Users/me/test-songs/song.m4a', ...);
```

### Testing Different User States

We maintain multiple database fixtures to test different user scenarios:

**`test-db.sql`** - For testing existing users with library data
- Use `TestHelpers.launchApp()` in tests
- Simulates a user with songs, playlists, and play history

**`new-user-db.sql`** - For testing brand new users with empty library
- Use `TestHelpers.launchAppAsBrandNewUser()` in tests
- Simulates first-launch experience with no music
- Tests empty state UI and messaging

To add a new user state:
1. Create a new SQL fixture (e.g., `premium-user-db.sql`)
2. Add an initialization method in `test-helpers.ts`
3. Add a launch method that uses the new fixture

## Troubleshooting

### Test database is empty
- Check that `test-db.sql` uses `{{TEST_SONGS_PATH}}` placeholders
- Verify test songs exist in `e2e/fixtures/test-songs-large/`

### Test files not found
- Ensure `TEST_SONGS_PATH` is passed to `initializeTestDatabase()`
- Check that paths are resolved correctly in test output

### Test data appearing in development
- **This should never happen** - verify `TEST_MODE` is not set
- Check that you're running `npm run start`, not a Playwright test

### Test data appearing in production
- **This is impossible** - `e2e/` is excluded from builds
- Production builds cannot access test fixtures

## Running Tests

```bash
# Build the app first (required for E2E tests)
npm run build

# Run E2E tests (automatically uses fixture data)
npm run test:e2e

# Run tests with visible browser
npm run test:e2e:headed

# Debug tests interactively
npm run test:e2e:debug
```

## Architecture Benefits

✅ **Complete isolation** - Test, dev, and prod data never mix
✅ **No manual setup** - Tests automatically initialize fixtures
✅ **Always consistent** - Fresh database for each test run
✅ **Safe by design** - Impossible to leak test data to production
✅ **Easy to extend** - Add new fixtures by editing SQL file

## Related Files

- `e2e/fixtures/test-db.sql` - Test database schema with existing user data
- `e2e/fixtures/new-user-db.sql` - Test database schema for brand new user (empty library)
- `e2e/helpers/test-helpers.ts` - Test database initialization and app launch helpers
- `e2e/new-user.spec.ts` - E2E tests for brand new user experience
- `src/main/db/index.ts` - Database path resolution with TEST_MODE handling
- `package.json` - Electron-builder config excludes `e2e/` from builds
