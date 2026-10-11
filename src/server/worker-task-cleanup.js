/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Finish cleanup after work, preserving an original rejection including null. */
export async function withWorkerTaskCleanup(work, cleanup) {
  let result;
  let failed = false;
  let failure;
  try { result = await work(); }
  catch (error) { failed = true; failure = error; }
  try { await cleanup(); }
  catch (error) {
    if (!failed) { failed = true; failure = error; }
  }
  if (failed) throw failure;
  return result;
}
