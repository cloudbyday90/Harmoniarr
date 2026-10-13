/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWantedWorkloadMemorySampler } from '../../testing/integration/wanted-workload-memory.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { profileWantedGuardedReconciliation, summarizeWantedGuardedSample } from '../../testing/integration/wanted-guarded-profile.js';

test('memory sampling owns its timer, records separate peaks and stops byte admission after finish', () => {
  let tick; let cleared = 0; let calls = 0;
  const sample = createWantedWorkloadMemorySampler({ readMemory: () => {
    const n = calls++ === 0 ? 10 : 30; return { rss: n, heapUsed: n + 1, external: n + 2, arrayBuffers: n + 3, secret: 'private' };
  }, schedule: callback => { tick = callback; return { unref() {} }; }, cancel: () => { cleared++; } });
  sample.observeBytes(64); sample.observeBytes(1); tick(); const result = sample.finish();
  assert.equal(result.peak.rss, 30); assert.equal(result.peakDelta.rss, 20);
  assert.equal(result.baseline.arrayBuffers, 13); assert.equal(result.unavailable, false);
  const count = calls; sample.observeBytes(1_048_576); tick(); sample.finish();
  assert.equal(calls, count); assert.equal(cleared, 1); assert.equal(JSON.stringify(result).includes('private'), false);
});

test('unavailable memory observations stay explicit without surfacing private failures', () => {
  const sample = createWantedWorkloadMemorySampler({ readMemory: () => { throw new Error('private'); },
    schedule: () => ({}), cancel: () => {} });
  const result = sample.finish(); assert.equal(result.unavailable, true); assert.equal(result.peak, null);
  assert.equal(JSON.stringify(result).includes('private'), false);
});

test('one owned native connection serves separate rolled-back samples and releases only once', async () => {
  const order = []; let connections = 0;
  const client = { query: async function (sql) { assert.equal(this, client); order.push(sql); },
    release: discard => { assert.equal(discard, false); order.push('release'); } };
  await withWantedProfileClient({ connect: async () => { connections++; return client; } }, async pool => {
    for (let n = 0; n < 2; n++) await withRollbackFixtureClient(pool, async borrowed => { await borrowed.query('sample'); });
  });
  assert.equal(connections, 1); assert.deepEqual(order, ['BEGIN', 'sample', 'ROLLBACK', 'BEGIN', 'sample', 'ROLLBACK', 'release']);
});

test('uncertain sample rollback discards the owner while retaining original Error/null over release failure', async () => {
  for (const primary of [new Error('original'), null]) {
    let discarded;
    const client = { query: async sql => { if (sql === 'ROLLBACK') throw new Error('secondary rollback'); },
      release: discard => { discarded = discard; throw new Error('secondary release'); } };
    await assert.rejects(withWantedProfileClient({ connect: async () => client }, pool => withRollbackFixtureClient(pool,
      () => { throw primary; })), error => error === primary);
    assert.equal(discarded, true);
  }
});

test('invalid method, missing GC and pre-cancellation refuse measurement admission', async () => {
  const pool = { connect: () => assert.fail('No measurement client admitted') };
  await assert.rejects(profileWantedGuardedReconciliation(pool, { readMethod: 'private', gc: () => {} }), TypeError);
  await assert.rejects(profileWantedGuardedReconciliation(pool, { gc: null }), TypeError);
  await assert.rejects(profileWantedGuardedReconciliation(pool, { costDiagnostics: 'yes', gc: () => {} }), TypeError);
  const controller = new AbortController(); controller.abort(null);
  await assert.rejects(profileWantedGuardedReconciliation(pool, { gc: () => {}, signal: controller.signal }), error => error === null);
});

test('saved summaries explicitly select measurement fields and omit private results/digests/extra keys', () => {
  const result = summarizeWantedGuardedSample({ readMethod: 'reusable', queryCount: 5,
    result: { ownerId: 'private' }, projectionDigests: ['private'], extra: 'private', diagnostics: {
      correlationId: 'private', counters: { projectionReads: 7 }, phases: {} } });
  assert.equal(JSON.stringify(result).includes('private'), false); assert.equal(result.queryCount, 5);
});
