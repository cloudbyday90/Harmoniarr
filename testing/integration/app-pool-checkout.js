/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { observeFixturePoolCheckouts, resolveFixtureCheckoutMode } from './fixture-pool-checkout.js';

export async function withAppPoolCheckoutDiagnostics({ getPoolFn, phaseObserver, source,
  captureFailure, onRecord, env = process.env }, run) {
  const mode = resolveFixtureCheckoutMode(env); const owners = new Map();
  function observedGetPool() {
    const pool = getPoolFn();
    if (!owners.has(pool)) owners.set(pool, observeFixturePoolCheckouts({ pool, poolKind: 'application_pool',
      phaseObserver, source, captureFailure, mode, ...(onRecord ? { onRecord } : {}) }));
    return pool;
  }
  let failed = false; let failure; let result;
  try { result = await run(observedGetPool); } catch (error) { failed = true; failure = error; }
  for (const diagnostics of owners.values()) {
    try { await diagnostics.restore(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  if (failed) throw failure;
  return result;
}
