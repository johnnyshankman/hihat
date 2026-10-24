import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/** True when the topmost element at the button's center is inside the drawer. */
async function drawerReceivesClickAt(page: Page, buttonName: string) {
  const box = await page
    .getByRole('button', { name: buttonName, includeHidden: true })
    .first()
    .boundingBox();
  expect(box).not.toBeNull();
  return page.evaluate(
    ({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      return !!hit?.closest('[data-testid="settings-view"]');
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
  );
}

/** Resolve once the drawer's slide-in (and any other transition) is done. */
async function settleTransitions(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

test.describe('Settings drawer', () => {
  test('is a compact width', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await TestHelpers.navigateToView(page, 'settings');
      const paper = page.locator('.MuiDrawer-paper', {
        has: page.getByTestId('settings-view'),
      });
      const box = await paper.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(380);
      await settleTransitions(page);
      await TestHelpers.takeScreenshot(page, 'settings-drawer-width');

      await page.getByTestId('settings-view').evaluate((el) => {
        // eslint-disable-next-line no-param-reassign
        el.scrollTop = el.scrollHeight / 2;
      });
      await TestHelpers.takeScreenshot(page, 'settings-drawer-width-mid');
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('native file pickers are attached to the window', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await TestHelpers.navigateToView(page, 'settings');
      // Canceled pickers: we only care how they were opened.
      await TestHelpers.stubOpenDialog(app, null);

      await page.getByRole('button', { name: 'Add Songs' }).click();
      await expect
        .poll(() => TestHelpers.openDialogCalls(app))
        .toEqual([{ hasParentWindow: true }]);

      await page
        .getByTestId('settings-view')
        .locator('.MuiInputAdornment-root button')
        .first()
        .click();
      await expect
        .poll(() => TestHelpers.openDialogCalls(app))
        .toEqual([{ hasParentWindow: true }, { hasParentWindow: true }]);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });

  test('is blocked while a dialog is open over it', async () => {
    const { app, page } = await TestHelpers.launchApp();

    try {
      await TestHelpers.navigateToView(page, 'settings');
      await settleTransitions(page);
      expect(await drawerReceivesClickAt(page, 'Add Songs')).toBe(true);

      await page.getByRole('button', { name: 'Reset Database' }).click();
      const dialog = page.getByRole('dialog', { name: 'Reset hihat' });
      await expect(dialog).toBeVisible();

      // Pointer: the dialog's backdrop sits over the drawer's controls,
      // including the on-screen button that opened it.
      expect(await drawerReceivesClickAt(page, 'Reset Database')).toBe(false);
      // Keyboard: focus stays trapped in the dialog.
      const focusInDialog: boolean[] = [];
      for (let i = 0; i < 6; i += 1) {
        // Sequential by design: each Tab depends on the previous focus.
        // eslint-disable-next-line no-await-in-loop
        await page.keyboard.press('Tab');
        // eslint-disable-next-line no-await-in-loop
        const inDialog = await page.evaluate(
          () => !!document.activeElement?.closest('[role="dialog"]'),
        );
        focusInDialog.push(inDialog);
      }
      expect(focusInDialog.every(Boolean)).toBe(true);
      await settleTransitions(page);
      await TestHelpers.takeScreenshot(page, 'settings-drawer-dialog');

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      expect(await drawerReceivesClickAt(page, 'Reset Database')).toBe(true);
    } finally {
      await TestHelpers.closeApp(app);
    }
  });
});
