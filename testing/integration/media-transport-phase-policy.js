/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { readCheckoutProperty as read } from './pool-checkout-record.js';

export const mediaTransportPhases = Object.freeze(['image_inspect', 'owner_create', 'start_inspect', 'owner_start',
  'command_inspect_before', 'command_exec', 'command_inspect_after', 'retire_inspect_before', 'owner_stop',
  'retire_inspect_after', 'remove_inspect_before', 'owner_remove']);
export const mediaTransportObservationLimit = 10_000;
export const mediaTransportDurationLimitMs = 86_400_000;
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= mediaTransportObservationLimit;
const duration = value => value === null || (Number.isFinite(value) && value >= 0 && value <= mediaTransportDurationLimitMs);
const array = value => { try { return Array.isArray(value); } catch { return false; } };

/** Read each approved property once; arbitrary diagnostics never enter public reports. */
export function captureMediaTransportSnapshot(input) {
  const version = read(input, 'version'); const clipped = read(input, 'clipped'); const phases = read(input, 'phases');
  if (version !== 1 || typeof clipped !== 'boolean' || !array(phases) || read(phases, 'length') !== mediaTransportPhases.length) return null;
  const rows = [];
  for (let i = 0; i < mediaTransportPhases.length; i++) {
    const row = read(phases, i); const phase = read(row, 'phase');
    const started = read(row, 'started'); const completed = read(row, 'completed'); const failed = read(row, 'failed');
    const pending = read(row, 'pending'); const timed = read(row, 'timed'); const untimed = read(row, 'untimed');
    const totalMs = read(row, 'totalMs'); const minMs = read(row, 'minMs'); const maxMs = read(row, 'maxMs');
    if (phase !== mediaTransportPhases[i] || ![started, completed, failed, pending, timed, untimed].every(count)
      || started !== completed + failed + pending || timed + untimed !== completed + failed
      || !Number.isFinite(totalMs) || totalMs < 0 || totalMs > mediaTransportDurationLimitMs * mediaTransportObservationLimit
      || !duration(minMs) || !duration(maxMs) || (timed === 0 ? totalMs !== 0 || minMs !== null || maxMs !== null
        : minMs === null || maxMs === null || minMs > maxMs || totalMs < maxMs)) return null;
    rows.push(Object.freeze({ phase, started, completed, failed, pending, timed, untimed, totalMs, minMs, maxMs }));
  }
  if (rows.reduce((sum, row) => sum + row.started, 0) > mediaTransportObservationLimit) return null;
  return Object.freeze({ version, clipped, phases: Object.freeze(rows) });
}

export function captureMediaTransportSummary(input) {
  const mediaProfile = read(input, 'mediaProfile'); const bindings = read(input, 'bindings'); const pair = read(input, 'pair');
  const backend = read(input, 'backend'); const ownerCleanupSafe = read(input, 'ownerCleanupSafe');
  const raw = read(input, 'snapshot');
  if (!['sine', 'noise'].includes(mediaProfile) || ![2, 4, 8].includes(bindings) || ![0, 1].includes(pair)) return null;
  const snapshot = backend === 'docker_cli' ? captureMediaTransportSnapshot(raw) : null;
  if (backend === 'docker_cli' ? !snapshot || typeof ownerCleanupSafe !== 'boolean'
    : backend !== 'local_tools' || raw !== null || ownerCleanupSafe !== null) return null;
  return Object.freeze({ mediaProfile, bindings, pair, backend, ownerCleanupSafe, snapshot });
}
