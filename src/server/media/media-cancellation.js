/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export function throwIfMediaCancelled(signal) {
  if (signal != null && !(signal instanceof AbortSignal)) throw new TypeError('Invalid media cancellation signal');
  signal?.throwIfAborted();
}

/** Drain every sibling, preserving the first observed rejection, including null. */
export async function settleMediaTasks(tasks) {
  let failed = false; let failure;
  const result = await Promise.all(tasks.map(task => Promise.resolve(task).catch(error => {
    if (!failed) { failed = true; failure = error; }
  })));
  if (failed) throw failure;
  return result;
}
