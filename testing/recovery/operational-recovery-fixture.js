/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createEncryptedSecretService } from '../../src/server/encrypted-secret-service.js';
import { buildJobLeaseKey, createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationRetryPolicyService } from '../../src/server/operation-retry-policy-service.js';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { seedOperationRunFixture } from '../integration/operation-run-fixtures.js';

const operationType = operationRunRegistry.libraryScan.operationType;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const rowDigest = (value) => digest(JSON.stringify(value));

async function readRuns(queryable, runIds) {
  const result = await queryable.query('SELECT * FROM operation_runs WHERE id = ANY($1::uuid[]) ORDER BY id', [runIds]);
  return result.rows;
}

/** Synthetic-only fixture; its key and internal state must never be emitted as release evidence. */
export async function seedOperationalRecoveryFixture({ getPoolFn }) {
  const queryable = getPoolFn();
  const encryptionKey = randomBytes(32);
  const secretValue = randomBytes(32).toString('base64url');
  const secretIdentity = { secretType: 'recovery_verification', name: `synthetic-${randomUUID()}` };
  const secrets = createEncryptedSecretService({ encryptionKey, getPoolFn });
  await secrets.setSecretValue({ ...secretIdentity, plaintextValue: secretValue });

  const oldOwnerInstanceId = `recovery-source-${randomUUID()}`;
  const oldLeaseStore = createJobLeaseStore({ getPoolFn, ownerInstanceId: oldOwnerInstanceId, leaseDurationMs: 24 * 60 * 60 * 1000 });
  const runIds = {};
  for (const [name, overrides] of Object.entries({
    queued: { status: 'pending', attemptCount: 0 },
    active: { status: 'running', attemptCount: 1 },
    retryable: { status: 'running', attemptCount: 1 },
    cancellationRequested: { status: 'running', attemptCount: 1, cancelRequestedAt: new Date().toISOString() },
    exhaustedCancellationRequested: { status: 'running', attemptCount: 3, cancelRequestedAt: new Date().toISOString() },
  })) {
    const run = await seedOperationRunFixture({ queryable, runOverrides: {
      operationType, maxAttempts: 3, claimedByInstanceId: name === 'queued' ? null : oldOwnerInstanceId,
      claimedAt: name === 'queued' ? null : new Date().toISOString(),
      summary: { fixture: 'operational_recovery', case: name }, ...overrides,
    } });
    runIds[name] = run.id;
    if (['active', 'retryable', 'cancellationRequested'].includes(name)) {
      const leaseKey = buildJobLeaseKey({ jobType: operationType, runId: run.id });
      await oldLeaseStore.acquireLease({ jobType: operationType, leaseKey });
      if (name !== 'active') {
        await queryable.query("UPDATE job_leases SET expires_at = NOW() - INTERVAL '1 minute' WHERE lease_key = $1", [leaseKey]);
      }
    }
  }
  const allRunIds = Object.values(runIds);
  const runs = await readRuns(queryable, allRunIds);
  const leases = await oldLeaseStore.listLeases({ leaseKeys: allRunIds.map((runId) => buildJobLeaseKey({ jobType: operationType, runId })) });
  return {
    encryptionKey, secretIdentity, secretDigest: digest(secretValue),
    encryptedRecordDigest: rowDigest(await secrets.getSecretRecord(secretIdentity)),
    oldOwnerInstanceId, runIds, runsDigest: rowDigest(runs),
    activeRunDigest: rowDigest(runs.find((run) => run.id === runIds.active)),
    queuedRunDigest: rowDigest(runs.find((run) => run.id === runIds.queued)),
    cancellationTimes: Object.fromEntries(runs.filter((run) => run.cancel_requested_at).map((run) => [run.id, run.cancel_requested_at.toISOString()])),
    activeLeaseDigest: rowDigest(leases.find((lease) => lease.leaseKey.endsWith(runIds.active))),
  };
}

/** Verify one restored fixture with explicit database dependencies; never start or dispatch workers. */
export async function verifyRestoredOperationalRecovery({ getPoolFn, fixture }) {
  const queryable = getPoolFn();
  const { runIds, secretIdentity } = fixture;
  const allRunIds = Object.values(runIds);
  assert.equal(rowDigest(await readRuns(queryable, allRunIds)), fixture.runsDigest, 'Restored operation rows must match the captured database');
  const secrets = createEncryptedSecretService({ encryptionKey: fixture.encryptionKey, getPoolFn });
  assert.equal(rowDigest(await secrets.getSecretRecord(secretIdentity)), fixture.encryptedRecordDigest, 'Encrypted secret record must survive restore unchanged');
  assert.equal(digest(await secrets.getSecretValue(secretIdentity)), fixture.secretDigest, 'The original external key must decrypt the restored synthetic secret');
  await assert.rejects(() => createEncryptedSecretService({ encryptionKey: null, getPoolFn }).getSecretValue(secretIdentity),
    { code: 'secret_encryption_key_missing' });
  const wrongKey = Buffer.from(fixture.encryptionKey);
  wrongKey[0] ^= 1;
  await assert.rejects(() => createEncryptedSecretService({ encryptionKey: wrongKey, getPoolFn }).getSecretValue(secretIdentity));

  const jobLeaseStore = createJobLeaseStore({ getPoolFn, ownerInstanceId: `recovery-target-${randomUUID()}` });
  const activeLeaseKey = buildJobLeaseKey({ jobType: operationType, runId: runIds.active });
  assert.equal(await jobLeaseStore.acquireLease({ jobType: operationType, leaseKey: activeLeaseKey }), null,
    'A restored active lease owned by the source must not be taken by a new instance');
  assert.equal(rowDigest(await jobLeaseStore.getLease({ leaseKey: activeLeaseKey })), fixture.activeLeaseDigest,
    'The unexpired source lease must remain unchanged');

  const operationQueueStore = createOperationQueueStore({ getPoolFn, claimOwnerInstanceId: 'recovery-verifier-no-dispatch' });
  const recovery = createOperationStrandedRunRecoveryService({
    jobLeaseStore, operationQueueStore,
    retryPolicyService: createOperationRetryPolicyService({ jitterRatio: 0 }),
  });
  const result = await recovery.recoverStrandedRuns({ operationTypes: [operationType] });
  assert.deepEqual(result, { activeLeaseCount: 1, cancelledCount: 2, failedCount: 0, retriedCount: 1, scannedCount: 4, skipped: false });
  const recovered = new Map((await readRuns(queryable, allRunIds)).map((run) => [run.id, run]));
  for (const runId of [runIds.cancellationRequested, runIds.exhaustedCancellationRequested]) {
    const run = recovered.get(runId);
    assert.equal(run.status, 'cancelled', 'Restored cancellation must remain terminal after automatic recovery');
    assert.equal(run.cancel_requested_at.toISOString(), fixture.cancellationTimes[runId]);
    assert.ok(run.cancelled_at && run.finished_at);
    assert.equal(run.claimed_at, null);
    assert.equal(run.claimed_by_instance_id, null);
    assert.equal(run.error_message, null);
    assert.equal(run.summary.retryScheduledAt, null);
  }
  const retryable = recovered.get(runIds.retryable);
  assert.equal(retryable.status, 'pending');
  assert.equal(retryable.attempt_count, 1, 'Recovery schedules work without executing a new attempt');
  assert.equal(retryable.claimed_at, null);
  assert.equal(retryable.claimed_by_instance_id, null);
  assert.equal(rowDigest(recovered.get(runIds.queued)), fixture.queuedRunDigest, 'Ordinary queued work must remain untouched');
  assert.equal(rowDigest(recovered.get(runIds.active)), fixture.activeRunDigest, 'Unexpired leased work must remain untouched');
  for (const runId of [runIds.retryable, runIds.cancellationRequested]) {
    const lease = await jobLeaseStore.getLease({ leaseKey: buildJobLeaseKey({ jobType: operationType, runId }) });
    assert.equal(lease.state, 'released');
    assert.equal(lease.status, 'expired');
    assert.equal(lease.ownerInstanceId, fixture.oldOwnerInstanceId);
  }
  return {
    restoredRunCount: allRunIds.length, restoredSecretCount: 1,
    originalKeyDecrypts: true, missingKeyRejected: true, wrongKeyRejected: true,
    activeLeasePreserved: true, expiredLeasesReleased: 2,
    cancelledRunCount: 2, retryQueuedCount: 1, queuedWorkUnchanged: true,
    workersStarted: false,
  };
}
