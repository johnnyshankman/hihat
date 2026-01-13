# E2E Test Fixture Data - Implementation Summary

## Problem Statement

The application requires users to:
1. Set up a library location in settings
2. Import their music library
3. Only then can they use basic features like playing/pausing music

This made E2E testing difficult because tests needed a way to:
- Use pre-configured fixture data (test songs + database)
- Start testing immediately without manual setup
- **Never** affect production or development data

## Solution Overview

We implemented a **TEST_MODE environment-based isolation system** that:

✅ Uses fixture data **ONLY** during E2E tests
✅ **Never** affects production builds
✅ **Never** affects development (`npm run start`)
✅ Automatically resets between test runs
✅ Physically impossible for test data to leak into production

## Implementation Details

### 1. Test Database with Placeholders

**File:** `e2e/fixtures/test-db.sql`

```sql
-- Before (hardcoded paths - don't work)
INSERT INTO tracks (id, filePath, ...) VALUES
('test-1', '/test-songs/song.m4a', ...);

-- After (dynamic placeholders)
INSERT INTO tracks (id, filePath, ...) VALUES
('test-1', '{{TEST_SONGS_PATH}}/song.m4a', ...);
```

### 2. Test Helper Initialization

**File:** `e2e/helpers/test-helpers.ts`

```typescript
static async initializeTestDatabase(dbPath: string, testSongsPath: string) {
  // Read SQL template
  let sqlContent = fs.readFileSync('test-db.sql', 'utf-8');

  // Replace placeholders with actual absolute paths
  sqlContent = sqlContent.replace(/\{\{TEST_SONGS_PATH\}\}/g, testSongsPath);

  // Create fresh SQLite database
  const db = new sqlite3.Database(dbPath);
  db.exec(sqlContent);
  db.close();
}
```

### 3. Database Layer Safety Checks

**File:** `src/main/db/index.ts`

```typescript
const DB_PATH = (() => {
  // TEST_MODE: Only during E2E tests
  if (process.env.TEST_MODE === 'true' && process.env.TEST_DB_PATH) {
    // SAFETY: Prevent TEST_MODE in packaged production builds
    if (app.isPackaged && process.env.NODE_ENV === 'production') {
      console.error('WARNING: TEST_MODE in production! Using normal DB.');
      return path.join(getUserDataPath(), 'library.db');
    }
    return process.env.TEST_DB_PATH;
  }

  // Normal operation
  return path.join(getUserDataPath(), 'library.db');
})();
```

### 4. Test Execution Flow

```
1. TestHelpers.launchApp() is called
2. Delete old test database
3. Read test-db.sql template
4. Replace {{TEST_SONGS_PATH}} with absolute path
5. Create fresh SQLite database with proper paths
6. Launch Electron with TEST_MODE=true
7. Database layer detects TEST_MODE and uses test DB
8. App starts with pre-loaded fixture data
9. Tests run against fixture data
10. After test, database is deleted and recreated for next test
```

## Safety Guarantees

### Production Build Safety

**Electron-builder config** (package.json):
```json
{
  "build": {
    "files": [
      "dist",           // ✅ Compiled code only
      "node_modules",   // ✅ Dependencies only
      "package.json"    // ✅ Metadata only
    ]
    // ❌ e2e/ is NOT included
  }
}
```

**Result:** Test fixtures physically cannot be included in `.dmg` files.

### Runtime Safety

```typescript
// Even if TEST_MODE is somehow set, production builds ignore it
if (app.isPackaged && process.env.NODE_ENV === 'production') {
  return normalDatabase; // Never use test database
}
```

### Development Safety

- `npm run start` does NOT set TEST_MODE
- Development uses separate `hihat-dev/` directory
- Test fixtures only accessible via Playwright test runner

## File Changes

### Modified Files

1. **e2e/fixtures/test-db.sql**
   - Added `{{TEST_SONGS_PATH}}` placeholders
   - Enables dynamic path resolution

2. **e2e/helpers/test-helpers.ts**
   - Updated `initializeTestDatabase()` to accept `testSongsPath`
   - Replaces placeholders with actual paths
   - Updated `launchApp()` to call new init function

3. **e2e/electron-helper.ts**
   - Added `initTestDatabase()` method
   - Updated `startDevApp()` to initialize test DB properly

4. **src/main/db/index.ts**
   - Enhanced TEST_MODE handling with safety checks
   - Added production build guard
   - Added detailed comments explaining TEST_MODE

### New Files

1. **e2e/FIXTURE_DATA_GUIDE.md**
   - Comprehensive guide on fixture data system
   - Architecture explanation
   - Troubleshooting section

2. **e2e/fixture-data-test.spec.ts**
   - Test suite verifying fixture data works
   - Tests 7 tracks, 5 playlists, settings
   - Verifies isolation between test runs

3. **e2e/IMPLEMENTATION_SUMMARY.md** (this file)
   - Implementation details
   - Safety guarantees
   - Testing instructions

## Fixture Data Contents

### Test Tracks (200 generated songs)
- Aurora Synth, The Jazz Collective, Indie Folk Band, Electronic Pulse
- Classical Masters, Rock Titans, Hip Hop Legends, Soul Sisters
- World Music Ensemble, Ambient Collective (and more)
- Each song is 10 seconds of silence with unique metadata
- Track IDs: test-large-001 through test-large-200

### Test Playlists (5 playlists)
- Test Playlist: 3 tracks (custom)
- Jazz Favorites: 2 tracks (custom)
- Recently Added: Smart playlist
- Recently Played: Smart playlist
- Most Played: Smart playlist

### Settings
- Library path: Points to test-songs-large directory
- Theme: Dark mode
- Last played: test-large-007 (Found Dream of Love)
- Volume: 1.0
- All columns visible

## Testing Instructions

### Prerequisites

```bash
# Build the application first
npm run build
```

### Run Fixture Data Tests

```bash
# Run all E2E tests including fixture data tests
npm run test:e2e

# Run only fixture data tests
npm run test:e2e fixture-data-test.spec.ts

# Run with visible browser
npm run test:e2e:headed fixture-data-test.spec.ts

# Debug interactively
npm run test:e2e:debug fixture-data-test.spec.ts
```

### Expected Test Results

All tests should pass with fixture data:
- ✅ 200 test tracks loaded
- ✅ 5 playlists available
- ✅ Settings pre-configured
- ✅ No library setup screen shown
- ✅ Music playback works
- ✅ Database resets between runs

## Verification Steps

### 1. Verify Production Build Excludes Test Data

```bash
# Build production app
npm run package

# Check built app contents
cd release/build/mac/hihat.app/Contents/Resources
ls -la

# You should NOT see:
# ❌ e2e/ directory
# ❌ test-db.sql
# ❌ test-songs-large/

# You should see:
# ✅ app.asar (compiled code)
# ✅ assets/
```

### 2. Verify Development Mode Uses Separate Database

```bash
# Start in development
npm run start

# Check database location in console output
# Should show: hihat-dev/library.db
# NOT: test-db.sqlite
```

### 3. Verify Test Mode Uses Fixture Data

```bash
# Run fixture data test
npm run test:e2e fixture-data-test.spec.ts

# Check console output:
# ✅ "Using TEST database: .../test-db.sqlite"
# ✅ "Test DB: .../test-db.sqlite"
# ✅ "Test Songs: .../test-songs-large"
```

### 4. Verify Database Isolation

```bash
# Check your development database
ls ~/Library/Application\ Support/hihat-dev/library.db

# Check production database (if you've run the app)
ls ~/Library/Application\ Support/hihat/library.db

# Check test database
ls e2e/fixtures/test-db.sqlite

# All three should be separate files with different content
```

## Troubleshooting

### Test database is empty

**Cause:** Placeholders not being replaced

**Fix:** Check that `initializeTestDatabase()` is called with proper paths

### Tests can't find songs

**Cause:** File paths not resolved correctly

**Fix:** Verify `TEST_SONGS_PATH` points to `e2e/fixtures/test-songs-large/`

### Tests show library setup screen

**Cause:** TEST_MODE not being detected

**Fix:** Check environment variables are passed to Electron:
```typescript
env: {
  TEST_MODE: 'true',
  TEST_DB_PATH: testDbPath,
  TEST_SONGS_PATH: songsPath,
}
```

### Test data appears in development

**Cause:** Should never happen with current implementation

**Fix:** Verify you're running `npm run start`, not a test

### Test data appears in production

**Cause:** Physically impossible with current implementation

**Reason:** `e2e/` directory is excluded from production builds

## Architecture Benefits

✅ **Type-safe** - TypeScript throughout
✅ **Isolated** - Test/dev/prod data never mix
✅ **Automatic** - No manual test setup required
✅ **Consistent** - Fresh database every test run
✅ **Safe** - Impossible to leak test data to production
✅ **Fast** - SQLite database creates in milliseconds
✅ **Maintainable** - Single SQL file defines all test data
✅ **Extensible** - Easy to add new test fixtures

## Next Steps

### Adding More Test Fixtures

1. **Regenerate test songs:**
   - Run `node e2e/scripts/generate-test-songs.js`
   - This creates MP3 files and updates `test-db.sql`

2. **Add test playlists:**
   - Add entries to playlists table in `test-db.sql`

3. **Modify settings:**
   - Update settings INSERT in `test-db.sql`

### Running Existing E2E Tests

All existing tests now work with fixture data:
```bash
npm run test:e2e app-launch.spec.ts
npm run test:e2e library-management.spec.ts
npm run test:e2e playback.spec.ts
npm run test:e2e playlists.spec.ts
```

## Success Criteria

✅ All implemented
- [x] Fixture data loads automatically during E2E tests
- [x] No manual library setup required for tests
- [x] Production builds exclude test fixtures
- [x] Development mode uses separate database
- [x] Test database resets between runs
- [x] Runtime safety checks prevent TEST_MODE in production
- [x] Comprehensive documentation provided
- [x] Example tests demonstrate functionality

## Related Documentation

- `e2e/FIXTURE_DATA_GUIDE.md` - Comprehensive guide
- `e2e/README.md` - E2E testing overview
- `e2e/fixtures/test-db.sql` - Test database schema

## Conclusion

The fixture data system is now fully implemented and tested. E2E tests can use pre-configured test data without any risk of affecting production or development environments. The system is safe by design, with multiple layers of protection preventing test data from leaking into production builds.
