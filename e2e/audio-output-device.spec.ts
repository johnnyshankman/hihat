import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Audio output picker. Physical rerouting can't be asserted here; that's a
 * manual check.
 */

interface RenderedOption {
  testid: string;
  deviceId: string; // '' = System Default
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

    // Fresh DB: System Default is active.
    const systemDefault = page.locator(
      '[data-testid="output-device-option-default"]',
    );
    await expect(systemDefault).toBeVisible();
    expect(await systemDefault.getAttribute('data-selected')).toBe('true');

    const options = await readOptions(page);
    expect(options.length).toBeGreaterThan(0);
    const active = options.filter((o) => o.selected);
    expect(active).toHaveLength(1);
    expect(active[0].deviceId).toBe('');

    await TestHelpers.takeScreenshot(page, 'audio-output-popover-open');
    await TestHelpers.closeApp(app);
  });

  test('session permissions expose output devices and deny everything else', async () => {
    const { app, page } = await TestHelpers.launchApp();

    const result = await page.evaluate(async () => {
      const outputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === 'audiooutput',
      );
      let micCapture = 'granted';
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (error) {
        micCapture = (error as Error).name;
      }
      return {
        outputs: outputs.map((d) => ({ id: d.deviceId, label: d.label })),
        notifications: await Notification.requestPermission(),
        micCapture,
      };
    });

    // Denied `media` check → one blank entry.
    result.outputs.forEach((d) => {
      expect(d.id).not.toBe('');
      expect(d.label).not.toBe('');
    });
    expect(result.notifications).toBe('denied');
    expect(result.micCapture).toBe('NotAllowedError');

    await TestHelpers.closeApp(app);
  });

  test('selecting a device persists it, toasts, closes the picker, and marks it on reopen', async () => {
    const { app, page } = await TestHelpers.launchApp();

    await openPicker(page);

    const options = await readOptions(page);
    expect(options.length).toBeGreaterThan(0);

    // Prefer a real device; fall back to System Default on single-output CI.
    const target = options.find((o) => o.deviceId !== '') ?? options[0];

    await page.click(`[data-testid="${target.testid}"]`);

    // Popover only closes on success.
    await expect(
      page.locator('[data-testid="output-device-list"]'),
    ).toBeHidden();

    const panel = page.locator('[data-testid="notification-panel"]');
    await expect(
      panel
        .locator('[data-testid="notification-item"]')
        .filter({ hasText: 'Output set to' }),
    ).toBeVisible();

    // System Default persists as null.
    const expectedPersisted = target.deviceId === '' ? null : target.deviceId;
    await expect
      .poll(() => getPersistedDeviceId(page), { timeout: 5000 })
      .toBe(expectedPersisted);

    await openPicker(page);
    const reopened = page.locator(`[data-testid="${target.testid}"]`);
    await expect(reopened).toBeVisible();
    expect(await reopened.getAttribute('data-selected')).toBe('true');

    await TestHelpers.takeScreenshot(page, 'audio-output-selected');
    await TestHelpers.closeApp(app);
  });
});
