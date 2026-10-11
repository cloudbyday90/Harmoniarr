/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Best-effort outcomes still own their returned work until it actually settles. */
export function createWorkerAdvisoryTasks() {
  const active = new Set();
  let closing;
  function schedule(callback, input) {
    if (closing) throw new Error('Advisory task admission is closed');
    const pending = Promise.resolve().then(() => callback(input)).catch(() => {});
    active.add(pending);
    void pending.then(() => { active.delete(pending); });
    return pending;
  }
  function close() {
    if (!closing) closing = Promise.all([...active]).then(() => {});
    return closing;
  }
  return { schedule, close };
}
