import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe('First-time Library Import Scroll', () => {
  test('should render table correctly after first-time library import', async () => {
    const { app, page } = await TestHelpers.launchAppAsBrandNewUser();

    // Wait for app to fully load and verify empty library state
    await page.waitForTimeout(3000);
    const emptyMessage = page.getByText('Your library is empty');
    expect(await emptyMessage.isVisible()).toBe(true);

    // Trigger library scan via the electron API
    await TestHelpers.importSongs(page);

    // Wait for tracks to appear (scan complete event triggers loadLibrary)
    await page.waitForSelector('[data-track-id]', { timeout: 30000 });

    // Verify tracks loaded
    const initialTrackCount = await page.locator('[data-track-id]').count();
    expect(initialTrackCount).toBeGreaterThan(0);

    // Get the virtualized table container
    const tableContainer = page.locator('[data-testid="vt-container"]').first();
    await expect(tableContainer).toBeVisible();

    // Perform rapid scrolling to stress the virtualizer
    await tableContainer.evaluate((container) => {
      const scrollSteps = 10;
      const scrollAmount = 500;
      for (let i = 0; i < scrollSteps; i += 1) {
        setTimeout(() => {
          container.scrollTop += scrollAmount;
        }, i * 100);
      }
    });
    // Wait for all scroll steps to complete
    await page.waitForTimeout(1500);

    // Give the virtualizer a moment to settle after scrolling
    await page.waitForTimeout(500);

    // Verify rows are still present after scrolling
    const postScrollTrackCount = await page.locator('[data-track-id]').count();
    expect(postScrollTrackCount).toBeGreaterThan(0);

    // Key assertion: every visible row should have non-empty cell content
    // If the duplicate loadLibrary bug were present, some rows would render blank
    const blankRows = await page.evaluate(() => {
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
    });

    expect(blankRows).toBe(0);

    await TestHelpers.closeApp(app);
  });
});
