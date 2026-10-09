/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { preparationLeaseIdentity, hasCurrentPreparationLease, validatePreProviderEpoch,
  hasCertifiedPreProviderRefusal } from '../../src/server/import-candidates/import-execution-pre-provider-policy.js';
import { createImportExecutionPreProviderService } from '../../src/server/import-candidates/import-execution-pre-provider-service.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createDownloadAttempt } from '../../src/server/slskd/slskd-download-attempt-policy.js';

const preparedAt = '2026-10-09T20:00:00.000Z';
const now = Date.parse('2026-10-09T20:01:00.000Z');
function fixture() {
  const runId = randomUUID();
  const candidate = { id: randomUUID(), status: 'selected', username: 'peer', sourceSearchId: randomUUID(),
    sourceProvider: 'slskd', normalizedPayload: {}, files: [{ id: randomUUID(), filename: '01.flac', sizeBytes: 1000,
      rawPayload: { filename: 'Album/01.flac' }, extension: 'flac', isLocked: false }] };
  const legacy = { leaseKey: 'import_candidate_execution_planning:' + runId, ownerInstanceId: 'pid:44', acquiredAt: preparedAt };
  const requestedFiles = [{ filename: 'Album\\01.flac', size: 1000 }];
  const epoch = { version: 1, epochId: randomUUID(), operationRunId: runId, importCandidateId: candidate.id,
    generation: 1, preparedAt, phase: 'preparing', lease: legacy, requestedFiles,
    sourceObservation: captureRecoveryObservation(candidate) };
  return { runId, candidate, legacy, requestedFiles, epoch,
    current: { ...legacy, expiresAt: '2026-10-09T20:10:00.000Z', releasedAt: null } };
}

test('legacy three-field epoch/refusal evidence stays readable and is never grafted with a current token', () => {
  const f = fixture();
  const saved = structuredClone(f.legacy);
  assert.deepEqual(preparationLeaseIdentity(f.legacy, f.runId), saved);
  const epoch = { ...f.epoch, phase: 'refused', refusal: { reasonCode: 'provider_changed',
    refusedAt: '2026-10-09T20:01:00.000Z' } };
  assert.equal(validatePreProviderEpoch(epoch, { runId: f.runId, importCandidateId: f.candidate.id }), epoch);
  const run = { id: f.runId, summary: { downloadPreparationProtocol: { version: 1 } } };
  const item = { operationRunId: f.runId, importCandidateId: f.candidate.id, itemStatus: 'blocked',
    planningSnapshot: { execution: { requestedFiles: f.requestedFiles, outcome: 'pre_provider_refused',
      handoff: { state: 'pre_provider_refused', preProviderEpoch: epoch } } } };
  assert.equal(hasCertifiedPreProviderRefusal({ run, item }), true);
  assert.deepEqual(epoch.lease, saved);
  assert.equal(Object.hasOwn(epoch.lease, 'acquisitionId'), false);
});

test('new preparation identities retain the captured token and distinguish same-time/PID acquisitions', () => {
  const f = fixture();
  const expected = { ...f.legacy, acquisitionId: randomUUID() };
  const current = { ...f.current, acquisitionId: expected.acquisitionId };
  assert.deepEqual(preparationLeaseIdentity(current, f.runId), expected);
  assert.equal(hasCurrentPreparationLease(current, expected, f.runId, now), true);
  assert.equal(hasCurrentPreparationLease({ ...current, acquisitionId: randomUUID() }, expected, f.runId, now), false);
  assert.equal(hasCurrentPreparationLease(current, f.legacy, f.runId, now), false);
});

test('explicit malformed optional token cannot be treated as an omitted historical field', () => {
  const f = fixture();
  for (const acquisitionId of [null, undefined, [], 'not-a-token']) {
    assert.equal(preparationLeaseIdentity({ ...f.legacy, acquisitionId }, f.runId), null);
  }
});

test('two tokenless historical tuples cannot establish current dispatch ownership', () => {
  const f = fixture();
  assert.equal(hasCurrentPreparationLease(f.current, f.legacy, f.runId, now), false);
});

test('the actual pre-provider boundary refuses tokenless current authority without sealing or crossing', async () => {
  const f = fixture();
  const attempt = createDownloadAttempt({ operationRunId: f.runId, importCandidateId: f.candidate.id,
    username: 'peer', requestedFiles: f.requestedFiles, sourceObservation: f.epoch.sourceObservation });
  f.epoch.attemptId = attempt.attemptId;
  const context = { run: { id: f.runId, operationType: 'import_candidate_execution_planning', status: 'running',
    summary: { downloadPreparationProtocol: { version: 1 } }, cancelRequestedAt: null, cancelledAt: null },
  item: { operationRunId: f.runId, importCandidateId: f.candidate.id, itemStatus: 'awaiting_confirmation',
    planningSnapshot: { execution: { requestedFiles: f.requestedFiles,
      handoff: { state: 'dispatching', preProviderEpoch: f.epoch, attempt } } } },
  candidate: f.candidate, lease: f.current, transferLinkCount: 0 };
  let writes = 0;
  let audits = 0;
  const before = structuredClone(context);
  const service = createImportExecutionPreProviderService({ withTransaction: (work) => work({ testTransaction: true }),
    getNow: () => new Date(now), recordAuditEventFn: async () => { audits += 1; },
    store: { lockContext: async () => context, saveEpoch: async () => { writes += 1; return true; },
      isCurrentOrigin: async () => true, findUnresolvedOtherHandoff: async () => false } });
  await assert.rejects(service.markDispatchPossible({ runId: f.runId, importCandidateId: f.candidate.id,
    epochId: f.epoch.epochId, lease: f.legacy, attemptId: attempt.attemptId }), { code: 'import_execution_preparation_stale' });
  assert.equal(writes, 0);
  assert.equal(audits, 0);
  assert.deepEqual(context, before);
});
