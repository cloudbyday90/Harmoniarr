/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { projectArtworkAdmissionSnapshot, projectArtworkAdmissionObservation } from '../../src/shared/artwork-admission-diagnostics.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkIngestionService } from '../../src/server/artwork/artwork-ingestion-service.js';
import { initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';
import { buildSystemRuntimeDiagnostics } from '../../src/server/system-runtime-diagnostics.js';
import { createSystemService } from '../../src/server/system-service.js';

const idle = { active: 0, queued: 0, queuedInputBytes: 0, reservedBytes: 0, budgetBytes: 2 * 1024 ** 3,
  concurrencyLimit: 2, queueLimit: 4, queuedInputLimitBytes: 32 * 1024 ** 2, queueTimeoutMs: 15_000 };
const capturedAt = '2026-10-25T16:00:00.000Z';

test('admission projection copies only fixed finite numeric facts and rejects unavailable or inconsistent state', () => {
  const value = { ...idle }; Object.defineProperty(value, 'privatePath', { get: () => assert.fail('Unlisted properties must not be read') });
  assert.deepEqual(projectArtworkAdmissionSnapshot(value), idle);
  for (const input of [null, {}, { ...idle, active: '0' }, { ...idle, queued: NaN }, { ...idle, reservedBytes: -1 },
    { ...idle, queued: 5 }, { ...idle, active: 3 }, { ...idle, queueTimeoutMs: 60_001 }, { ...idle, reservedBytes: 1 },
    { ...idle, queuedInputBytes: 1 }, { ...idle, budgetBytes: Number.MAX_SAFE_INTEGER + 1 }]) assert.equal(projectArtworkAdmissionSnapshot(input), null);
  assert.deepEqual(projectArtworkAdmissionObservation({ ...idle, capturedAt, secret: 'private' }), { ...idle, capturedAt });
  for (const stamp of [null, 'private', '2026-10-25', '2026-13-25T16:00:00.000Z']) assert.equal(projectArtworkAdmissionObservation({ ...idle, capturedAt: stamp }), null);
});

test('actual gate snapshots retain active ownership through abort and drain queued input without leaking mutable state', async () => {
  const gate = createArtworkIngestionAdmission(); const release = Promise.withResolvers();
  const controller = new AbortController(); const queuedController = new AbortController();
  const first = gate.run(async owner => { owner.onMetadata({ format: 'webp', channels: 3, depth: 'uchar', width: 1024, height: 1024, webpSelection: true }); await release.promise; }, { signal: controller.signal, inputBytes: 800 });
  const second = gate.run(() => assert.fail('Cancelled queued work must not launch'), { signal: queuedController.signal, inputBytes: 800, weight: 800 });
  const rejection = assert.rejects(second, { code: 'artwork_ingestion_cancelled' });
  assert.deepEqual(gate.getSnapshot(), { ...idle, active: 1, queued: 1, queuedInputBytes: 800, reservedBytes: initialArtworkMemoryReservation(800) });
  const snapshot = gate.getSnapshot(); snapshot.reservedBytes = 0; assert.notEqual(gate.getSnapshot().reservedBytes, 0);
  controller.abort(); assert.equal(gate.getSnapshot().active, 1); assert.equal(gate.getSnapshot().reservedBytes, initialArtworkMemoryReservation(800));
  queuedController.abort(); await rejection; assert.equal(gate.getSnapshot().queuedInputBytes, 0);
  release.resolve(); await first; assert.deepEqual(gate.getSnapshot(), idle);
});

test('runtime diagnostics separate live and cached clocks, omit unknown fields and preserve independent unavailable states', () => {
  const options = { artworkIngestionService: { getAdmissionSnapshot: () => ({ ...idle, privateUrl: 'secret' }) },
    runtimeResourceMonitor: { getRuntimeState: () => ({ latestSample: { capturedAt: '2026-10-25T15:59:00.000Z', memory: { rssBytes: 123, heapUsedBytes: 0, externalBytes: -1, arrayBuffersBytes: 12, privatePath: 'secret' } } }) }, nowFn: () => new Date(capturedAt) };
  const result = buildSystemRuntimeDiagnostics(options);
  assert.deepEqual(result.artworkAdmission, { ...idle, capturedAt });
  assert.deepEqual(result.processMemory, { capturedAt: '2026-10-25T15:59:00.000Z', rssBytes: 123, heapUsedBytes: 0, externalBytes: null, arrayBuffersBytes: 12 });
  assert.equal(buildSystemRuntimeDiagnostics({ ...options, artworkIngestionService: { getAdmissionSnapshot() { throw new Error('secret'); } } }).artworkAdmission, null);
  assert.equal(buildSystemRuntimeDiagnostics({ ...options, runtimeResourceMonitor: { getRuntimeState() { throw new Error('secret'); } } }).processMemory, null);
  assert.deepEqual(buildSystemRuntimeDiagnostics(), { artworkAdmission: null, processMemory: null });
});

test('ingestion and system diagnostics read the injected actual gate without policy, database or provider work', () => {
  let reads = 0;
  const ingestion = createArtworkIngestionService({ artworkIngestionAdmission: { getSnapshot: () => { reads++; return idle; } }, artworkPolicyService: { getArtworkRuntimePolicy: () => assert.fail('No policy read') } });
  const system = createSystemService({ artworkIngestionService: ingestion, getPoolFn: () => assert.fail('No database read'), dependencyHealthService: { getDependencyHealth: () => assert.fail('No provider check') } });
  assert.deepEqual(projectArtworkAdmissionSnapshot(system.getRuntimeDiagnostics().artworkAdmission), idle); assert.equal(reads, 1);
});
