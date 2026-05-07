/**
 * IPC sender validation helpers.
 *
 * Hihat's threat model is narrow (single user, local SQLite, two known
 * BrowserWindows, no webviews / iframes), but the destructive handlers
 * — `library:resetDatabase`, `library:resetTracks`,
 * `fileSystem:deleteFile`, `app:open-in-browser` — can still wipe data
 * or shell out to arbitrary URIs if a stray frame ever talks to them.
 *
 * Pattern: register windows with `trustWindow()` at creation; gate
 * destructive handlers with `assertTrustedSender(event)` (any trusted
 * window) or `assertSenderIsWindow(event, win)` (a specific window).
 *
 * Lines up with Electron's official IPC-security guidance with two
 * intentional divergences:
 *
 *   1. ID allowlist instead of `event.senderFrame.url` validation.
 *      Tighter for our shape — only windows we explicitly register can
 *      talk to privileged APIs, regardless of what URL they load.
 *      Caveat: `event.sender.id` is the top-level webContents id, so
 *      an iframe nested inside a trusted window would inherit access.
 *      We have no iframes today; if any are added, revisit this file.
 *
 *   2. No runtime arg validation across the board (no zod). TS at the
 *      boundary is sufficient for the trusted-renderer threat model.
 *      The exception is destructive handlers: arg shape that names an
 *      external resource (filesystem path, URL) is validated inline at
 *      the call site (see `assertHttpUrl`, and the libraryPath-prefix
 *      check in the `fileSystem:deleteFile` handler).
 */

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const trustedWebContentsIds = new Set<number>();

export function trustWindow(window: BrowserWindow): void {
  // Capture the id eagerly: `window.webContents` is gone by the time
  // the `closed` handler runs and reading it would throw at app exit.
  const { id } = window.webContents;
  trustedWebContentsIds.add(id);
  window.on('closed', () => {
    trustedWebContentsIds.delete(id);
  });
}

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!trustedWebContentsIds.has(event.sender.id)) {
    throw new Error(
      `Unauthorized IPC sender (webContents id ${event.sender.id})`,
    );
  }
}

export function assertSenderIsWindow(
  event: IpcMainInvokeEvent,
  window: BrowserWindow | null,
): void {
  if (!window || event.sender !== window.webContents) {
    throw new Error('Unauthorized IPC sender for this channel');
  }
}

/** Reject non-http(s) URI schemes (file://, javascript:, custom). */
export function assertHttpUrl(url: string): void {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Invalid URL: only http(s) protocols are allowed');
  }
}
