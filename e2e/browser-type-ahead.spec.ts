import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

const ARTIST_COLUMN = '[data-testid="browser-artist-column"]';
const ALBUM_COLUMN = '[data-testid="browser-album-column"]';

/**
 * Open the browser panel and wait for it to render.
 */
async function openBrowser(page: Page) {
  await page.locator('[data-testid="browser-toggle"]').click();
  await expect(page.locator('[data-testid="browser-panel"]')).toBeVisible();
}

/**
 * Click a browser item and wait for its column to take focus. Type-ahead only
 * works on the focused column, so this is the precondition every keypress test
 * needs — waiting for the focus class is what makes the keypress deterministic.
 */
async function focusItem(page: Page, item: string, column: string) {
  const target = page.locator(item);
  await expect(target).toBeVisible();
  await target.click();
  await expect(page.locator(column)).toHaveClass(/browser-column-focused/);
}

/**
 * Let one frame pass. Used before *negative* assertions (nothing should have
 * changed): the type-ahead handler is synchronous, so if a change were coming
 * it would already be committed by the next frame.
 */
async function nextFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );
}

test.describe('Browser Type-Ahead Navigation', () => {
  test('type single letter in artist column selects matching artist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);

    // Click on "Aurora Synth" to focus the artist column
    await focusItem(page, '[data-artist="Aurora Synth"]', ARTIST_COLUMN);

    // Press 'e' — first artist whose sortKey starts with 'e' is Electronic Pulse
    await page.keyboard.press('e');

    // Assert Electronic Pulse is selected
    const epItem = page.locator('[data-artist="Electronic Pulse"]');
    await expect(epItem).toHaveClass(/browser-item-selected/);

    // Assert track table is filtered to Electronic Pulse tracks (10 tracks)
    await expect(page.locator('[data-track-id]')).toHaveCount(10);

    await TestHelpers.closeApp(app);
  });

  test('type multiple letters quickly accumulates search', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);
    await focusItem(page, '[data-artist="Aurora Synth"]', ARTIST_COLUMN);

    // Press 'r' then 'o' quickly (within the 600ms type-ahead buffer window)
    await page.keyboard.press('r');
    await page.keyboard.press('o');

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

    await openBrowser(page);
    await focusItem(page, '[data-artist="Aurora Synth"]', ARTIST_COLUMN);

    // Press 'r', outwait the buffer, then press 'a'. This delay is the feature
    // under test — Browser.tsx clears the type-ahead buffer 600ms after the
    // last keypress — so it is deliberately longer than that window.
    await page.keyboard.press('r');
    await page.waitForTimeout(800);
    await page.keyboard.press('a');

    // Buffer reset, 'a' matches "Acoustic Sessions" (first artist with sortKey starting with "a")
    const acousticItem = page.locator('[data-artist="Acoustic Sessions"]');
    await expect(acousticItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('type letter in album column works independently', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);

    // Click on the first album item to focus the album column
    await focusItem(
      page,
      '[data-testid="browser-album-item"] >> nth=0',
      ALBUM_COLUMN,
    );

    // Press 's' — first album whose sortKey starts with 's' is "Slow Jams"
    await page.keyboard.press('s');

    // Assert "Slow Jams" is selected in the album column
    const slowJamsItem = page.locator('[data-album="Slow Jams"]');
    await expect(slowJamsItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('clicking outside browser clears focus and typing does nothing', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);

    // Click artist to focus and select Electronic Pulse
    await focusItem(page, '[data-artist="Electronic Pulse"]', ARTIST_COLUMN);
    const epItem = page.locator('[data-artist="Electronic Pulse"]');
    await expect(epItem).toHaveClass(/browser-item-selected/);

    // Click on the track table (outside browser) — focus should clear
    await page.locator('[data-track-id]').first().click();
    await expect(page.locator(ARTIST_COLUMN)).not.toHaveClass(
      /browser-column-focused/,
    );

    // Press 'a' — should do nothing since focus is cleared
    await page.keyboard.press('a');
    await nextFrame(page);

    // Electronic Pulse should still be selected (not changed to Acoustic Sessions)
    await expect(epItem).toHaveClass(/browser-item-selected/);
    await expect(
      page.locator('[data-artist="Acoustic Sessions"]'),
    ).not.toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('sortKey matching — The Jazz Collective matches j', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);
    await focusItem(page, '[data-artist="Aurora Synth"]', ARTIST_COLUMN);

    // Press 'j' — sortKey strips "the " so "The Jazz Collective" becomes "jazz collective"
    await page.keyboard.press('j');

    // Assert "The Jazz Collective" is selected
    const jazzItem = page.locator('[data-artist="The Jazz Collective"]');
    await expect(jazzItem).toHaveClass(/browser-item-selected/);

    await TestHelpers.closeApp(app);
  });

  test('focus indicator CSS class applied to focused column', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openBrowser(page);

    const artistColumn = page.locator(ARTIST_COLUMN);
    const albumColumn = page.locator(ALBUM_COLUMN);

    // Click artist column — it should get the focus class
    await focusItem(page, '[data-artist="Aurora Synth"]', ARTIST_COLUMN);
    await expect(albumColumn).not.toHaveClass(/browser-column-focused/);

    // Click album column — focus should move
    await focusItem(
      page,
      '[data-testid="browser-album-item"] >> nth=0',
      ALBUM_COLUMN,
    );
    await expect(artistColumn).not.toHaveClass(/browser-column-focused/);

    await TestHelpers.closeApp(app);
  });
});
