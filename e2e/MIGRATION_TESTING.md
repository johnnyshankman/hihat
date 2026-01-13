# Migration Testing Guide

This guide explains how to test the hihat v1 to v2 migration system using E2E tests.

## Overview

The migration system converts legacy hihat v1 `userConfig.json` files into the new hihat2 SQLite database structure. This test system allows you to verify that migration works correctly without affecting real user data.

## Architecture

### Migration Flow

1. **Normal Operation** (Production):
   - App looks for `~/Library/Application Support/hihat/userConfig.json`
   - If found and not migrated, converts data to SQLite
   - Marks file as migrated by renaming to `userConfig.json.migrated`

2. **Test Mode** (E2E Tests):
   - App looks for `TEST_LEGACY_CONFIG_PATH` environment variable
   - Uses test fixture at `e2e/fixtures/test-userConfig.json`
   - Migration completes and marks test file as migrated
   - Tests can "unmark" migration to re-test if needed

### Key Components

#### 1. Migration Module (`src/main/migration/v1ToV2.ts`)

**Modified Functions:**
- `getLegacyConfigPath()` - Now checks for `TEST_LEGACY_CONFIG_PATH` in TEST_MODE
- `unmarkMigration()` - New export for tests to reset migration state

**How It Works:**
```typescript
function getLegacyConfigPath(): string {
  // In TEST_MODE, use controlled test fixture path
  if (process.env.TEST_MODE === 'true' && process.env.TEST_LEGACY_CONFIG_PATH) {
    return process.env.TEST_LEGACY_CONFIG_PATH;
  }
  // Normal production path
  return path.join(app.getPath('userData'), 'userConfig.json');
}
```

#### 2. Test Fixture (`e2e/fixtures/userConfig.json`)

Contains sample hihat v1 data with:
- 7 test songs with metadata (artist, album, title, duration)
- Play count and last played timestamps
- 3 user playlists (Jazz Classics, Electronic, Most Played)
- Last played song reference
- Library path

**Template Placeholder:**
Uses `{{TEST_SONGS_PATH}}` which gets replaced with actual test song paths during test setup.

#### 3. Test Helpers (`e2e/helpers/test-helpers.ts`)

**New Methods:**

```typescript
// Prepare userConfig.json with actual test paths
static prepareMigrationFixture(fixtureConfigPath: string, testSongsPath: string): void

// Clean up migration files
static cleanupMigrationFiles(configPath: string): void

// Unmark migration to allow re-testing
static unmarkMigration(configPath: string): void

// Launch app with migration enabled
static async launchAppWithMigration(): Promise<{ app, page }>

// Check if migration marker exists
static isMigrationMarked(configPath: string): boolean
```

#### 4. Test Suite (`e2e/migration.spec.ts`)

Comprehensive tests verifying:
- ✅ All tracks migrated correctly
- ✅ Metadata preserved (artist, album, duration)
- ✅ Play counts preserved
- ✅ Playlists imported with correct track associations
- ✅ Migration marker created
- ✅ Idempotency (no duplicates on re-migration)
- ✅ Skip when already migrated

## Running Migration Tests

### Prerequisites

1. Build the application:
   ```bash
   npm run build
   ```

2. Ensure test songs exist in `e2e/fixtures/test-songs-large/`

### Run Tests

```bash
# Run all migration tests
npm run test:e2e -- migration.spec.ts

# Run specific test
npm run test:e2e -- migration.spec.ts -g "should successfully migrate"

# Run with visible browser
npm run test:e2e:headed -- migration.spec.ts

# Debug mode
npm run test:e2e:debug -- migration.spec.ts
```

## Test Data

### Fixture Songs (7 tracks in userConfig.json)

| Artist | Album | Title | Play Count |
|--------|-------|-------|------------|
| Aurora Synth | Digital Dreams | Dream of Love | 333 |
| The Jazz Collective | Blue Notes | A Dream of Love | 8 |
| Indie Folk Band | Autumn Leaves | My Dream of Love | 25 |
| Electronic Pulse | Bass Drop | Your Dream of Love | 18 |
| Classical Masters | Symphony No. 1 | Our Dream of Love | 32 |
| Rock Titans | Thunder Road | Lost Dream | 5 |
| Hip Hop Legends | Street Poetry | Found Dream of Love | 42 |

### Fixture Playlists

The userConfig.json fixture has an empty playlists array for migration testing.
Migration tests primarily verify track import and metadata preservation.

## How Tests Work

### 1. Basic Migration Test

```typescript
test('should successfully migrate v1 userConfig.json to v2 database', async () => {
  const { app, page } = await TestHelpers.launchAppWithMigration();

  // Wait for migration to complete
  await TestHelpers.waitForLibraryLoad(page);

  // Verify tracks imported
  const trackCount = await page.locator('[data-testid="library-table"] tbody tr').count();
  expect(trackCount).toBe(7);

  // Verify migration marker created
  const isMarked = TestHelpers.isMigrationMarked(legacyConfigPath);
  expect(isMarked).toBe(true);
});
```

**What Happens:**
1. Test creates empty database at `e2e/fixtures/migration-test-db.sqlite`
2. Prepares `test-userConfig.json` with actual test paths
3. Launches app with `TEST_LEGACY_CONFIG_PATH` set
4. App detects userConfig.json and runs migration
5. Tracks and playlists imported into SQLite
6. userConfig.json renamed to userConfig.json.migrated
7. Test verifies data integrity

### 2. Re-migration Test (Idempotency)

```typescript
test('should handle re-migration gracefully', async () => {
  // First migration
  const { app: app1, page: page1 } = await TestHelpers.launchAppWithMigration();
  const firstCount = await page1.locator('tbody tr').count();
  await TestHelpers.closeApp(app1);

  // Unmark and migrate again
  TestHelpers.unmarkMigration(legacyConfigPath);
  const { app: app2, page: page2 } = await TestHelpers.launchAppWithMigration();
  const secondCount = await page2.locator('tbody tr').count();

  // Should have same count (no duplicates)
  expect(secondCount).toBe(firstCount);
});
```

**Purpose:** Ensures migration doesn't create duplicate tracks if run multiple times.

### 3. Skip When Marked Test

```typescript
test('should skip migration if already marked', async () => {
  // Pre-mark the migration
  fs.renameSync(legacyConfigPath, `${legacyConfigPath}.migrated`);

  // Launch app - should skip migration
  const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

  // Should see empty library (migration was skipped)
  const trackCount = await page.locator('tbody tr').count();
  expect(trackCount).toBe(0);
});
```

**Purpose:** Verifies migration only runs once per userConfig.json file.

## Environment Variables

Migration tests use these environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `TEST_MODE` | Enable test mode | `'true'` |
| `TEST_DB_PATH` | Path to test database | `e2e/fixtures/migration-test-db.sqlite` |
| `TEST_SONGS_PATH` | Path to test songs | `e2e/fixtures/test-songs-large` |
| `TEST_LEGACY_CONFIG_PATH` | Path to userConfig.json | `e2e/fixtures/test-userConfig.json` |

## Troubleshooting

### Migration Not Running

**Problem:** Test launches but no tracks appear.

**Solutions:**
1. Verify `TEST_LEGACY_CONFIG_PATH` is set correctly
2. Check that `test-userConfig.json` exists
3. Ensure `test-userConfig.json` is not already marked as `.migrated`
4. Increase wait time in test (migration may take longer)

### Duplicate Tracks After Re-migration

**Problem:** Second migration creates duplicate tracks.

**Solutions:**
1. Check that database uses `INSERT OR IGNORE` for tracks
2. Verify track IDs are generated consistently
3. Ensure `unmarkMigration()` is called correctly

### Playlists Not Importing

**Problem:** Tracks import but playlists are missing.

**Solutions:**
1. Verify playlist track paths match imported track file paths
2. Check `filePathToTrackIdMap` is populated correctly
3. Ensure playlists are in the fixture userConfig.json

### Migration Marker Not Created

**Problem:** Migration runs but `.migrated` file not created.

**Solutions:**
1. Check file permissions in test fixtures directory
2. Verify `markAsMigrated()` is being called
3. Check for errors in console logs

## Best Practices

### 1. Clean State Between Tests

Always clean up migration files to ensure fresh state:

```typescript
afterEach(() => {
  const legacyConfigPath = path.join(__dirname, 'fixtures/test-userConfig.json');
  TestHelpers.cleanupMigrationFiles(legacyConfigPath);
});
```

### 2. Use Realistic Test Data

Fixture data should mirror real v1 userConfig.json structure:
- Include various artists and albums
- Use realistic play counts and timestamps
- Test edge cases (special characters, long titles, etc.)

### 3. Verify Data Integrity

Don't just check counts - verify actual data:

```typescript
// ❌ Not enough
expect(trackCount).toBe(7);

// ✅ Better
expect(trackCount).toBe(7);
const hipHopRow = await page.locator('text="Found Dream of Love"');
expect(await hipHopRow.isVisible()).toBe(true);
```

### 4. Test Migration Timing

Give migration adequate time to complete:

```typescript
// After launching with migration
await page.waitForTimeout(5000); // Migration takes time
await TestHelpers.waitForLibraryLoad(page);
```

## Extending Tests

### Adding New Test Cases

1. **Test New v1 Data Types:**
   - Add data to `userConfig.json` fixture
   - Update migration converter if needed
   - Add test to verify import

2. **Test Edge Cases:**
   - Missing metadata fields
   - Corrupted JSON
   - Very large libraries (1000+ tracks)
   - Special characters in filenames

3. **Test Performance:**
   - Measure migration time for large datasets
   - Verify memory usage stays reasonable

### Example: Testing Missing Metadata

```typescript
test('should handle tracks with missing metadata', async () => {
  // Create custom fixture with missing fields
  const customFixture = {
    library: {
      '/path/to/song.m4a': {
        common: { artist: undefined, album: undefined, title: undefined },
        format: { duration: 180 },
        additionalInfo: { playCount: 0, lastPlayed: 0, dateAdded: Date.now() }
      }
    },
    playlists: [],
    lastPlayedSong: '',
    libraryPath: '/test/path',
    initialized: true
  };

  // ... test with custom fixture
});
```

## Maintenance

### Keeping Fixtures Up-to-Date

When v1 structure changes:
1. Update `src/types/legacyTypes.ts`
2. Update `e2e/fixtures/userConfig.json`
3. Update migration converter in `v1ToV2.ts`
4. Update tests to verify new fields

### Adding New Test Songs

1. Regenerate test songs using `node e2e/scripts/generate-test-songs.js`
2. Update `userConfig.json` fixture if migration test data changes
3. Update expected counts in tests
4. Commit test files to repository

## CI/CD Integration

Migration tests run automatically in GitHub Actions:

```yaml
# .github/workflows/prcheck.yml
- name: Run E2E Tests
  run: npm run test:e2e
```

**Important:** CI uses the same environment variables as local testing.

## Security Considerations

- Test fixtures contain only sample data (no real user information)
- Test databases are gitignored (`.sqlite` files)
- Migration marker files are gitignored (`test-userConfig.json.migrated`)
- Never commit actual user `userConfig.json` files

## Related Documentation

- [`SMART_PLAYLISTS.md`](../SMART_PLAYLISTS.md) - Smart playlist system
- [`e2e/README.md`](README.md) - General E2E testing guide
- [`src/main/migration/v1ToV2.ts`](../src/main/migration/v1ToV2.ts) - Migration implementation
