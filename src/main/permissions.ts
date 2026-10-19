/**
 * Deny-by-default session permissions (Electron security checklist #5).
 *
 * Allowed, for the output-device picker only:
 *   - check `media` (audio): real ids/labels from enumerateDevices(),
 *     non-default setSinkId(). Never starts capture or prompts.
 *   - request `speaker-selection`: selectAudioOutput().
 *
 * Only for trusted windows, app origin, main frame.
 */

import type { Session, WebContents } from 'electron';
import { isTrustedWebContents } from './ipc/validateSender';
import { resolveHtmlPath } from './util';

const ALLOWED_PERMISSION_REQUESTS: ReadonlySet<string> = new Set([
  'speaker-selection',
]);

/** App origin: `file://` in prod/test, dev server in dev. */
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

  // No HID / serial / USB.
  session.setDevicePermissionHandler(() => false);
}
