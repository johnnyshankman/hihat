import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Read the visible track-id order from the rendered virtual table. With the
 * search filter applied below, the visible row count drops well under the
 * VirtualTable's overscan window (~65 rows), so DOM order equals sort order
 * for the 13 Hip Hop Legends-related rows we assert on.
 */
async function getRenderedTrackIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('[data-track-id]');
    return Array.from(rows).map(
      (el) => (el as HTMLElement).dataset.trackId || '',
    );
  });
}

/**
 * Read the column + direction of whichever header has aria-sort applied.
 * Used to confirm the click landed on Artist (not Album Artist) and applied
 * an ascending sort.
 */
async function getActiveSort(
  page: Page,
): Promise<{ column: string; direction: string } | null> {
  return page.evaluate(() => {
    const headers = document.querySelectorAll('th');
    // eslint-disable-next-line no-restricted-syntax
    for (const header of Array.from(headers)) {
      const dir = header.getAttribute('aria-sort');
      if (dir === 'ascending' || dir === 'descending') {
        return { column: (header.textContent || '').trim(), direction: dir };
      }
    }
    return null;
  });
}

// Hip Hop Legends-anchored fixture rows in test-db.sql, by album group.
// Used by relative-ordering assertions below. The 3 plain-album tracks per
// group all share a trackNumber (artifact of the auto-generated fixture);
// assertions stay tolerant by comparing min/max of each group instead of
// relying on a specific intra-group order.
const BEATS_RHYMES = ['test-large-047', 'test-large-107', 'test-large-167'];
const STREET_POETRY = [
  'test-large-007',
  'test-large-067',
  'test-large-127',
  'test-large-187',
];
const URBAN_CHRONICLES = ['test-large-027', 'test-large-087', 'test-large-147'];
const FEAT_AURORA = 'test-large-feat-002'; // 'Hip Hop Legends feat. Aurora Synth' / Beats & Rhymes / track #13
const FEAT_REGGAE = 'test-large-feat-003'; // 'Hip Hop Legends feat. Reggae Vibes' / Beats & Rhymes / track #14
const FEAT_SOUL = 'test-large-feat-001'; // 'Hip Hop Legends feat. Soul Sisters' / Beats & Rhymes / track #12
const ALL_FEAT = [FEAT_AURORA, FEAT_REGGAE, FEAT_SOUL];
const ALL_PLAIN_HHL = [...BEATS_RHYMES, ...STREET_POETRY, ...URBAN_CHRONICLES];

test.describe('Artist column — sort by album artist (toggle on)', () => {
  test('feat tracks stay grouped with their album block', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Narrow the visible set to the 13 Hip Hop Legends-related tracks via
    // the search box. test-db.sql has 200+ rows, and the VirtualTable's
    // overscan only renders the visible viewport plus ~20 rows of buffer,
    // so without filtering we couldn't see the HHL block in the DOM. The
    // search input is gated behind a toggle button (collapsed by default).
    await page.click('[aria-label="Show/Hide search"]');
    await page.waitForSelector('[data-testid="search-input"]', {
      timeout: 5000,
    });
    await page.fill('[data-testid="search-input"]', 'Hip Hop Legends');
    await page.waitForTimeout(500);

    const artistHeader = page.locator('th:has-text("Artist")').first();
    await artistHeader.click();
    await page.waitForTimeout(500);

    const sortInfo = await getActiveSort(page);
    expect(sortInfo).not.toBeNull();
    // Header text includes a trailing ▲/▼ glyph; assert by prefix and
    // explicitly rule out 'Album Artist' so a regression that targets the
    // wrong column would fail loudly here.
    expect(sortInfo!.column.startsWith('Artist')).toBe(true);
    expect(sortInfo!.column.startsWith('Album')).toBe(false);
    expect(sortInfo!.direction).toBe('ascending');

    const orderedIds = await getRenderedTrackIds(page);
    const indexOf = (id: string) => orderedIds.indexOf(id);
    expect(orderedIds).toContain(FEAT_AURORA);
    expect(orderedIds).toContain(FEAT_REGGAE);
    expect(orderedIds).toContain(FEAT_SOUL);

    // Album-artist-aware sort: HHL tracks ordered by album → trackNumber.
    // Beats & Rhymes (alphabetically first) comes before Street Poetry,
    // which comes before Urban Chronicles. Within Beats & Rhymes, the 3
    // plain tracks (#11) come first, then the 3 feat tracks (#12–14).
    const beatsMax = Math.max(...BEATS_RHYMES.map(indexOf));
    const streetMin = Math.min(...STREET_POETRY.map(indexOf));
    const featMin = Math.min(...ALL_FEAT.map(indexOf));
    const featMax = Math.max(...ALL_FEAT.map(indexOf));
    expect(beatsMax).toBeLessThan(featMin);
    expect(featMax).toBeLessThan(streetMin);

    // Feat tracks ordered by trackNumber: #12 (Soul) < #13 (Aurora) < #14 (Reggae).
    expect(indexOf(FEAT_SOUL)).toBeLessThan(indexOf(FEAT_AURORA));
    expect(indexOf(FEAT_AURORA)).toBeLessThan(indexOf(FEAT_REGGAE));

    await TestHelpers.takeScreenshot(page, 'sort-artist-toggle-on');
    await TestHelpers.closeApp(app);
  });
});

test.describe('Artist column — sort by raw artist (toggle off)', () => {
  test('flipping the toggle off scatters feat tracks by raw artist', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Round-trip through the Settings UI: open Settings drawer, flip the
    // toggle, dismiss the drawer. Exercises the full chain — Switch click
    // → useUpdateSettings mutation → settings:update IPC → DB write → query
    // cache update → column-defs useMemo rebuild.
    await page.click('[data-testid="nav-settings"]');
    await page.waitForTimeout(500);

    const toggle = page.locator(
      '[data-testid="sort-artist-by-album-artist-toggle"]',
    );
    await expect(toggle).toBeVisible();
    expect(await toggle.isChecked()).toBe(true);
    await toggle.click();
    await page.waitForTimeout(300);
    expect(await toggle.isChecked()).toBe(false);

    // Confirm the value made it through IPC, not just the local switch state.
    const persistedAfterOff = await page.evaluate(() =>
      (window as Window & { electron?: any }).electron.settings
        .get()
        .then((s: { sortArtistByAlbumArtist: boolean }) =>
          Boolean(s.sortArtistByAlbumArtist),
        ),
    );
    expect(persistedAfterOff).toBe(false);

    // Settings opens as a temporary MUI Drawer that overlays the library and
    // intercepts pointer events for everything underneath. Press Escape to
    // dismiss it before re-targeting the table.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    await page.click('[aria-label="Show/Hide search"]');
    await page.waitForSelector('[data-testid="search-input"]', {
      timeout: 5000,
    });
    await page.fill('[data-testid="search-input"]', 'Hip Hop Legends');
    await page.waitForTimeout(500);

    const artistHeader = page.locator('th:has-text("Artist")').first();
    await artistHeader.click();
    await page.waitForTimeout(500);

    const sortInfo = await getActiveSort(page);
    expect(sortInfo).not.toBeNull();
    expect(sortInfo!.column.startsWith('Artist')).toBe(true);
    expect(sortInfo!.column.startsWith('Album')).toBe(false);
    expect(sortInfo!.direction).toBe('ascending');

    const orderedIds = await getRenderedTrackIds(page);
    const indexOf = (id: string) => orderedIds.indexOf(id);
    expect(orderedIds).toContain(FEAT_AURORA);
    expect(orderedIds).toContain(FEAT_REGGAE);
    expect(orderedIds).toContain(FEAT_SOUL);

    // Raw-artist sort: all 10 plain HHL tracks ('Hip Hop Legends') sort
    // before any feat track ('Hip Hop Legends feat. ...'), because the
    // primary key is the raw artist string. Within the feat group, the
    // suffix drives alphabetical order: Aurora < Reggae < Soul.
    const plainMax = Math.max(...ALL_PLAIN_HHL.map(indexOf));
    const featMin = Math.min(...ALL_FEAT.map(indexOf));
    expect(plainMax).toBeLessThan(featMin);

    expect(indexOf(FEAT_AURORA)).toBeLessThan(indexOf(FEAT_REGGAE));
    expect(indexOf(FEAT_REGGAE)).toBeLessThan(indexOf(FEAT_SOUL));

    // Toggle-on order had Soul < Aurora < Reggae (track-number driven);
    // toggle-off must differ — guards against the comparator silently
    // collapsing back to the album-artist path.
    expect(indexOf(FEAT_SOUL)).toBeGreaterThan(indexOf(FEAT_REGGAE));

    await TestHelpers.takeScreenshot(page, 'sort-artist-toggle-off');
    await TestHelpers.closeApp(app);
  });
});
