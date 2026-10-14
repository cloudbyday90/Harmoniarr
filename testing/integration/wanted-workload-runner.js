/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createEarlyFailureRecord } from '../reporters/early-failure-format.js';
import { wantedWorkloadExpectedKeys, wantedWorkloadSampleKey } from './wanted-workload-command-policy.js';
import { readCheckoutProperty as read } from './pool-checkout-record.js';
import { captureWantedSeedRecord } from './wanted-seed-observer.js';
import { captureMediaTransportSummary } from './media-transport-phase-policy.js';

function captureCheckpoint(input) {
  const stage = read(input, 'stage'); const mediaProfile = read(input, 'mediaProfile');
  const bindings = read(input, 'bindings'); const pair = read(input, 'pair'); const mode = read(input, 'mode');
  if (!['server_start', 'scenario_start', 'seed', 'profile_client', 'sample', 'comparison', 'scenario_cleanup', 'server_cleanup'].includes(stage)) return null;
  return Object.freeze({ stage, mediaProfile: ['sine', 'noise'].includes(mediaProfile) ? mediaProfile : null,
    bindings: [2, 4, 8].includes(bindings) ? bindings : null, pair: [0, 1].includes(pair) ? pair : null,
    mode: ['compatibility', 'locked-noop', 'member', 'bounded'].includes(mode) ? mode : null });
}

/** Measure already-guarded summaries; retain the original failure privately. */
export async function runWantedWorkloadMeasurement({ selection, measure, signal,
  onProgress = () => {}, now = () => performance.now(), projectRoot = process.cwd() }) {
  const samples = []; const remaining = wantedWorkloadExpectedKeys(selection);
  const seedPhases = []; let seedPhasesClipped = false;
  const mediaTransports = []; let mediaTransportsClipped = false;
  const started = now(); let failed = false; let error; let lastCheckpoint = null;
  try {
    signal?.throwIfAborted();
    await measure({ ...selection.options, signal, onProgress,
      onMediaTransport: row => {
        if (!selection.options.mediaDiagnostics) return;
        const record = captureMediaTransportSummary(row);
        if (!record) return;
        if (mediaTransports.length === 12) { mediaTransports.shift(); mediaTransportsClipped = true; }
        mediaTransports.push(record);
      },
      onCheckpoint: row => { lastCheckpoint = captureCheckpoint(row) ?? lastCheckpoint; },
      onSeedRecord: row => {
        const record = captureWantedSeedRecord(row);
        if (!record) return;
        const mediaProfile = read(row, 'mediaProfile'); const bindings = read(row, 'bindings'); const pair = read(row, 'pair');
        if (seedPhases.length === 256) { seedPhases.shift(); seedPhasesClipped = true; }
        seedPhases.push({ ...record, mediaProfile: ['sine', 'noise'].includes(mediaProfile) ? mediaProfile : null,
          bindings: [2, 4, 8].includes(bindings) ? bindings : null, pair: [0, 1].includes(pair) ? pair : null });
      },
      onSample: row => {
        assert.ok(remaining.delete(wantedWorkloadSampleKey(selection, row)), 'Unexpected or duplicate workload sample');
        samples.push(row);
      } });
    signal?.throwIfAborted();
    assert.equal(remaining.size, 0, 'Workload returned before all selected samples completed');
  } catch (failure) { failed = true; error = failure; }
  const elapsed = now() - started;
  const report = { version: 2, kind: selection.kind, completed: !failed, node: process.version,
    plan: selection.plan, measurementMs: Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null,
    lastCheckpoint,
    seedPhases, seedPhasesClipped, mediaTransports, mediaTransportsClipped,
    failure: failed ? createEarlyFailureRecord({ type: 'test:fail', data: { details: { error: { cause: error } } } }, { projectRoot }) : null,
    samples };
  return { failed, error, report };
}
