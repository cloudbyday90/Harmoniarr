/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

/** Observe stop input during setup as well as after readiness, without buffering commands. */
export function createManualSessionInput({ input = stdin, output = stdout, signals = process } = {}) {
  const controller = new AbortController();
  const stopped = Promise.withResolvers();
  const reason = Object.assign(new Error('Manual history session stopped.'), { code: 'manual_history_stopped' });
  const reader = createInterface({ input, output, terminal: input.isTTY === true });
  let handler = null; let disposed = false;
  function stop() {
    if (disposed || controller.signal.aborted) return;
    controller.abort(reason); stopped.resolve(); reader.close();
  }
  function line(value) {
    // close() can leave already-buffered line events; stop admission explicitly.
    if (disposed || controller.signal.aborted) return;
    const command = value.trim();
    if (!command) return;
    if (command === 'quit') { stop(); return; }
    if (!handler) { output.write('Session is starting. Use quit to cancel.\n'); return; }
    try { output.write(`${JSON.stringify(handler(command))}\n`); }
    catch (error) { output.write(`${error instanceof Error ? error.message : 'Manual command failed.'}\n`); }
  }
  reader.on('line', line); reader.on('close', stop); reader.on('SIGINT', stop);
  signals.on('SIGINT', stop); signals.on('SIGTERM', stop);
  if (input.readableEnded || input.destroyed) stop();
  return {
    signal: controller.signal, stopped: stopped.promise,
    acceptCommands(callback) {
      if (typeof callback !== 'function') throw new TypeError('Manual input requires a command handler.');
      if (disposed || controller.signal.aborted) return false;
      handler = callback; return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; handler = null;
      reader.removeListener('line', line); reader.removeListener('close', stop); reader.removeListener('SIGINT', stop);
      signals.removeListener('SIGINT', stop); signals.removeListener('SIGTERM', stop); reader.close();
      stopped.resolve();
    },
  };
}
