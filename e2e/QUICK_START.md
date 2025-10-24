# E2E Testing with Fixture Data - Quick Start

## TL;DR

Your E2E tests now automatically use fixture data (7 test songs, 5 playlists, pre-configured settings) without affecting production or development. Just run:

```bash
npm run build        # Build the app
npm run test:e2e     # Run E2E tests with fixture data
```

## What Was Implemented

### ✅ Automatic Fixture Data Loading
- Tests now start with 7 pre-loaded test songs
- 5 playlists already configured (including smart playlists)
- Settings pre-configured (no library setup screen)
- **No manual setup required**

### ✅ Complete Isolation
- **Production:** Uses `~/Library/Application Support/hihat/library.db`
- **Development:** Uses `~/Library/Application Support/hihat-dev/library.db`
- **E2E Tests:** Uses `e2e/fixtures/test-db.sqlite` (recreated fresh each run)

### ✅ Safety Guarantees
- Test fixtures **cannot** be included in production builds (excluded by electron-builder)
- Runtime checks prevent TEST_MODE in packaged production apps
- Development mode (`npm run start`) never uses test data
- Each test run starts with a fresh database

## How to Use

### Run Your E2E Tests

```bash
# All E2E tests (now with fixture data)
npm run test:e2e

# Specific test file
npm run test:e2e app-launch.spec.ts

# With visible browser
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

### Run the Fixture Data Test

```bash
# Test that verifies fixture data is working
npm run test:e2e fixture-data-test.spec.ts
```

### Add More Test Fixtures

1. Add song files to `e2e/fixtures/test-songs/`
2. Update `e2e/fixtures/test-db.sql`:

```sql
INSERT INTO tracks (...) VALUES
('test-8', '{{TEST_SONGS_PATH}}/your-new-song.m4a', 'Title', 'Artist', ...);
```

The `{{TEST_SONGS_PATH}}` placeholder is automatically replaced with the actual path during tests.

## What's in the Fixture Data

### 7 Test Songs
- A. G. Cook - Undying & Windows (Electronic)
- Bill Evans - 3 jazz tracks
- Bladee - White Meadow (Cloud Rap)
- Kendrick Lamar - King Kunta (Hip Hop)

### 5 Playlists
- Test Playlist 1
- Jazz Favorites
- Recently Added (smart)
- Recently Played (smart)
- Most Played (smart)

### Pre-configured Settings
- Library path pointing to test songs
- Dark theme
- Last played: King Kunta
- Volume: 1.0

## Files Changed

| File | Change |
|------|--------|
| `e2e/fixtures/test-db.sql` | Added `{{TEST_SONGS_PATH}}` placeholders |
| `e2e/helpers/test-helpers.ts` | Updated to replace placeholders with real paths |
| `e2e/electron-helper.ts` | Added test database initialization |
| `src/main/db/index.ts` | Enhanced TEST_MODE handling with safety checks |

## New Files

| File | Purpose |
|------|---------|
| `e2e/FIXTURE_DATA_GUIDE.md` | Comprehensive guide on fixture data system |
| `e2e/IMPLEMENTATION_SUMMARY.md` | Detailed implementation explanation |
| `e2e/fixture-data-test.spec.ts` | Test suite verifying fixture data works |
| `e2e/QUICK_START.md` | This quick start guide |

## Verification

### ✅ Typecheck Passes
```bash
npm run typecheck  # ✅ No errors
```

### ✅ Lint Passes
```bash
npm run lint  # ✅ No errors
```

### ✅ Build Works
```bash
npm run build  # ✅ Successful
```

### ✅ Tests Run
```bash
npm run test:e2e fixture-data-test.spec.ts  # ✅ All tests pass
```

## Common Questions

### Q: Will test data appear in my production builds?
**A:** No. The `e2e/` directory is excluded from production builds by electron-builder.

### Q: Will test data appear when I run `npm run start` in development?
**A:** No. Development mode uses a separate database at `hihat-dev/library.db`.

### Q: How do I know if fixture data is loading?
**A:** Run the fixture data test: `npm run test:e2e fixture-data-test.spec.ts`

### Q: Can I modify the test database?
**A:** Yes! Edit `e2e/fixtures/test-db.sql`. Use `{{TEST_SONGS_PATH}}` for file paths.

### Q: What if I need different test data for different tests?
**A:** You can create multiple SQL files and modify `TestHelpers.initializeTestDatabase()` to accept a SQL file parameter.

## Next Steps

1. **Run the fixture data test** to verify everything works:
   ```bash
   npm run build
   npm run test:e2e fixture-data-test.spec.ts
   ```

2. **Update your existing tests** - They should now work without manual library setup

3. **Add more test fixtures** as needed for comprehensive testing

## Documentation

- **Full Guide:** `e2e/FIXTURE_DATA_GUIDE.md`
- **Implementation Details:** `e2e/IMPLEMENTATION_SUMMARY.md`
- **E2E Testing Overview:** `e2e/README.md`

## Success! 🎉

You now have a fully functional E2E testing setup with fixture data that:
- ✅ Works automatically
- ✅ Doesn't affect production or development
- ✅ Resets between test runs
- ✅ Is safe by design
- ✅ Is easy to extend

Happy testing! 🧪
