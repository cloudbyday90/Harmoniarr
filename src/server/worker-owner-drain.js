/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Snapshot concrete owners, drain in order and retain the first failure including null. */
export async function drainWorkerOwners(owners) {
  const captured = [...owners];
  let failed = false;
  let failure;
  for (const owner of captured) {
    try { await owner?.close?.(); }
    catch (error) {
      if (!failed) { failed = true; failure = error; }
    }
  }
  if (failed) throw failure;
}
