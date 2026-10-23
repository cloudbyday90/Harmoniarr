/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeControlledDownload, executeControlledApply, executeControlledDiscovery } from '../../testing/docker/controlled-provider-worker-driver.mjs';

function fixture(run, start) {
  let finished = false;
  const store = { getRunById: async () => ({ ...run, status: finished ? 'completed' : run.status }) };
  const worker = { startWorkerRun: async input => {
    return { completion: Promise.resolve().then(() => start(input)).then(() => { finished = true; }) };
  } };
  return { importCandidateExecutionRunStore: store, importCandidateExecutionWorker: worker,
    importCandidateApplyRunStore: store, importCandidateApplyWorker: worker,
    libraryDiscoveryRunStore: store, libraryDiscoveryWorker: worker };
}
const pending = { id: 'run', status: 'pending', triggerSource: 'saved-owner', requestedCandidateCount: 1 };

test('fixture download driver preserves saved scope and waits for actual worker completion', async () => {
  const gate = Promise.withResolvers(); const started = Promise.withResolvers(); let observed; let settled = false;
  const module = fixture({ ...pending, selectedCandidateId: 'candidate', sourceSearchId: 'search' }, async input => {
    observed = input; started.resolve(); return gate.promise;
  });
  const work = executeControlledDownload(module, 'run').then(result => { settled = true; return result; });
  try {
    await started.promise;
    assert.deepEqual(observed, { runId: 'run', requestedCandidateCount: 1, selectedCandidateId: 'candidate', sourceSearchId: 'search', triggerSource: 'saved-owner' });
    assert.equal(settled, false); gate.resolve(); assert.equal((await work).status, 'completed');
  } finally { gate.resolve(); await work; }
});

test('fixture apply and discovery drivers retain persisted ownership inputs', async () => {
  const calls = [];
  const module = fixture({ ...pending, applySafetyMode: 'safe_auto', importCandidateIds: ['owned-candidate'], executableCandidateCount: 2, triggeredByUserId: 'actor' }, async input => { calls.push(input); return Promise.resolve(); });
  await executeControlledApply(module, 'run');
  const discovery = fixture({ ...pending, triggeredByUserId: 'actor' }, async input => { calls.push(input); return Promise.resolve(); });
  await executeControlledDiscovery(discovery, 'run');
  assert.equal(calls[0].applySafetyMode, 'safe_auto'); assert.equal(calls[0].executableCandidateCount, 2);
  assert.deepEqual(calls[0].importCandidateIds, ['owned-candidate'], 'saved candidate scope must never broaden to unrelated pending work');
  assert.deepEqual(calls[1], { runId: 'run', triggeredByUserId: 'actor', triggerSource: 'saved-owner' });
});
for (const error of [new Error('owned failure'), null]) {
  test(`fixture driver preserves original ${error === null ? 'null' : 'Error'} startup refusal`, async () => {
    const module = fixture(pending, async () => { throw error; });
    await assert.rejects(executeControlledDownload(module, 'run'), value => value === error);
  });
}
test('fixture driver refuses a missing or non-pending accepted run before worker start', async () => {
  for (const run of [null, { ...pending, status: 'completed' }]) {
    let starts = 0;
    await assert.rejects(executeControlledDownload({ importCandidateExecutionRunStore: { getRunById: async () => run },
      importCandidateExecutionWorker: { startWorkerRun: async () => { starts += 1; } } }, 'run'));
    assert.equal(starts, 0);
  }
});
test('fixture driver requires an owned completion promise', async () => {
  await assert.rejects(executeControlledDownload({ importCandidateExecutionRunStore: { getRunById: async () => pending },
    importCandidateExecutionWorker: { startWorkerRun: async () => ({}) } }, 'run'), /owned worker completion/u);
});
