import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/** Width the virtual table's scroll container currently reports. */
const containerWidth = (page: Page) =>
  page.evaluate(() => {
    const container = document.querySelector(
      '[data-testid="vt-container"]',
    ) as HTMLElement | null;
    return container ? container.clientWidth : 0;
  });

test.describe('Filler Column', () => {
  test('filler column appears on wide windows', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Resize the Electron window to be very wide
    const browserWindow = await app.browserWindow(page);
    await browserWindow.evaluate((win) => win.setSize(2000, 800));
    // The table re-lays-out from a ResizeObserver, so wait for the container to
    // report the new width rather than sleeping through the resize.
    await expect.poll(() => containerWidth(page)).toBeGreaterThan(1500);

    // Assert filler header exists. The filler is committed on the render after
    // the container reports its new width, so this retries until it lands.
    await expect(page.locator('.vt-th-filler')).not.toHaveCount(0);

    // Get the container width and sum of non-filler th widths
    const widths = await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="vt-container"]',
      ) as HTMLElement;
      const containerW = container ? container.clientWidth : 0;

      const allThs = Array.from(document.querySelectorAll('th'));
      const nonFillerThs = allThs.filter(
        (th) => !th.classList.contains('vt-th-filler'),
      );
      const totalThWidth = nonFillerThs.reduce(
        (sum, th) => sum + (th as HTMLElement).offsetWidth,
        0,
      );

      const fillerTh = document.querySelector(
        '.vt-th-filler',
      ) as HTMLElement | null;
      const fillerW = fillerTh ? fillerTh.offsetWidth : 0;

      return { containerW, totalThWidth, fillerW };
    });

    // Filler width should approximately equal container - totalColumnWidth
    const expectedFiller = widths.containerW - widths.totalThWidth;
    expect(widths.fillerW).toBeGreaterThan(0);
    expect(widths.fillerW).toBeGreaterThanOrEqual(expectedFiller - 5);
    expect(widths.fillerW).toBeLessThanOrEqual(expectedFiller + 5);

    // Assert filler cells exist in data rows
    await expect(page.locator('.vt-td-filler')).not.toHaveCount(0);

    await TestHelpers.closeApp(app);
  });

  test('filler column disappears on narrow windows', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Wait for the library table to render
    await page.waitForSelector('.vt-table', { timeout: 10000 });

    // Resize window to narrow width where columns should fill/exceed container
    const browserWindow = await app.browserWindow(page);
    await browserWindow.evaluate((win) => win.setSize(800, 600));
    await expect.poll(() => containerWidth(page)).toBeLessThan(900);

    // Filler header should not exist or have 0 width
    const fillerTh = await page.locator('.vt-th-filler');
    const fillerCount = await fillerTh.count();

    if (fillerCount > 0) {
      const fillerW = await page.evaluate(() => {
        const el = document.querySelector('.vt-th-filler') as HTMLElement;
        return el ? el.offsetWidth : 0;
      });
      expect(fillerW).toBe(0);
    } else {
      expect(fillerCount).toBe(0);
    }

    await TestHelpers.closeApp(app);
  });
});
