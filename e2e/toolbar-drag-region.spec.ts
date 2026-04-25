/* eslint-disable no-console, no-await-in-loop */
import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Regression tests for issue #85.
 *
 * Chromium computes -webkit-app-region rectangles from each marked element's
 * layout/bounding rect — not the visually-clipped paint rect. When a child
 * with `no-drag` lives inside a scrollable container and scrolls out of view
 * upward, its bounding rect goes negative-y and can land inside a sibling's
 * `drag` rect (here, the .vt-toolbar above the Browser panel), punching a
 * hole in the window-drag region.
 *
 * Repro requires the Browser panel open AND the artist column scrolled past
 * its top.
 */
test.describe('Toolbar drag region (issue #85)', () => {
  test('scrolled Browser column does not punch holes in toolbar drag region', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // Open Browser panel
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="browser-panel"]')).toBeVisible();

    // Scroll the artist column well past the top so multiple items have
    // negative-y bounding rects.
    await page
      .locator('[data-testid="browser-artist-column"]')
      .evaluate((el) => {
        // 400px = 20 items at 20px/row — comfortably past the toolbar height
        // and past where the bug manifests in real use.
        (el as HTMLElement).scrollTop = 400;
      });
    await page.waitForTimeout(150);

    await TestHelpers.takeScreenshot(
      page,
      'toolbar-drag-region-browser-scrolled',
    );

    // Reproduce Chromium's drag-region calculation: collect every non-toolbar
    // element with computed `-webkit-app-region: no-drag` and look for any
    // whose bounding rect overlaps the toolbar's rect. Any overlap is a hole
    // punched in the toolbar's drag area.
    const violations = await page.evaluate(() => {
      const toolbar = document.querySelector('.vt-toolbar') as HTMLElement;
      if (!toolbar) return [{ reason: 'no .vt-toolbar found' }];
      const tb = toolbar.getBoundingClientRect();

      const out: Array<{
        tag: string;
        cls: string;
        role: string | null;
        testId: string | null;
        rect: {
          top: number;
          bottom: number;
          left: number;
          right: number;
        };
      }> = [];

      const all = document.querySelectorAll<HTMLElement>('*');
      all.forEach((el) => {
        if (toolbar.contains(el)) return; // legitimate no-drag inside toolbar
        const region = getComputedStyle(el)
          .getPropertyValue('-webkit-app-region')
          .trim();
        if (region !== 'no-drag') return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const horiz = r.left < tb.right && r.right > tb.left;
        const vert = r.top < tb.bottom && r.bottom > tb.top;
        if (horiz && vert) {
          out.push({
            tag: el.tagName,
            cls: el.className,
            role: el.getAttribute('role'),
            testId: el.getAttribute('data-testid'),
            rect: {
              top: r.top,
              bottom: r.bottom,
              left: r.left,
              right: r.right,
            },
          });
        }
      });

      return out;
    });

    if (violations.length > 0) {
      console.error(
        'no-drag rects overlapping .vt-toolbar (drag holes):',
        JSON.stringify(violations, null, 2),
      );
    }
    expect(violations).toEqual([]);

    await TestHelpers.closeApp(app);
  });

  test('toolbar itself remains a drag region with non-zero area', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await page.waitForTimeout(3000);
    await page.waitForSelector('[data-track-id]', { timeout: 10000 });

    // With Browser open AND scrolled — same conditions as the bug.
    await page.locator('[data-testid="browser-toggle"]').click();
    await page.waitForTimeout(500);
    await page
      .locator('[data-testid="browser-artist-column"]')
      .evaluate((el) => {
        (el as HTMLElement).scrollTop = 400;
      });
    await page.waitForTimeout(150);

    const toolbarInfo = await page.evaluate(() => {
      const tb = document.querySelector('.vt-toolbar') as HTMLElement;
      if (!tb) return null;
      const r = tb.getBoundingClientRect();
      return {
        region: getComputedStyle(tb)
          .getPropertyValue('-webkit-app-region')
          .trim(),
        width: r.width,
        height: r.height,
      };
    });

    expect(toolbarInfo).not.toBeNull();
    expect(toolbarInfo!.region).toBe('drag');
    expect(toolbarInfo!.width).toBeGreaterThan(0);
    expect(toolbarInfo!.height).toBeGreaterThan(0);

    await TestHelpers.closeApp(app);
  });
});
