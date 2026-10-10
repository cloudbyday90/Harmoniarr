/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createArtworkCleanupWorker } from '../../src/server/artwork/artwork-cleanup-worker.js';
import { createOperatorNotificationFanoutWorker } from '../../src/server/operator-notification-fanout-worker.js';
import { createMetadataArtistRefreshWorker } from '../../src/server/metadata/metadata-artist-refresh-worker.js';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';
import { createLibraryExternalIntakeWorker } from '../../src/server/library/library-external-intake-worker.js';
import { createLibraryExternalRequestDiscoveryWorker } from '../../src/server/library/library-external-request-discovery-worker.js';
import { createLibraryProviderIngestExecutionWorker } from '../../src/server/library/library-provider-ingest-execution-worker.js';
import { createLibraryOrganizeApplyWorker } from '../../src/server/library/library-organize-apply-worker.js';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';

const families = [
  { name: 'artwork cleanup', jobType: 'artwork_cleanup', factory: createArtworkCleanupWorker,
    domain: (work) => ({ artworkCleanupService: { cleanupUnassignedArtwork: work } }), result: {} },
  { name: 'notification fanout', jobType: 'operator_notification_fanout', factory: createOperatorNotificationFanoutWorker,
    domain: (work) => ({ fanOutOperatorNotifications: work }), result: {} },
  { name: 'artist refresh', jobType: 'metadata_artist_refresh', factory: createMetadataArtistRefreshWorker,
    domain: (work) => ({ refreshMetadataArtist: work }), result: { refreshedAt: '2026-10-09T00:00:00.000Z', releaseGroupCount: 1 } },
  { name: 'artist reconciliation', jobType: 'operator_artist_reconciliation', factory: createOperatorArtistReconciliationWorker,
    domain: (work) => ({ executeOperatorArtistReconciliation: work }), result: {} },
  { name: 'library discovery', jobType: 'library_discovery_dispatch', factory: createLibraryDiscoveryWorker,
    domain: (work) => ({ dispatchDiscoveryRequests: work }), result: { results: [] } },
  { name: 'external intake', jobType: 'library_external_intake_planning', factory: createLibraryExternalIntakeWorker,
    domain: (work) => ({ planExternalMediaRequest: work }), result: { normalizedSource: {}, providerIngestRequests: [] } },
  { name: 'external discovery', jobType: 'library_external_request_discovery', factory: createLibraryExternalRequestDiscoveryWorker,
    domain: (work) => ({ discoverExternalRequestRelease: work }), result: { candidateCount: 1 } },
  { name: 'provider ingest', jobType: 'library_external_intake_execution', factory: createLibraryProviderIngestExecutionWorker,
    domain: (work) => ({ executeProviderIngestRequests: work }), result: { executedCount: 1, failedCount: 0 } },
  { name: 'library organize', jobType: 'library_organize_apply', factory: createLibraryOrganizeApplyWorker,
    domain: (work) => ({ buildLibraryOrganizePreview: work }), result: { files: [{ fileId: 'file', currentPath: '/virtual/source.flac',
      proposedPath: '/virtual/destination.flac', libraryRootPath: '/virtual', status: { code: 'rename_required' } }], counts: { totalFiles: 1 } } },
  { name: 'library scan', jobType: 'library_scan', factory: createLibraryScanWorker,
    domain: (work) => ({ executeScan: work }), result: { libraryRoot: '/virtual' } },
];
const settle = () => new Promise((done) => { setImmediate(done); });
function fixture(t, family, overrides = {}) {
  const lease = Object.freeze(createOperationRunLeaseFixture({ runId: 'run', jobType: family.jobType }));
  const work = t.mock.fn(async () => family.result); const callbacks = {};
  for (const name of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunCancelled', 'markRunPaused', 'releaseLease']) {
    callbacks[name] = t.mock.fn(async () => true);
  }
  const heartbeat = { start: t.mock.fn(), stop: t.mock.fn() };
  const heartbeatFactory = t.mock.fn(() => heartbeat);
  const notify = t.mock.fn(async () => {});
  const options = { acquireLease: t.mock.fn(async () => lease), renewLease: async () => lease,
    createOperationRunLeaseHeartbeatFn: heartbeatFactory, isCancellationRequested: async () => false,
    pruneOldRuns: t.mock.fn(async () => {}), recordArtistRefreshCompleted: async () => ({}),
    createExclusiveFileMutationPlan: (value) => value, applyOrganizeMutation: async () => ({ transport: 'copy_then_remove', sourceRemoved: true,
      verification: { destinationExists: true, sourceSizeBytes: 1, destinationSizeBytes: 1, sourceRemoved: true, sourceExistsAfterSuccess: false } }),
    onReleaseAddedFn: notify,
    recordLibraryScanCatalogue: async () => ({ files: [], observedFileCount: 0 }),
    ...callbacks, ...family.domain(work), ...overrides };
  const worker = family.factory(options);
  return { callbacks, heartbeatFactory, lease, notify, options, work,
    async run() { await worker.startWorkerRun({ runId: 'run', libraryRoot: '/virtual' }); await settle(); } };
}
function verifyCapturedCalls(value) {
  for (const callback of Object.values(value.callbacks)) {
    for (const call of callback.mock.calls) assert.equal(call.arguments[0].expectedLease, value.lease);
  }
}
for (const family of families) {
  test(`${family.name} captures one lease for heartbeat, lifecycle and final release`, async (t) => {
    const value = fixture(t, family); await value.run(); verifyCapturedCalls(value);
    assert.equal(value.options.acquireLease.mock.callCount(), 1); assert.equal(value.heartbeatFactory.mock.calls[0].arguments[0].expectedLease, value.lease);
    assert.equal(value.work.mock.callCount(), 1); assert.equal(value.callbacks.markRunStarted.mock.callCount(), family.name === 'library organize' ? 2 : 1);
    assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 1); assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
  });
  test(`${family.name} cannot fail or release another acquisition when acquiring fails`, async (t) => {
    for (const acquireLease of [async () => null, async () => { throw new Error('Unavailable'); }]) {
      const value = fixture(t, family, { acquireLease }); await value.run();
      assert.equal(value.work.mock.callCount(), 0); assert.equal(value.heartbeatFactory.mock.callCount(), 0);
      for (const callback of Object.values(value.callbacks)) assert.equal(callback.mock.callCount(), 0);
    }
  });
  test(`${family.name} stops before domain effects when start loses its acquisition`, async (t) => {
    const value = fixture(t, family); value.callbacks.markRunStarted.mock.mockImplementation(async () => false); await value.run(); verifyCapturedCalls(value);
    assert.equal(value.work.mock.callCount(), 0); assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0);
    assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 0); assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
  });
  test(`${family.name} does not convert a stale completion into failure or later success notifications`, async (t) => {
    const value = fixture(t, family); value.callbacks.markRunCompleted.mock.mockImplementation(async () => false); await value.run(); verifyCapturedCalls(value);
    assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0); assert.equal(value.notify.mock.callCount(), 0);
    assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
    if (family.name === 'library discovery') assert.equal(value.options.pruneOldRuns.mock.callCount(), 0);
  });
  test(`${family.name} treats a typed final guard ownership loss as a stop`, async (t) => {
    const value = fixture(t, family); value.work.mock.mockImplementation(async () => { throw Object.assign(new Error('Lost'), { code: 'operation_run_lease_lost' }); });
    await value.run(); verifyCapturedCalls(value); assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0);
    assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 0); assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
  });
  test(`${family.name} tolerates ownership loss while recording its domain failure`, async (t) => {
    const value = fixture(t, family); value.work.mock.mockImplementation(async () => { throw new Error('Domain failure'); });
    value.callbacks.markRunFailed.mock.mockImplementation(async () => false); await value.run(); verifyCapturedCalls(value);
    assert.equal(value.callbacks.markRunFailed.mock.callCount(), 1); assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
  });
  test(`${family.name} passes the captured acquisition to pause and cancellation callbacks`, async (t) => {
    for (const kind of ['paused', 'cancelled']) {
      const value = fixture(t, family, { isCancellationRequested: async () => kind === 'cancelled' ? true
        : { kind: 'paused', nextRetryAt: '2099-10-09T00:00:00.000Z', pauseMessage: 'Pause' } });
      await value.run(); verifyCapturedCalls(value); assert.equal(value.work.mock.callCount(), 0);
      assert.equal(value.callbacks[kind === 'paused' ? 'markRunPaused' : 'markRunCancelled'].mock.callCount(), 1);
      assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0); assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
    }
  });
}

test('organize stops after a refused progress write without moving another file or announcing success', async (t) => {
  const family = families.find((entry) => entry.name === 'library organize');
  const move = t.mock.fn(async () => ({ transport: 'copy_then_remove', sourceRemoved: true,
    verification: { destinationExists: true, sourceSizeBytes: 1, destinationSizeBytes: 1, sourceRemoved: true, sourceExistsAfterSuccess: false } })); const value = fixture(t, family, { applyOrganizeMutation: move });
  value.work.mock.mockImplementation(async () => ({ files: [family.result.files[0], { ...family.result.files[0], fileId: 'file-2', proposedPath: '/virtual/second.flac' }], counts: { totalFiles: 2 } }));
  let started = 0; value.callbacks.markRunStarted.mock.mockImplementation(async () => ++started === 1);
  await value.run(); verifyCapturedCalls(value); assert.equal(move.mock.callCount(), 1);
  assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 0); assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0); assert.equal(value.notify.mock.callCount(), 0);
});

test('organize does not turn a typed file guard ownership loss into a recorded file failure', async (t) => {
  const family = families.find((entry) => entry.name === 'library organize');
  const value = fixture(t, family, { applyOrganizeMutation: async () => { throw Object.assign(new Error('Lost'), { code: 'operation_run_lease_lost' }); } });
  await value.run(); verifyCapturedCalls(value); assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 0);
  assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0); assert.equal(value.notify.mock.callCount(), 0);
});

test('discovery artwork best-effort handling preserves typed ownership loss', async (t) => {
  const family = families.find((entry) => entry.name === 'library discovery');
  const value = fixture(t, family, { prefetchMonitoredArtistArtwork: async () => { throw Object.assign(new Error('Lost'), { code: 'operation_run_lease_lost' }); } });
  await value.run(); verifyCapturedCalls(value); assert.equal(value.work.mock.callCount(), 0);
  assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 0); assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0); assert.equal(value.options.pruneOldRuns.mock.callCount(), 0);
});

test('scan sidecar best-effort handling preserves typed ownership loss', async (t) => {
  const family = families.find((entry) => entry.name === 'library scan');
  const value = fixture(t, family, { recordLibraryScanCatalogue: async () => ({ files: [{ fileState: 'observed' }], observedFileCount: 1 }),
    captureLibrarySidecarArtwork: async () => { throw Object.assign(new Error('Lost'), { code: 'operation_run_lease_lost' }); } });
  await value.run(); verifyCapturedCalls(value); assert.equal(value.callbacks.markRunCompleted.mock.callCount(), 0);
  assert.equal(value.callbacks.markRunFailed.mock.callCount(), 0); assert.equal(value.callbacks.releaseLease.mock.callCount(), 1);
});
