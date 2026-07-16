import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * E2E coverage for the audio output device picker (the Speaker button in the
 * Player bar). Playwright cannot assert that audio physically rerouted to a
 * different device — that is left to manual, human-in-the-loop verification —
 * so these specs exercise everything up to that boundary: the button opens
 * the picker, the active device is marked, and selecting a device runs the
 * full chain (setSinkId -> AudioContext route -> settings cache -> settings
 * IPC persist -> success toast -> popover close -> marked on reopen).
 */

interface RenderedOption {
  testid: string;
  deviceId: string; // '' represents the System Default row
  selected: boolean;
  label: string;
}

async function readOptions(page: Page): Promise<RenderedOption[]> {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-testid^="output-device-option-"]'),
    ).map((el) => {
      const testid = el.getAttribute('data-testid') || '';
      const suffix = testid.replace('output-device-option-', '');
      return {
        testid,
        deviceId: suffix === 'default' ? '' : suffix,
        selected: el.getAttribute('data-selected') === 'true',
        label: (el.textContent || '').trim(),
      };
    }),
  );
}

async function getPersistedDeviceId(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    (window as Window & { electron?: any }).electron.settings
      .get()
      .then(
        (s: { selectedAudioOutputDeviceId: string | null }) =>
          s.selectedAudioOutputDeviceId ?? null,
      ),
  );
}

async function openPicker(page: Page): Promise<void> {
  await page.click('[data-testid="output-device-toggle"]');
  await page.waitForSelector('[data-testid="output-device-list"]', {
    timeout: 5000,
  });
}

test.describe('Audio output device picker', () => {
  test('opens from the player bar with the active device marked', async () => {
    const { app, page } = await TestHelpers.launchApp();

    const toggle = page.locator('[data-testid="output-device-toggle"]');
    await expect(toggle).toBeVisible();

    await openPicker(page);

    // buildDeviceList always guarantees a System Default row (deviceId ''),
    // and on a fresh DB the persisted device is null, so System Default is
    // the active row.
    const systemDefault = page.locator(
      '[data-testid="output-device-option-default"]',
    );
    await expect(systemDefault).toBeVisible();
    expect(await systemDefault.getAttribute('data-selected')).toBe('true');

    // Exactly one row is marked active, and it is the System Default.
    const options = await readOptions(page);
    expect(options.length).toBeGreaterThan(0);
    const active = options.filter((o) => o.selected);
    expect(active).toHaveLength(1);
    expect(active[0].deviceId).toBe('');

    await TestHelpers.takeScreenshot(page, 'audio-output-popover-open');
    await TestHelpers.closeApp(app);
  });

  test('selecting a device persists it, toasts, closes the picker, and marks it on reopen', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openPicker(page);

    const options = await readOptions(page);
    expect(options.length).toBeGreaterThan(0);

    // Prefer switching to a real, non-default device so the test exercises an
    // actual output change; fall back to the System Default row when the test
    // machine exposes only one output (e.g. a headless CI box). Either target
    // runs the full click -> setSinkId -> persist -> toast -> close chain;
    // setSinkId('') is permission-free and always resolves.
    const target = options.find((o) => o.deviceId !== '') ?? options[0];

    await page.click(`[data-testid="${target.testid}"]`);

    // Popover closes only on a successful switch (handleSelect keeps it open
    // and shows an error toast on rejection), so this doubles as proof the
    // engine confirmed the route.
    await expect(
      page.locator('[data-testid="output-device-list"]'),
    ).toBeHidden();

    // Success toast surfaces in the notification panel (which auto-expands).
    const panel = page.locator('[data-testid="notification-panel"]');
    await expect(
      panel
        .locator('[data-testid="notification-item"]')
        .filter({ hasText: 'Output set to' }),
    ).toBeVisible();

    // Persisted through settings IPC. '' (System Default) is stored as null.
    const expectedPersisted = target.deviceId === '' ? null : target.deviceId;
    await expect
      .poll(() => getPersistedDeviceId(page), { timeout: 5000 })
      .toBe(expectedPersisted);

    // Reopen: the chosen device is now the marked/active row.
    await openPicker(page);
    const reopened = page.locator(`[data-testid="${target.testid}"]`);
    await expect(reopened).toBeVisible();
    expect(await reopened.getAttribute('data-selected')).toBe('true');

    await TestHelpers.takeScreenshot(page, 'audio-output-selected');
    await TestHelpers.closeApp(app);
  });
});
