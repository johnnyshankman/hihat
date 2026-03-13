import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Browser Type-Ahead Navigation', () => {
  test('type single letter in artist column selects matching artist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click on "Aurora Synth" to focus the artist column
    const auroraItem = page.locator('[data-artist="Aurora Synth"]');
    await expect(auroraItem).toBeVisible({ timeout: 5000 });
    await auroraItem.click();
    await page.waitForTimeout(500);

    // Press 'e' — first artist whose sortKey starts with 'e' is Electronic Pulse
    await page.keyboard.press('e');
    await page.waitForTimeout(500);

    // Assert Electronic Pulse is selected
    const epItem = page.locator('[data-artist="Electronic Pulse"]');
    await expect(epItem).toHaveClass(/browser-item-selected/);

    // Assert track table is filtered to Electronic Pulse tracks (10 tracks)
    const trackRows = page.locator('[data-track-id]');
    await expect(trackRows).toHaveCount(10);

    await TestHelpers.closeApp(app);
  });

  test('type multiple letters quickly accumulates search', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click any artist item to focus the column
    const anyArtist = page.locator('[data-artist="Aurora Synth"]');
    await expect(anyArtist).toBeVisible({ timeout: 5000 });
    await anyArtist.click();
    await page.waitForTimeout(300);

    // Press 'r' then 'o' quickly (within 600ms)
    await page.keyboard.press('r');
    await page.keyboard.press('o');
    await page.waitForTimeout(500);

    // Assert "Rock Titans" is selected (sortKey "rock titans" starts with "ro")
    const rockItem = page.locator('[data-artist="Rock Titans"]');
    await expect(rockItem).toHaveClass(/browser-item-selected/);

    // Assert NOT "R&B Smooth" (which starts with "r" but not "ro")
    const rbItem = page.locator('[data-artist="R&B Smooth"]');
    await expect(rbItem).not.toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('buffer resets after timeout', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click artist to focus
    const anyArtist = page.locator('[data-artist="Aurora Synth"]');
    await expect(anyArtist).toBeVisible({ timeout: 5000 });
    await anyArtist.click();
    await page.waitForTimeout(300);

    // Press 'r', wait 800ms (> 600ms timeout), then press 'a'
    await page.keyboard.press('r');
    await page.waitForTimeout(800);
    await page.keyboard.press('a');
    await page.waitForTimeout(500);

    // Buffer reset, 'a' matches "Acoustic Sessions" (first artist with sortKey starting with "a")
    const acousticItem = page.locator('[data-artist="Acoustic Sessions"]');
    await expect(acousticItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('type letter in album column works independently', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click on the first album item to focus the album column
    const firstAlbum = page
      .locator('[data-testid="browser-album-item"]')
      .first();
    await expect(firstAlbum).toBeVisible({ timeout: 5000 });
    await firstAlbum.click();
    await page.waitForTimeout(300);

    // Press 's' — first album whose sortKey starts with 's' is "Slow Jams"
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    // Assert "Slow Jams" is selected in the album column
    const slowJamsItem = page.locator('[data-album="Slow Jams"]');
    await expect(slowJamsItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('clicking outside browser clears focus and typing does nothing', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click artist to focus and select Electronic Pulse
    const epItem = page.locator('[data-artist="Electronic Pulse"]');
    await expect(epItem).toBeVisible({ timeout: 5000 });
    await epItem.click();
    await page.waitForTimeout(500);

    // Verify Electronic Pulse is selected
    await expect(epItem).toHaveClass(/browser-item-selected/);

    // Click on the track table (outside browser)
    const trackRow = page.locator('[data-track-id]').first();
    await trackRow.click();
    await page.waitForTimeout(300);

    // Press 'a' — should do nothing since focus is cleared
    await page.keyboard.press('a');
    await page.waitForTimeout(500);

    // Electronic Pulse should still be selected (not changed to Acoustic Sessions)
    await expect(epItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('sortKey matching — The Jazz Collective matches j', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    // Click any artist to focus
    const anyArtist = page.locator('[data-artist="Aurora Synth"]');
    await expect(anyArtist).toBeVisible({ timeout: 5000 });
    await anyArtist.click();
    await page.waitForTimeout(300);

    // Press 'j' — sortKey strips "the " so "The Jazz Collective" becomes "jazz collective"
    await page.keyboard.press('j');
    await page.waitForTimeout(500);

    // Assert "The Jazz Collective" is selected
    const jazzItem = page.locator('[data-artist="The Jazz Collective"]');
    await expect(jazzItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('focus indicator CSS class applied to focused column', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 5000 });

    // Open browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);

    const artistColumn = page.locator('[data-testid="browser-artist-column"]');
    const albumColumn = page.locator('[data-testid="browser-album-column"]');

    // Click artist column — it should get the focus class
    const anyArtist = page.locator('[data-artist="Aurora Synth"]');
    await expect(anyArtist).toBeVisible({ timeout: 5000 });
    await anyArtist.click();
    await page.waitForTimeout(300);

    await expect(artistColumn).toHaveClass(/browser-column-focused/);
    await expect(albumColumn).not.toHaveClass(/browser-column-focused/);

    // Click album column — focus should move
    const firstAlbum = page
      .locator('[data-testid="browser-album-item"]')
      .first();
    await firstAlbum.click();
    await page.waitForTimeout(300);

    await expect(albumColumn).toHaveClass(/browser-column-focused/);
    await expect(artistColumn).not.toHaveClass(/browser-column-focused/);

    await TestHelpers.closeApp(app);
  });
});
