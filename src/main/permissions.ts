/**
 * Session permission handlers.
 *
 * Without explicit handlers Electron grants every permission check and
 * request (camera, mic, geolocation, notifications, HID/USB/serial, ...).
 * Electron's security checklist recommends denying by default and
 * allowlisting only what the app actually uses:
 * https://www.electronjs.org/docs/latest/tutorial/security#5-handle-session-permission-requests-from-remote-content
 *
 * hihat only needs audio *output* routing for the Player's output-device
 * picker:
 *
 *   - Check `media` (audio): Chromium consults this synchronously before
 *     `enumerateDevices()` exposes real device ids / labels and before
 *     `setSinkId()` accepts a non-default device. Denying it degrades the
 *     picker to an unlabeled "System Default" only. A check never starts
 *     capture or triggers the macOS microphone prompt.
 *   - Request `speaker-selection`: backs `selectAudioOutput()`.
 *
 * `media` *requests* (getUserMedia capture) stay denied: hihat never
 * records audio or video.
 *
 * Grants are further limited to our own trusted windows (see
 * `validateSender.ts`), loaded from the app's own origin, in the main
 * frame.
 */

import type { Session, WebContents } from 'electron';
import { isTrustedWebContents } from './ipc/validateSender';
import { resolveHtmlPath } from './util';

const ALLOWED_PERMISSION_REQUESTS: ReadonlySet<string> = new Set([
  'speaker-selection',
]);

/**
 * True when `url` belongs to the bundled renderer: `file://` in
 * production / test, the webpack dev server origin in development.
 */
function isAppUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const target = new URL(url);
    const app = new URL(resolveHtmlPath('index.html'));
    if (app.protocol === 'file:') return target.protocol === 'file:';
    return target.origin === app.origin;
  } catch {
    return false;
  }
}

function isTrustedAppFrame(
  webContents: WebContents | null,
  requestingUrl: string | undefined,
  isMainFrame: boolean,
): boolean {
  return (
    webContents !== null &&
    isTrustedWebContents(webContents) &&
    isMainFrame &&
    isAppUrl(requestingUrl)
  );
}

export default function registerPermissionHandlers(session: Session): void {
  session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      if (permission !== 'media' || details.mediaType !== 'audio') {
        return false;
      }
      return isTrustedAppFrame(
        webContents,
        details.requestingUrl ?? requestingOrigin,
        details.isMainFrame,
      );
    },
  );

  session.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      callback(
        ALLOWED_PERMISSION_REQUESTS.has(permission) &&
          isTrustedAppFrame(
            webContents,
            details.requestingUrl,
            details.isMainFrame,
          ),
      );
    },
  );

  // HID / serial / USB: no device access, regardless of origin.
  session.setDevicePermissionHandler(() => false);
}
