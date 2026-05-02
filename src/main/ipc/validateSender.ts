/**
 * IPC sender validation helpers.
 *
 * The threat model for hihat is narrow — single user, local SQLite,
 * trusted main process — but the destructive handlers
 * (`library:resetDatabase`, `library:resetTracks`, `fileSystem:deleteFile`,
 * `app:open-in-browser`) can wipe data or shell out to arbitrary URIs.
 * If the renderer ever expands to include a webview, an embedded iframe,
 * or anything else that loads the preload, those handlers should reject
 * the call rather than serve it.
 *
 * Pattern:
 *   - On window creation, register the BrowserWindow as trusted via
 *     `trustWindow(window)`.
 *   - On window close, deregister with `untrustWindow(window)`.
 *   - In destructive handlers, call `assertTrustedSender(event)` first.
 *
 * For handlers that should only accept calls from a specific window
 * (e.g. miniPlayer requesting its own state), use
 * `assertSenderIsWindow(event, window)` instead.
 */

import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const trustedWebContentsIds = new Set<number>();

export function trustWindow(window: BrowserWindow): void {
  trustedWebContentsIds.add(window.webContents.id);
  window.on('closed', () => {
    trustedWebContentsIds.delete(window.webContents.id);
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

/**
 * Validate that a URL uses http(s). Used by `app:open-in-browser` to
 * prevent arbitrary URI schemes (file://, javascript:, custom protocols)
 * from being passed to `shell.openExternal`.
 */
export function assertHttpUrl(url: string): void {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Invalid URL: only http(s) protocols are allowed');
  }
}
