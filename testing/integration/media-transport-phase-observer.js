/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { performance } from 'node:perf_hooks';
import { mediaTransportPhases, mediaTransportObservationLimit, mediaTransportDurationLimitMs } from './media-transport-phase-policy.js';

export const disabledMediaTransportObserver = Object.freeze({ measure: (_phase, operation) => operation(), snapshot: () => null });

/** Fixed aggregate storage with no external sinks inside a timed native command. */
export function createMediaTransportObserver({ now = () => performance.now() } = {}) {
  if (typeof now !== 'function') throw new TypeError('Invalid media transport clock');
  let observations = 0; let clipped = false;
  const rows = new Map(mediaTransportPhases.map(phase => [phase, { phase, started: 0, completed: 0, failed: 0,
    pending: 0, timed: 0, untimed: 0, totalMs: 0, minMs: null, maxMs: null }]));
  const clock = () => { try { const value = now(); return Number.isFinite(value) && value >= 0 ? value : null; } catch { return null; } };
  async function measure(phase, operation) {
    const row = rows.get(phase);
    if (!row || typeof operation !== 'function') throw new TypeError('Invalid media transport phase');
    if (observations === mediaTransportObservationLimit) { clipped = true; return operation(); }
    observations++; row.started++; row.pending++;
    const start = clock(); let failed = false;
    try { return await operation(); }
    catch (error) { failed = true; throw error; }
    finally {
      const end = clock(); const elapsed = start !== null && end !== null ? end - start : null;
      row.pending--; row[failed ? 'failed' : 'completed']++;
      if (elapsed === null || elapsed < 0 || elapsed > mediaTransportDurationLimitMs) row.untimed++;
      else {
        row.timed++; row.totalMs += elapsed;
        row.minMs = row.minMs === null ? elapsed : Math.min(row.minMs, elapsed);
        row.maxMs = row.maxMs === null ? elapsed : Math.max(row.maxMs, elapsed);
      }
    }
  }
  return Object.freeze({ measure, snapshot: () => Object.freeze({ version: 2, clipped,
    phases: Object.freeze([...rows.values()].map(row => Object.freeze({ ...row }))) }) });
}
