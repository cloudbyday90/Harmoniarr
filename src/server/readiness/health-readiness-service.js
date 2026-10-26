/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { classifyReadinessFailure, normalizeReadinessStage } from './readiness-diagnostic-policy.js';
import { createReadinessDiagnosticsService } from './readiness-diagnostics-service.js';
import { createWorkerTaskLifecycle } from '../worker-task-lifecycle.js';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';

/** Observe the existing health work without adding retries, races, or detached diagnostics. */
export function createHealthReadinessService({ getOverview, appPort, diagnostics = createReadinessDiagnosticsService(), nowFn = () => performance.now() } = {}) {
  async function executeCheck() {
    const started = nowFn(); let stage = 'unknown';
    try {
      const overview = await getOverview({ includeArtworkMaintenance: false, includeDependencies: false,
        onReadinessStage: value => { stage = normalizeReadinessStage(value); } });
      stage = 'response_projection';
      const startedAt = new Date(overview.service.startedAt).toISOString();
      const pendingMigrations = overview.database.pendingMigrations;
      if (!Number.isSafeInteger(pendingMigrations) || pendingMigrations < 0) throw new TypeError('Invalid health migration count');
      const body = { ok: true, service: 'harmoniarr', startedAt, appPort, pendingMigrations };
      try { diagnostics.recordSuccess({ durationMs: nowFn() - started }); } catch { /* Observation is optional. */ }
      return { statusCode: 200, body };
    } catch (error) {
      let record;
      try { record = diagnostics.recordFailure({ error, stage, durationMs: nowFn() - started }); } catch { /* Keep the original error. */ }
      const statusCode = classifyReadinessFailure(error).httpStatus;
      return { statusCode, body: { ok: false, error: { code: 'health_check_failed', message: 'Health check could not complete.', reference: record?.reference ?? null } }, failure: error };
    }
  }
  const tasks = createWorkerTaskLifecycle({ execute: executeCheck });
  let closing = false;
  function check() {
    if (closing) return Promise.resolve({ statusCode: 503, body: { ok: false, error: { code: 'health_check_failed', message: 'Health check could not complete.', reference: null } } });
    return tasks.start({ runId: Symbol('health-check') });
  }
  const close = () => { closing = true; return withWorkerTaskCleanup(tasks.close, () => diagnostics.close()); };
  return { check, diagnostics, close };
}
