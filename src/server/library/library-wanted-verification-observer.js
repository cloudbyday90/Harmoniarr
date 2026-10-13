/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const counterNames = ['projectionReads', 'receiptRows', 'eligibleReceipts', 'ineligibleReceipts', 'availableReceipts',
  'missingReceipts', 'mismatchedReceipts', 'refusedReceipts', 'unexpectedErrors', 'fingerprintCalls',
  'fingerprintCompleted', 'fingerprintFailures', 'hashedBytes', 'groupedReceiptRows', 'closedReceiptGroups',
  'receiptGroupingFallbacks', 'receiptGroupRefusals', 'boundedRootGroups', 'boundedRootReceiptRows',
  'sourceNoops', 'sourceTransitionAttempts'];
const phaseNames = ['reconciliation', 'initial_projection', 'recheck_projection', 'root_resolution', 'fingerprint', 'replacement', 'source_lifecycle',
  'monitoring_read', 'metadata_read', 'selections_read', 'overrides_read', 'availability_read', 'receipts_read'];
const maximum = Number.MAX_SAFE_INTEGER;
export const disabledWantedVerificationObserver = Object.freeze({ enabled: false,
  increment() {}, measure: async (_phase, operation) => operation(), finish() {} });

export function createWantedVerificationObserver({ enabled = process.env.HARMONIARR_WANTED_VERIFICATION_DIAGNOSTICS === '1',
  now = () => performance.now(), onRecord = record => process.stderr.write(`[wanted-verification] ${JSON.stringify(record)}\n`) } = {}) {
  if (enabled !== true) return disabledWantedVerificationObserver;
  const correlationId = randomUUID(); const counters = Object.fromEntries(counterNames.map(name => [name, 0]));
  const phases = Object.fromEntries(phaseNames.map(name => [name, { calls: 0, totalMs: 0, maximumMs: 0 }]));
  let finished = false; let clipped = false; let timingUnavailable = false;
  function add(value, amount) {
    if (!Number.isFinite(amount) || amount < 0) return value;
    if (value + amount > maximum) clipped = true;
    return Math.min(maximum, value + amount);
  }
  function clock() {
    try { const value = now(); if (Number.isFinite(value)) return value; } catch { /* Diagnostic clock only. */ }
    timingUnavailable = true; return null;
  }
  function increment(name, amount = 1) {
    if (!finished && Object.hasOwn(counters, name) && Number.isSafeInteger(amount) && amount >= 0) counters[name] = add(counters[name], amount);
  }
  async function measure(name, operation) {
    if (finished || !Object.hasOwn(phases, name)) return operation();
    const started = clock();
    try { return await operation(); }
    finally {
      const ended = clock(); const phase = phases[name]; phase.calls = add(phase.calls, 1);
      if (started !== null && ended !== null && ended >= started) {
        const elapsed = ended - started;
        if (elapsed > maximum) clipped = true;
        const duration = Math.min(maximum, elapsed);
        phase.totalMs = add(phase.totalMs, duration); phase.maximumMs = Math.max(phase.maximumMs, duration);
      } else timingUnavailable = true;
    }
  }
  function finish(outcome) {
    if (finished) return; finished = true;
    const record = Object.freeze({ version: 1, kind: 'wanted_verification', correlationId,
      outcome: outcome === 'completed' ? 'completed' : 'failed', clipped, timingUnavailable,
      counters: Object.freeze({ ...counters }), phases: Object.freeze(Object.fromEntries(Object.entries(phases).map(([name, phase]) =>
        [name, Object.freeze({ calls: phase.calls, totalMs: Math.min(maximum, Math.round(phase.totalMs * 1000) / 1000),
          maximumMs: Math.min(maximum, Math.round(phase.maximumMs * 1000) / 1000) })]))) });
    try { Promise.resolve(onRecord(record)).catch(() => {}); } catch { /* Telemetry never owns a domain result. */ }
  }
  return { enabled: true, increment, measure, finish };
}
