/**
 * Centralized IPC registration helpers.
 *
 * `registerIpcHandler` enforces the renderer↔main contract at the type
 * level: handlers must accept `IPCRequests[C]` and return
 * `Promise<IPCResponses[C]>`. Use it for every `ipcMain.handle` registration.
 *
 * `sendIpcEvent` wraps the destroyed-window guard around main→renderer push
 * events and uses the `IPCEventPayloads` map so payloads are checked against
 * the channel.
 */

import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import {
  Channels,
  IPCEventPayloads,
  IPCEvents,
  IPCRequests,
  IPCResponses,
} from '../../types/ipc';

export type IPCInvokeHandler<C extends Channels> = (
  req: IPCRequests[C],
  event: IpcMainInvokeEvent,
) => Promise<IPCResponses[C]>;

/**
 * Register a single typed `ipcMain.handle` handler.
 */
export function registerIpcHandler<C extends Channels>(
  channel: C,
  handler: IPCInvokeHandler<C>,
): void {
  ipcMain.handle(channel, async (event, args) =>
    handler(args as IPCRequests[C], event),
  );
}

/**
 * Bulk-register a record of typed handlers, e.g. the `ipcHandlers` map
 * exported from `handlers.ts`. Each entry's individual function carries
 * its own typed `IPCHandler<C>` cast at the definition site; this map
 * type accepts the loose `(args, event) => Promise<unknown>` shape so
 * per-channel handlers stay assignable without forcing union types
 * onto each handler's `args` parameter.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyIPCHandler = (args: any, event?: any) => Promise<any>;

export function registerIpcHandlers(
  handlers: Record<string, AnyIPCHandler>,
): void {
  Object.entries(handlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, async (event, args) => handler(args, event));
  });
}

/**
 * Send a typed main → renderer push event with a destroyed-window guard.
 *
 * The conditional rest argument lets callers omit the payload entirely
 * when the channel's payload is `void`:
 *   sendIpcEvent(win, 'player:playPause');             // ok (void payload)
 *   sendIpcEvent(win, 'player:seek', 42);              // ok (number payload)
 *   sendIpcEvent(win, 'player:seek');                  // type error
 */
export function sendIpcEvent<E extends IPCEvents>(
  win: BrowserWindow | null | undefined,
  event: E,
  ...payload: IPCEventPayloads[E] extends void ? [] : [IPCEventPayloads[E]]
): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(event, ...payload);
}
