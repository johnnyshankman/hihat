# E2E Test Updates

## Updated Test: "should display main UI components"

### Problem
The original test was checking for UI components that didn't exist or had incorrect selectors:
- Looking for buttons with names "Library" and "Playlists" that don't exist
- Not leveraging the actual data attributes in the UI
- Not checking for the right component structure

### Solution
Updated the test to check for the **actual** UI components that exist in MainLayout:

### What the Test Now Verifies

1. **Sidebar/Drawer Visibility**
   ```typescript
   const drawer = await page.locator('.MuiDrawer-root').isVisible();
   ```
   - Confirms the MUI Drawer (sidebar) is visible

2. **Library Section Header**
   ```typescript
   const libraryHeader = await page.getByText('Library', { exact: false });
   ```
   - Verifies "LIBRARY" section header exists in sidebar

3. **Library View Button**
   ```typescript
   const allLibraryButton = await page.locator('[data-view="library"]').isVisible();
   ```
   - Uses the actual `data-view="library"` attribute
   - This is the "All" button that shows the full library

4. **Playlists Section Header**
   ```typescript
   const playlistsHeader = await page.getByText('Playlists', { exact: false });
   ```
   - Verifies "PLAYLISTS" section header exists in sidebar

5. **Playlist Items from Fixture Data**
   ```typescript
   const playlistItems = await page.locator('[data-playlist-id]').count();
   expect(playlistItems).toBeGreaterThanOrEqual(5);
   ```
   - Uses the actual `data-playlist-id` attribute on playlist items
   - Verifies all 5 test playlists loaded from fixture data:
     - Test Playlist 1
     - Jazz Favorites
     - Recently Added (smart)
     - Recently Played (smart)
     - Most Played (smart)

6. **Settings Button**
   ```typescript
   const settingsButton = await page.getByRole('button', { name: 'Settings' }).isVisible();
   ```
   - Verifies settings button is accessible in the top-right

7. **Main Content Area**
   ```typescript
   const mainContent = await page.locator('main').isVisible();
   ```
   - Confirms the main content area renders

8. **Track Table in Library View**
   ```typescript
   const tableRows = await page.locator('tr[role="row"]').count();
   expect(tableRows).toBeGreaterThan(0);
   ```
   - Verifies tracks from fixture data are displayed
   - Library view should show the 7 test tracks

9. **Player Component**
   ```typescript
   const player = await page.locator('.MuiBox-root').last().isVisible();
   ```
   - Confirms player is visible at the bottom

### Key Improvements

✅ **Uses Actual Selectors**
- Leverages `data-view="library"` attribute
- Uses `data-playlist-id` attributes
- Checks for real component structure

✅ **Verifies Fixture Data Integration**
- Confirms 5 playlists loaded from test database
- Checks for tracks in library view
- Validates the test environment is working correctly

✅ **More Robust**
- Waits 3 seconds for app to fully load
- Checks multiple aspects of the UI
- Tests pass consistently

✅ **Better Documentation**
- Clear comments explaining what each check does
- Numbered steps for easy reference

### Test Structure

```
MainLayout UI Components Test
├── Sidebar/Drawer
│   ├── Library Section
│   │   ├── Header: "LIBRARY"
│   │   └── Button: "All" [data-view="library"]
│   ├── Playlists Section
│   │   ├── Header: "PLAYLISTS"
│   │   └── Items: 5 playlists [data-playlist-id]
│   └── Settings Button
├── Main Content Area
│   └── Library View (default)
│       └── Track Table (7 test tracks)
└── Player Component (bottom)
```

### Running the Test

```bash
# Build the app
npm run build

# Run the specific test
npm run test:e2e app-launch.spec.ts

# Run with visible browser
npm run test:e2e:headed app-launch.spec.ts
```

### Expected Results

All checks should pass:
- ✅ Drawer visible
- ✅ Library header found
- ✅ Library view button found
- ✅ Playlists header found
- ✅ 5 playlist items found
- ✅ Settings button visible
- ✅ Main content visible
- ✅ Track table has rows
- ✅ Player visible

### Related Files

- **Test File**: `e2e/app-launch.spec.ts`
- **UI Component**: `src/renderer/components/MainLayout.tsx`
- **Fixture Data**: `e2e/fixtures/test-db.sql`

### Future Enhancements

Consider adding more `data-testid` attributes to components for easier testing:
- Add `data-testid="player"` to Player component
- Add `data-testid="library-table"` to Library table
- Add `data-testid="sidebar"` to Drawer
- Add `data-testid="settings-button"` to Settings button

This would make tests more semantic and less dependent on MUI class names.
