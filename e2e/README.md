# E2E Testing Suite

This directory contains the end-to-end testing suite for the Hihat music player application, built with Playwright for Electron.

## Structure

```
e2e/
├── fixtures/           # Test data and resources
│   ├── test-songs/    # Sample audio files for testing
│   └── test-db.sql    # Database initialization script
├── helpers/           # Test utilities and helpers
│   ├── test-helpers.ts         # Common test helper functions
│   └── electron-test-adapter.ts # Electron-specific test adaptations
├── screenshots/       # Test screenshots (auto-generated)
└── *.spec.ts         # Test suites
```

## Test Suites

- **app-launch.spec.ts**: Application startup and window management
- **library-management.spec.ts**: Music library operations (import, search, sort, metadata)
- **playback.spec.ts**: Audio playback functionality (play, pause, skip, shuffle, repeat)
- **playlists.spec.ts**: Playlist creation and management
- **settings.spec.ts**: Application settings and configuration
- **new-user.spec.ts**: Brand new user experience with empty library

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

Tests run automatically via GitHub Actions on:
- Push to main, develop, or hihat2 branches
- Pull requests to main or develop
- Manual workflow dispatch

## Test Environment

### Database
- Uses separate SQLite databases for different test scenarios:
  - `test-db.sqlite` - Standard tests with existing library data (7 songs, 5 playlists)
  - `new-user-db.sqlite` - New user tests with empty library (0 songs, 3 smart playlists)
- Databases are created fresh for each test run
- Located in `e2e/fixtures/` directory

### Test Songs
- Sample audio files are stored in `e2e/fixtures/test-songs/`
- These files are committed to the repository for consistent testing
- Songs are automatically imported during test setup

### Environment Variables
- `TEST_MODE=true`: Enables test-specific behavior
- `TEST_DB_PATH`: Path to test database
- `TEST_SONGS_PATH`: Path to test audio files
- `CI=true`: Set in GitHub Actions for CI-specific behavior
- `HEADLESS=true`: Run tests without visible UI (Linux CI)

## Writing Tests

### Helper Functions

The `TestHelpers` class provides common operations:

```typescript
// Launch the application with existing library data
const { app, page } = await TestHelpers.launchApp();

// Launch the application as a brand new user (empty library)
const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

// Import songs
await TestHelpers.importSongs(page);

// Play a song
await TestHelpers.playSong(page, 'Song Title');

// Create a playlist
await TestHelpers.createPlaylist(page, 'My Playlist');

// Navigate between views
await TestHelpers.navigateToView(page, 'library');

// Take screenshots
await TestHelpers.takeScreenshot(page, 'test-name');
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

## CI/CD Integration

### GitHub Actions

The workflow runs on multiple operating systems:
- Ubuntu (with and without display)
- Windows
- macOS

Test artifacts are uploaded:
- Test reports (30 days retention)
- Screenshots on failure (7 days retention)

### Platform-Specific Notes

**Linux CI**: Uses Xvfb for virtual display
**Windows**: May require additional audio codecs
**macOS**: Requires code signing for some features

## Maintenance

### Adding New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import TestHelpers and Playwright test utilities
3. Write test cases using the existing patterns
4. Update this README if adding new test categories

### Updating Test Data

1. Add new test songs to `e2e/fixtures/test-songs/`
2. Update database schema in `test-db.sql` if needed
3. Commit changes to ensure CI has access to test data

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)