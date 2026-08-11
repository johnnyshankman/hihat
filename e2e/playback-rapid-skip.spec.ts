import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/** Fire N clicks at a transport button in one synchronous burst. */
async function burstClick(page: Page, testId: string, times: number) {
  await page.evaluate(
    ({ id, count }) => {
      const btn = document.querySelector(`[data-testid="${id}"]`);
      if (!btn) return;
      for (let i = 0; i < count; i += 1) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    },
    { id: testId, count: times },
  );
}

/**
 * Assert the elapsed readout moves. Polls the player's own clock rather than
 * sleeping a fixed few seconds — it returns on the first tick that differs.
 */
async function expectElapsedToAdvance(page: Page) {
  const elapsed = page.locator('[data-testid="player-elapsed-time"]');
  const before = (await elapsed.textContent())?.trim() ?? '';
  await expect
    .poll(async () => (await elapsed.textContent())?.trim() ?? '', {
      timeout: 15000,
    })
    .not.toBe(before);
}

test.describe('Rapid Skip Bug Regression', () => {
  // The optimistic-next/prev feature (issue #72) requires that rapid clicks
  // never get dropped. If a user clicks next 10 times quickly, they must land
  // 10 songs forward — not 1 or 2.
  test('rapid next x10 lands on the song 10 positions forward', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Read the title of the song we expect to land on (start + 10 = index 10).
    const expectedLandingTitle = await page
      .locator('[data-track-id]')
      .nth(10)
      .locator('td')
      .first()
      .textContent();

    // Double-click the first track to start playback.
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').first(),
    );

    // Fire 10 rapid clicks via DOM dispatching — tight synchronous loop so
    // no React state update can settle between them.
    await burstClick(page, 'skip-next-button', 10);

    // Assert the player's now-playing title matches the expected landing
    // track. Using a scoped locator (not pageContent) avoids false positives
    // from the track list, which also renders the same title.
    await expect(
      page.locator('[data-testid="now-playing-title"]'),
    ).toContainText(expectedLandingTitle!.trim());

    // And that audio is actively advancing (not stuck at 0:00).
    await TestHelpers.waitForPlaying(page);

    await TestHelpers.closeApp(app);
  });

  test('rapid previous x5 lands on the song 5 positions back', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Expected landing: start from track index 10, go back 5 = index 5.
    const expectedLandingTitle = await page
      .locator('[data-track-id]')
      .nth(5)
      .locator('td')
      .first()
      .textContent();

    // Start on the 11th track (index 10).
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').nth(10),
    );

    // Fire 5 rapid prev clicks. Each one should walk back one index since
    // position has just reset to 0 on each skip (position > 3 restart only
    // applies on the very first click, and since we just started, position
    // is ~0 anyway so every click walks back).
    await burstClick(page, 'skip-previous-button', 5);

    await expect(
      page.locator('[data-testid="now-playing-title"]'),
    ).toContainText(expectedLandingTitle!.trim());
    await TestHelpers.waitForPlaying(page);

    await TestHelpers.closeApp(app);
  });

  test('rapid next clicks while playing — playback state stays in sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Double-click the first track to start playback
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').first(),
    );

    // Fire 5 rapid clicks via DOM dispatching (no await between clicks)
    await burstClick(page, 'skip-next-button', 5);

    // Settling signal: the 5th track ahead becomes the playing row.
    await expect(page.locator('[data-track-id]').nth(5)).toHaveClass(
      /vt-row-playing/,
    );

    // The player UI should show PauseIcon (meaning it's playing)
    await TestHelpers.waitForPlaying(page);

    // And the audio clock should actually be moving.
    await expectElapsedToAdvance(page);

    await TestHelpers.closeApp(app);
  });

  test('rapid previous clicks while playing — playback state stays in sync', async () => {
    const { app, page } = await TestHelpers.launchApp();

    // Start on the 6th track so we have room to go back
    await TestHelpers.startPlayback(
      page,
      page.locator('[data-track-id]').nth(5),
    );

    // Fire 5 rapid clicks via DOM dispatching (no await between clicks)
    await burstClick(page, 'skip-previous-button', 5);

    // Settling signal: 5 back from index 5 is the first row.
    await expect(page.locator('[data-track-id]').first()).toHaveClass(
      /vt-row-playing/,
    );

    // Should still show playing state
    await TestHelpers.waitForPlaying(page);

    // Verify audio is actually advancing
    await expectElapsedToAdvance(page);

    await TestHelpers.closeApp(app);
  });
});
