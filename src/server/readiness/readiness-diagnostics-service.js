/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';
import { classifyReadinessFailure, incrementDiagnosticCount, normalizeReadinessStage, readinessFailureLimit } from './readiness-diagnostic-policy.js';
import { createReadinessDiagnosticLogService } from './readiness-diagnostic-log-service.js';

export function createReadinessDiagnosticsService({ logService = createReadinessDiagnosticLogService(),
  nowFn = () => new Date(), referenceFn = randomUUID } = {}) {
  const failures = []; let failureCount = 0, lastCheck = null;
  function time() {
    try { const value = nowFn(); return value instanceof Date ? Date.prototype.toISOString.call(value) : null; } catch { return null; }
  }
  const duration = value => Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(value))) : 0;
  function recordSuccess({ durationMs }) { lastCheck = { outcome: 'healthy', observedAt: time(), durationMs: duration(durationMs) }; }
  function recordFailure({ error, stage, durationMs }) {
    let reference = null;
    try { const value = referenceFn(); if (typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value)) reference = value; } catch { /* Diagnostics cannot replace the failure. */ }
    const record = Object.freeze({ reference, observedAt: time(), stage: normalizeReadinessStage(stage), ...classifyReadinessFailure(error), durationMs: duration(durationMs) });
    failureCount = incrementDiagnosticCount(failureCount);
    failures.unshift(record); if (failures.length > readinessFailureLimit) failures.pop();
    lastCheck = { outcome: 'failed', ...record };
    try { logService.writeFailure(record); } catch { /* Preserve readiness outcome and original failure. */ }
    return record;
  }
  return {
    recordSuccess, recordFailure, close: () => logService.close(),
    getSnapshot: () => ({ scope: 'process', retainedLimit: readinessFailureLimit, failureCount,
      lastCheck: lastCheck ? { ...lastCheck } : null, recentFailures: failures.map(record => ({ ...record })), log: { ...logService.getState() } }),
  };
}
