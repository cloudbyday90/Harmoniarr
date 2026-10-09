/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDownloadAttempt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { evaluateUnusedExecutionAllocation, hasLiveOrUnverifiableExecutionLease, hasReciprocalExecutionOriginResolution }
  from '../../src/server/import-candidates/import-execution-origin-policy.js';

function fixture() {
  const importCandidateId = randomUUID(); const runId = randomUUID();
  return { importCandidateId, leases: [], transferLinkCount: 0, items: [], run: { id: runId,
    operationType: 'import_candidate_execution_planning', status: 'pending', attemptCount: 0, claimedAt: null, claimedByInstanceId: null,
    summary: { executionMode: 'download_enqueue', requestedCandidateCount: 1, selectedCandidateId: importCandidateId, triggerSource: 'manual' } } };
}
const item = (f, itemStatus, execution) => ({ importCandidateId: f.importCandidateId, operationRunId: f.run.id, itemStatus,
  planningSnapshot: execution === undefined ? {} : { execution } });

test('only empty or known initial planning allocations establish never-dispatched work', () => {
  const f = fixture();
  assert.equal(evaluateUnusedExecutionAllocation(f).eligible, true);
  for (const status of ['ready', 'ready_with_warnings', 'blocked']) {
    assert.equal(evaluateUnusedExecutionAllocation({ ...f, items: [item(f, status)] }).eligible, true);
  }
});

test('legacy uncertain and provider progress statuses cannot be retired merely because their checkpoint is absent', () => {
  const f = fixture();
  for (const status of ['awaiting_confirmation', 'queued', 'queued_with_warnings', 'downloading', 'completed', 'rejected', 'queue_failed', 'failed']) {
    assert.equal(evaluateUnusedExecutionAllocation({ ...f, items: [item(f, status)] }).eligible, false, status);
  }
});

test('persisted provider outcomes remain evidence even when handoff metadata is absent', () => {
  const f = fixture();
  for (const outcome of ['awaiting_confirmation', 'queued', 'queued_with_warnings', 'queue_failed', 'completed', 'not_dispatched']) {
    assert.equal(evaluateUnusedExecutionAllocation({ ...f, items: [item(f, 'blocked', { outcome })] }).eligible, false, outcome);
  }
});

test('a typed explicit non-dispatch may retire a stopped worker but no uncertainty, receipt or live lease', () => {
  const f = fixture();
  f.run.status = 'failed'; f.run.attemptCount = 1;
  const files = [{ filename: 'Album\\One.flac', size: 123 }];
  const attempt = createDownloadAttempt({ importCandidateId: f.importCandidateId, operationRunId: f.run.id,
    requestedFiles: files, username: 'peer', sourceObservation: { candidateId: f.importCandidateId } });
  f.items = [item(f, 'blocked', { requestedFiles: files, outcome: 'not_dispatched', handoff: { state: 'not_dispatched', attempt } })];
  assert.equal(evaluateUnusedExecutionAllocation(f).eligible, true);
  f.items[0].planningSnapshot.execution.handoff.state = 'awaiting_confirmation';
  assert.equal(evaluateUnusedExecutionAllocation(f).eligible, false);
  f.items[0].planningSnapshot.execution.handoff.state = 'not_dispatched';
  f.leases = [{ ownerInstanceId: 'worker', acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), releasedAt: null }];
  assert.equal(evaluateUnusedExecutionAllocation(f).eligible, false);
});

test('malformed snapshots, claims, lease history and sibling work cannot prove an unused allocation', () => {
  const f = fixture();
  for (const execution of [null, [], { handoff: null }, { handoff: [] }, { enqueuedTransfers: null }]) {
    assert.equal(evaluateUnusedExecutionAllocation({ ...f, items: [item(f, 'ready', execution)] }).eligible, false);
  }
  assert.equal(evaluateUnusedExecutionAllocation({ ...f, leases: [{}] }).eligible, false);
  assert.equal(evaluateUnusedExecutionAllocation({ ...f, run: { ...f.run, claimedAt: new Date().toISOString() } }).eligible, false);
  assert.equal(evaluateUnusedExecutionAllocation({ ...f, items: [item(f, 'ready'), { ...item(f, 'ready'), importCandidateId: randomUUID() }] }).eligible, false);
  assert.equal(hasLiveOrUnverifiableExecutionLease([{ ownerInstanceId: 'worker', acquiredAt: 'bad', expiresAt: 'bad' }]), true);
});

test('retirement authority requires the exact typed reciprocal pair and saved source attempt', () => {
  const f = fixture();
  const record = { version: 1, resolutionId: randomUUID(), importCandidateId: f.importCandidateId, sourceRunId: randomUUID(),
    newerRunId: f.run.id, sourceAttemptId: randomUUID(), actorUserId: randomUUID(), requestHash: 'a'.repeat(64),
    resolvedAt: new Date().toISOString(), publicOutcome: { outcome: 'restored' } };
  const sourceItem = { operationRunId: record.sourceRunId, importCandidateId: f.importCandidateId,
    planningSnapshot: { execution: { handoff: { attempt: { attemptId: record.sourceAttemptId }, originResolution: record } } } };
  const newerRun = { ...f.run, status: 'cancelled', summary: { ...f.run.summary, downloadOriginSupersession: record } };
  assert.equal(hasReciprocalExecutionOriginResolution({ record, sourceItem, newerRun, importCandidateId: f.importCandidateId }), true);
  assert.equal(hasReciprocalExecutionOriginResolution({ record, sourceItem, newerRun: { ...newerRun,
    summary: { ...newerRun.summary, downloadOriginSupersession: { ...record, actorUserId: randomUUID() } } }, importCandidateId: f.importCandidateId }), false);
});

test('a leased future refusal can prove unused work only with its exact protocol and complete epoch', () => {
  const f = fixture(); const now = new Date().toISOString();
  f.run.status = 'failed'; f.run.attemptCount = 1;
  f.run.summary.downloadPreparationProtocol = { version: 1 };
  f.leases = [{ ownerInstanceId: 'worker', acquiredAt: now, expiresAt: now, releasedAt: now }];
  const epoch = { version: 1, epochId: randomUUID(), operationRunId: f.run.id, importCandidateId: f.importCandidateId,
    generation: 1, lease: { leaseKey: `import_candidate_execution_planning:${f.run.id}`, ownerInstanceId: 'worker', acquiredAt: now },
    sourceObservation: { candidateId: f.importCandidateId, username: 'peer' }, requestedFiles: [], preparedAt: now,
    phase: 'refused', refusal: { reasonCode: 'no_unlocked_files', refusedAt: now } };
  f.items = [item(f, 'blocked', { requestedFiles: [], outcome: 'pre_provider_refused',
    handoff: { state: 'pre_provider_refused', preProviderEpoch: epoch } })];
  assert.equal(evaluateUnusedExecutionAllocation(f).eligible, true);
  const withoutProtocol = structuredClone(f); delete withoutProtocol.run.summary.downloadPreparationProtocol;
  assert.equal(evaluateUnusedExecutionAllocation(withoutProtocol).eligible, false);
  for (const phase of ['preparing', 'may_have_dispatched', 'invalid']) {
    const changed = structuredClone(f); changed.items[0].planningSnapshot.execution.handoff.preProviderEpoch.phase = phase;
    assert.equal(evaluateUnusedExecutionAllocation(changed).eligible, false, phase);
  }
  const late = structuredClone(f); late.items[0].planningSnapshot.execution.latestTransferSnapshot = {};
  assert.equal(evaluateUnusedExecutionAllocation(late).eligible, false);
});

test('a malformed or crossed epoch cannot fall back to older typed non-dispatch proof', () => {
  const f = fixture(); f.run.status = 'failed';
  const requestedFiles = [{ filename: 'Album\\One.flac', size: 123 }];
  const attempt = createDownloadAttempt({ importCandidateId: f.importCandidateId, operationRunId: f.run.id,
    requestedFiles, username: 'peer', sourceObservation: { candidateId: f.importCandidateId } });
  for (const preProviderEpoch of [null, {}, { phase: 'refused' }, { phase: 'may_have_dispatched' }]) {
    f.items = [item(f, 'blocked', { requestedFiles, outcome: 'not_dispatched', handoff: { state: 'not_dispatched', attempt, preProviderEpoch } })];
    assert.equal(evaluateUnusedExecutionAllocation(f).eligible, false);
  }
});
