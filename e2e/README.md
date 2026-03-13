# E2E Testing Suite

This directory contains the end-to-end testing suite for the Hihat music player application, built with Playwright for Electron.

## Structure

```
e2e/
├── fixtures/                    # Test data and resources
│   ├── test-songs-large/        # 205 generated audio files for testing
│   ├── test-db.sql              # Database initialization script (205 tracks)
│   ├── new-user-db.sql          # Empty library database script
│   ├── migration-db.sql         # v1 to v2 migration database script
│   └── userConfig.json          # Legacy config fixture for migration tests
├── helpers/                     # Test utilities and helpers
│   ├── test-helpers.ts          # Common test helper functions (TestHelpers class)
│   └── electron-test-adapter.ts # Test mode setup and data-testid injection
├── scripts/
│   └── generate-test-songs.js   # Regenerate test audio files
├── screenshots/                 # Test screenshots (auto-generated)
├── electron-helper.ts           # ElectronHelper class for dev server lifecycle
├── run-tests.js                 # Test runner script
└── *.spec.ts                    # Test suites (36 files)
```

## Test Suites

### Core
- **app-launch.spec.ts**: Application startup and window management
- **basic-functionality.spec.ts**: Navigation between views and basic app operations
- **settings.spec.ts**: Application settings and configuration
- **debug.spec.ts**: Debug app launch and diagnostic information

### Library
- **library-management.spec.ts**: Music library operations (import, search, sort, metadata)
- **large-library.spec.ts**: Large library tests (200+ tracks) for scrolling, performance, and virtualization
- **search-persistence.spec.ts**: Search term persistence across view navigation
- **deduplication.spec.ts**: Duplicate track deduplication on fresh library scan
- **stale-track-cleanup.spec.ts**: Removal of stale tracks from library and playlists on rescan
- **first-import-scroll.spec.ts**: Table rendering after first-time library import and scrolling
- **audio-formats.spec.ts**: Audio format support and metadata display

### Playback
- **playback.spec.ts**: Audio playback functionality (play, pause, skip, shuffle, repeat)
- **playback-autoplay.spec.ts**: Double-click autoplay behavior
- **playback-modes.spec.ts**: Repeat and shuffle playback mode cycling
- **playback-skip.spec.ts**: Multiple skip next commands while playing
- **playback-rapid-skip.spec.ts**: Rapid skip button clicking and playback state sync
- **playcount-threshold.spec.ts**: Play count increment after listening to 20% of track

### Playlists
- **playlists.spec.ts**: Playlist creation and management
- **drag-to-playlist.spec.ts**: Drag and drop tracks to playlists

### Table / Columns
- **column-reorder.spec.ts**: Table column reordering functionality and persistence
- **column-visibility.spec.ts**: Column visibility toggle and persistence
- **column-widths.spec.ts**: Column width resizing and persistence
- **filler-column.spec.ts**: Filler column appearance on wide windows
- **sorting-persistence.spec.ts**: Table sort order persistence across app sessions
- **playing-row-alignment.spec.ts**: Currently-playing row cell column alignment
- **scroll-to-song.spec.ts**: Scroll position after navigating away and back to library

### UI
- **ui-visual-verification.spec.ts**: UI visual layout verification at different window sizes
- **artist-browser.spec.ts**: Browser panel filtering and toggle functionality
- **browser-type-ahead.spec.ts**: Type-ahead navigation in browser artist/album columns
- **sidebar-auto-close.spec.ts**: Sidebar persistence when navigating between views
- **notifications.spec.ts**: Notification bell and badge system
- **track-context-menu.spec.ts**: Right-click context menu options for tracks
- **edit-metadata.spec.ts**: Edit metadata dialog and track information updates

### Multi-Window
- **miniplayer-sync.spec.ts**: MiniPlayer window state synchronization with main player

### User Flows
- **new-user.spec.ts**: Brand new user experience with empty library
- **migration.spec.ts**: v1 to v2 migration system (see [MIGRATION_TESTING.md](MIGRATION_TESTING.md))

## Running Tests

### Local Development

```bash
# Run all tests
npm run test:e2e

# Run tests with visible browser
npm run test:e2e:headed

# Debug tests interactively
npm run test:e2e:debug

# Use Playwright UI mode
npm run test:e2e:ui
```

### CI/CD

Tests run automatically via GitHub Actions on all pull requests (`prcheck.yml`). The workflow runs on `macos-latest` and executes: `npm ci` -> `typecheck` -> `lint` -> `build` -> `playwright test`.

## Test Environment

### Database
- Uses separate SQLite databases for different test scenarios:
  - `test-db.sqlite` - Standard tests with existing library data (205 tracks, 2 regular playlists + 3 smart playlists)
  - `new-user-db.sqlite` - New user tests with empty library (0 songs, 3 smart playlists)
  - `migration-test-db.sqlite` - Migration tests for v1 to v2 upgrades
- Databases are created fresh for each test run
- Located in `e2e/fixtures/` directory

### Test Songs
- All tests use the consolidated `e2e/fixtures/test-songs-large/` directory
- Contains 205 generated audio files (10 seconds of silence each)
  - 200 MP3 files with unique metadata (title, artist, album, track number)
  - 5 additional format test files: M4A, FLAC, WAV, OGG, AAC
- Artists include: Aurora Synth, The Jazz Collective, Indie Folk Band, Electronic Pulse, etc.
- Songs are automatically loaded during test setup via `test-db.sql`

To regenerate the test files (if needed):
```bash
node e2e/scripts/generate-test-songs.js
```

### Database Isolation

The application uses environment variables to select the correct database, ensuring test, dev, and production data never mix:

| Environment | Database Location |
|-------------|-------------------|
| **Production** | `~/Library/Application Support/hihat/library.db` |
| **Development** | `~/Library/Application Support/hihat-dev/library.db` |
| **E2E Tests** | `e2e/fixtures/test-db.sqlite` (recreated fresh each run) |

The database layer (`src/main/db/index.ts`) checks `TEST_MODE` and `TEST_DB_PATH` to route to the test database. A runtime guard also prevents `TEST_MODE` from being honored in packaged production builds. Test fixtures are excluded from production builds entirely by the electron-builder config.

### Environment Variables
- `NODE_ENV=test`: Set during test launches
- `TEST_MODE=true`: Enables test-specific behavior
- `TEST_DB_PATH`: Path to test database
- `TEST_SONGS_PATH`: Path to test audio files
- `TEST_LEGACY_CONFIG_PATH`: Path to legacy config for migration tests
- `CI=true`: Set in GitHub Actions for CI-specific behavior

## Writing Tests

### Helper Classes

**TestHelpers** (`helpers/test-helpers.ts`) provides common operations:

```typescript
// App lifecycle
const { app, page } = await TestHelpers.launchApp();
const { app, page } = await TestHelpers.launchAppAsBrandNewUser();
const { app, page } = await TestHelpers.launchAppWithMigration();
await TestHelpers.closeApp(app);

// Library operations
await TestHelpers.importSongs(page);
await TestHelpers.searchLibrary(page, 'query');
await TestHelpers.waitForLibraryLoad(page);
const count = await TestHelpers.getSongCount(page);

// Playback
await TestHelpers.playSong(page, 'Song Title');
await TestHelpers.selectSong(page, 'Song Title');
await TestHelpers.skipToNext(page);
await TestHelpers.skipToPrevious(page);
await TestHelpers.toggleShuffle(page);
await TestHelpers.toggleRepeat(page);
await TestHelpers.setVolume(page, 0.5);
const state = await TestHelpers.getPlayerState(page);

// Playlists
await TestHelpers.createPlaylist(page, 'My Playlist');
await TestHelpers.addToPlaylist(page, 'Song Title', 'Playlist Name');
await TestHelpers.likeSong(page, 'Song Title');

// Navigation and UI
await TestHelpers.navigateToView(page, 'library');
await TestHelpers.takeScreenshot(page, 'test-name');

// Migration helpers
TestHelpers.prepareMigrationFixture(configPath, songsPath);
TestHelpers.cleanupMigrationFiles(configPath);
TestHelpers.unmarkMigration(configPath);
TestHelpers.isMigrationMarked(configPath);
```

**ElectronHelper** (`electron-helper.ts`) manages the dev server and Electron app lifecycle for development-mode testing:

```typescript
const { app, page } = await ElectronHelper.startDevApp();
await ElectronHelper.cleanup(app);
```

### Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always close the app after each test
3. **Waits**: Use explicit waits instead of arbitrary timeouts when possible
4. **Selectors**: Use data-testid attributes for reliable element selection
5. **Screenshots**: Capture screenshots on failures for debugging

### Data Test IDs

Components should have `data-testid` attributes for reliable selection:

```html
<div data-testid="library-view">
<button data-testid="play-pause-button">
<input data-testid="search-input">
```

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase timeout in playwright.config.ts
2. **Cannot find elements**: Check if data-testid attributes are present
3. **Database errors**: Ensure test database path is writable
4. **Audio playback issues**: Some CI environments may not support audio

### Debugging

1. Run with `--debug` flag for step-by-step execution
2. Check screenshots in `e2e/screenshots/` for visual debugging
3. Review test reports in `playwright-report/` directory
4. Use `--headed` mode to see the browser during tests

## Maintenance

### Adding New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import TestHelpers and Playwright test utilities
3. Write test cases using the existing patterns
4. Update this README if adding new test categories

### Updating Test Data

1. Regenerate test songs using `node e2e/scripts/generate-test-songs.js`
2. Update database schema in `test-db.sql` if needed
3. Commit changes to ensure CI has access to test data

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
