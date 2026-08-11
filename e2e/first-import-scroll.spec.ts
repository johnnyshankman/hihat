import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('First-time Library Import Scroll', () => {
  test('should render table correctly after first-time library import', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    // Verify empty library state
    await expect(page.getByText('Your library is empty')).toBeVisible();

    // Trigger library scan via the electron API (waits for rows to land)
    await TestHelpers.importSongs(page);

    // Verify tracks loaded
    const initialTrackCount = await page.locator('[data-track-id]').count();
    expect(initialTrackCount).toBeGreaterThan(0);

    // Get the virtualized table container
    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    await expect(tableContainer).toBeVisible();

    // Perform rapid scrolling to stress the virtualizer. Stepping on
    // requestAnimationFrame keeps the multi-frame burst the virtualizer has to
    // cope with, while letting the evaluate resolve when the burst is actually
    // done — no sleeping past a guessed duration.
    await tableContainer.evaluate(async (container) => {
      await new Promise<void>((resolve) => {
        let step = 0;
        const tick = () => {
          container.scrollTop += 500;
          step += 1;
          if (step < 10) {
            requestAnimationFrame(tick);
          } else {
            // One extra frame so the virtualizer commits the final range.
            requestAnimationFrame(() => resolve());
          }
        };
        requestAnimationFrame(tick);
      });
    });

    // Verify rows are still present after scrolling
    const postScrollTrackCount = await page.locator('[data-track-id]').count();
    expect(postScrollTrackCount).toBeGreaterThan(0);

    // Key assertion: every visible row should have non-empty cell content
    // If the duplicate loadLibrary bug were present, some rows would render blank
    await expect
      .poll(() =>
        page.evaluate(() => {
          const rows = document.querySelectorAll('[data-track-id]');
          let blankCount = 0;
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            const hasContent = Array.from(cells).some(
              (cell) => (cell.textContent || '').trim().length > 0,
            );
            if (!hasContent) {
              blankCount += 1;
            }
          });
          return blankCount;
        }),
      )
      .toBe(0);

    await TestHelpers.closeApp(app);
  });
});
