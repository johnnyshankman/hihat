/* eslint-disable no-plusplus, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('Playing Row Column Alignment', () => {
  /**
   * Verify the currently-playing row's cell content is not shifted by one
   * column to the right. Regression test for the ::before pseudo-element
   * bug in border-collapse tables where Chromium treats the pseudo-element
   * as an anonymous table cell.
   */
  test('playing row cells should align with header columns', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Find the Title column index from the header row
    const headers = page.locator('thead th');
    const headerCount = await headers.count();
    let titleColumnIndex = -1;
    let artistColumnIndex = -1;

    for (let i = 0; i < headerCount; i++) {
      const text = await headers.nth(i).textContent();
      if (text?.includes('Title')) titleColumnIndex = i;
      if (text?.includes('Artist')) artistColumnIndex = i;
    }

    expect(titleColumnIndex).toBeGreaterThan(-1);
    expect(artistColumnIndex).toBeGreaterThan(-1);

    // Get the first track row and read its title/artist cell values before playing
    const firstRow = page.locator('[data-track-id]').first();
    const titleBeforePlay = await firstRow
      .locator('td')
      .nth(titleColumnIndex)
      .textContent();
    const artistBeforePlay = await firstRow
      .locator('td')
      .nth(artistColumnIndex)
      .textContent();

    expect(titleBeforePlay?.trim()).toBeTruthy();
    expect(artistBeforePlay?.trim()).toBeTruthy();

    // Double-click to start playback
    await firstRow.dblclick();
    await page.waitForTimeout(1000);

    // Verify the track is playing
    const pauseIcon = page.locator('button svg[data-testid="PauseIcon"]');
    await expect(pauseIcon).toBeVisible({ timeout: 5000 });

    // Locate the playing row (has vt-row-playing or vt-row-playing-selected class)
    const playingRow = page.locator(
      'tr.vt-row-playing, tr.vt-row-playing-selected',
    );
    await expect(playingRow).toBeVisible({ timeout: 5000 });

    // Read the playing row's cells at the same column indices
    const titleDuringPlay = await playingRow
      .locator('td')
      .nth(titleColumnIndex)
      .textContent();
    const artistDuringPlay = await playingRow
      .locator('td')
      .nth(artistColumnIndex)
      .textContent();

    // The cell content should match what was there before playing started
    // If there's a column offset bug, title would appear in artist's column
    expect(titleDuringPlay?.trim()).toBe(titleBeforePlay?.trim());
    expect(artistDuringPlay?.trim()).toBe(artistBeforePlay?.trim());

    // Additionally verify the number of <td> cells matches the header count
    const cellCount = await playingRow.locator('td').count();
    expect(cellCount).toBe(headerCount);

    await TestHelpers.closeApp(app);
  });
});
