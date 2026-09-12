/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0. See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationRecoverySweepService } from '../../src/server/metadata/operator-artist-reconciliation-recovery-sweep-service.js';
const operationTypes = ['operator_artist_reconciliation'];

test('recovery sweep limits scans and enforces its cooldown', async (t) => {
  let now = 1;
  const listCandidates = t.mock.fn(async () => [{ runId: 'one' }, { runId: 'two' }]);
  const recoverCandidate = t.mock.fn(async ({ runId }) => ({ recovered: runId === 'one' }));
  const service = createOperatorArtistReconciliationRecoverySweepService({ getNow: () => now,
    recoveryStore: { listCandidates, recoverCandidate } });
  assert.equal((await service.recoverFailedRuns({ operationTypes: [] })).skipped, true);
  assert.deepEqual(await service.recoverFailedRuns({ operationTypes }), { scannedCount: 2, recoveredCount: 1, skipped: false });
  assert.deepEqual(listCandidates.mock.calls[0].arguments[0], { limit: 10 });
  assert.equal((await service.recoverFailedRuns({ operationTypes })).skipped, true);
  now += 60_000;
  assert.equal((await service.recoverFailedRuns({ operationTypes })).skipped, false);
});

test('recovery sweep surfaces database errors and releases its in-flight guard', async () => {
  let now = 1;
  let fail = true;
  const service = createOperatorArtistReconciliationRecoverySweepService({ getNow: () => now,
    recoveryStore: { listCandidates: async () => { if (fail) throw new Error('Database unavailable'); return []; } } });
  await assert.rejects(service.recoverFailedRuns({ operationTypes }), /Database unavailable/u);
  fail = false;
  now += 60_000;
  assert.equal((await service.recoverFailedRuns({ operationTypes })).skipped, false);
});

test('a failed candidate is reported after other candidates get their recovery opportunity', async () => {
  const failure = new Error('Invalid persisted snapshot');
  const calls = [];
  const service = createOperatorArtistReconciliationRecoverySweepService({
    recoveryStore: {
      listCandidates: async () => [{ runId: 'bad' }, { runId: 'good' }],
      recoverCandidate: async ({ runId }) => {
        calls.push(runId);
        if (runId === 'bad') throw failure;
        return { recovered: true };
      },
    },
  });
  await assert.rejects(service.recoverFailedRuns({ operationTypes }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [failure]);
    return true;
  });
  assert.deepEqual(calls, ['bad', 'good']);
});
