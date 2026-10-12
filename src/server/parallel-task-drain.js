/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Retain the first observed failure, but drain every admitted callback's returned work. */
export async function runParallelTasksAndDrain(tasks) {
  let failed = false;
  let failure;
  const pending = tasks.map(task => Promise.resolve().then(task).catch(error => {
    if (!failed) { failed = true; failure = error; }
    throw error;
  }));
  const results = await Promise.allSettled(pending);
  if (failed) throw failure;
  return results.map(result => result.value);
}
