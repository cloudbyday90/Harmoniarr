/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserSpectralAdmissionStore } from '../../src/server/activity/source-user-spectral-admission-store.js';

function fixture(queryImpl = () => ({ rows: [] })) {
  const calls = [];
  const client = {
    async query(text) { calls.push(text); return queryImpl(text); },
    release(error) { calls.push({ released: error }); },
  };
  const store = createSourceUserSpectralAdmissionStore({ getPoolFn: () => ({
    async connect() { calls.push('connect'); return client; },
    query() { assert.fail('Admission must use its transaction client'); },
  }) });
  return { store, client, calls };
}

test('spectral admission separates lock acquisition from fresh work and commits before returning', async () => {
  const c = fixture();
  const value = {};
  assert.equal(await c.store.withSpectralJobAdmission(async queryable => {
    assert.equal(queryable, c.client);
    await queryable.query('owned insertion');
    return value;
  }), value);
  assert.deepEqual(c.calls, ['connect', 'BEGIN', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
    "SET LOCAL lock_timeout = '5s'",
    "SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.source-user-spectral-admission', 0))",
    'owned insertion', 'COMMIT', { released: undefined }]);
});

for (const failure of [new Error('original insert failure'), null]) {
  test(`spectral admission rolls back and preserves ${failure === null ? 'null' : 'Error'} from owned work`, async () => {
    const c = fixture();
    await assert.rejects(c.store.withSpectralJobAdmission(() => { throw failure; }), error => error === failure);
    assert.deepEqual(c.calls.slice(-2), ['ROLLBACK', { released: undefined }]);
    assert.ok(!c.calls.includes('COMMIT'));
  });
}

test('spectral admission refuses work after a failed lock and preserves rollback eviction policy', async () => {
  const lockError = Object.assign(new Error('lock refused'), { code: '55P03' });
  const rollbackError = new Error('rollback failed');
  const c = fixture(text => {
    if (text.startsWith('SELECT pg_advisory')) throw lockError;
    if (text === 'ROLLBACK') throw rollbackError;
    return { rows: [] };
  });
  await assert.rejects(c.store.withSpectralJobAdmission(() => assert.fail('No insert without admission')), error => error === lockError);
  assert.deepEqual(c.calls.at(-1), { released: rollbackError });
});

test('spectral admission does not return success after a failed commit', async () => {
  const failure = new Error('commit failed');
  const c = fixture(text => { if (text === 'COMMIT') throw failure; return { rows: [] }; });
  await assert.rejects(c.store.withSpectralJobAdmission(() => 'unpublished'), error => error === failure);
  assert.deepEqual(c.calls.slice(-2), ['ROLLBACK', { released: undefined }]);
});
