/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createIntervalHeartbeatRunner } from './heartbeat/interval-heartbeat-runner.js';
import { createSchemaDiagnosticsService, unavailableSchemaDiagnostics } from './schema-diagnostics-service.js';

export const schemaMaintenanceIntervalMs = 60 * 60 * 1000;
export const schemaMaintenanceRetryMs = 5 * 60 * 1000;

/** One bounded summary, automatic maintenance ownership, and no request-triggered scan. */
export function createSchemaMaintenanceService({ diagnosticsService = createSchemaDiagnosticsService({ respectMaintenance: true }),
  intervalMs = schemaMaintenanceIntervalMs, retryMs = schemaMaintenanceRetryMs, now = Date.now,
  createRunnerFn = createIntervalHeartbeatRunner } = {}) {
  for (const value of [intervalMs, retryMs]) if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) throw new TypeError('A bounded maintenance interval is required');
  if (typeof diagnosticsService.getSchemaDiagnostics !== 'function' || typeof diagnosticsService.waitForDrain !== 'function') throw new TypeError('Owned schema diagnostics are required');
  let snapshot = unavailableSchemaDiagnostics('pending'), nextDue = 0, closed = false, sealed = false;
  let active = null, controller = null, closing;
  function getSchemaDiagnostics() {
    const stale = ['current', 'attention'].includes(snapshot.state) && now() >= nextDue;
    return structuredClone(stale ? { ...unavailableSchemaDiagnostics('stale'), checkedAt: snapshot.checkedAt } : snapshot);
  }
  async function run() {
    const startedAt = now();
    controller = new AbortController();
    snapshot = { ...unavailableSchemaDiagnostics('running'), checkedAt: snapshot.checkedAt };
    try {
      const result = await diagnosticsService.getSchemaDiagnostics({ signal: controller.signal });
      if (!closed) snapshot = result;
      nextDue = startedAt + (['current', 'attention'].includes(result.state) ? intervalMs : retryMs);
    } catch { snapshot = unavailableSchemaDiagnostics(); nextDue = startedAt + retryMs; }
    finally {
      // Result/deadline is earlier than native connection retirement.
      try { if (await diagnosticsService.waitForDrain() !== true) sealed = true; }
      catch { sealed = true; }
      if (sealed) snapshot = unavailableSchemaDiagnostics();
      controller = null;
    }
    return getSchemaDiagnostics();
  }
  const runner = createRunnerFn({ intervalMs: Math.min(intervalMs, retryMs), onTick: () => {
    if (closed || sealed || now() < nextDue) return { skipped: true };
    active = run().finally(() => { active = null; });
    return active;
  } });
  function stopAndDrain() {
    if (closing) return closing;
    closed = true; snapshot = unavailableSchemaDiagnostics(); runner.stop(); controller?.abort();
    closing = Promise.resolve(active).then(() => { if (sealed) throw new Error('Schema maintenance connection retirement is uncertain'); });
    return closing;
  }
  return { getSchemaDiagnostics, tick: runner.tick, start: () => { if (!closed) return runner.start(); }, stop: runner.stop, stopAndDrain, close: stopAndDrain };
}
