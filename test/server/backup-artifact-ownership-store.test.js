/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createBackupArtifactOwnershipStore } from '../../src/server/recovery/backup-artifact-ownership-store.js';

function fixture({ busy = false, unlockError = null, acquireError = null } = {}) {
  const queries = [], releases = [];
  const client = new EventEmitter();
  client.query = async sql => {
    queries.push(sql);
    if (sql.includes('pg_try')) {
      if (acquireError) throw acquireError;
      return { rows: [{ acquired: !busy }] };
    }
    if (sql.includes('pg_advisory_unlock')) { if (unlockError) throw unlockError; return { rows: [{ unlocked: true }] }; }
    return { rows: [{ backup_owner_alive: 1 }] };
  };
  client.release = error => releases.push(error);
  return { client, queries, releases, store: createBackupArtifactOwnershipStore({ getPoolFn: () => ({ connect: async () => client }) }) };
}

test('backup ownership holds the session through actual work settlement and balances unlock/release', async () => {
  const f = fixture(), ready = Promise.withResolvers(), finish = Promise.withResolvers();
  const task = f.store.withOwnership(async ({ queryable }) => { assert.equal(queryable, f.client); ready.resolve(); await finish.promise; return 'done'; });
  await ready.promise; assert.equal(f.releases.length, 0); assert.ok(!f.queries.some(sql => sql.includes('unlock')));
  finish.resolve(); assert.equal(await task, 'done');
  assert.equal(f.queries.filter(sql => sql.includes('pg_advisory_unlock')).length, 1);
  assert.deepEqual(f.releases, [undefined]); assert.equal(f.client.listenerCount('error'), 0); assert.equal(f.client.listenerCount('end'), 0);
});

test('an uncertain lock acquisition destroys the session without admitting work', async () => {
  const original = new Error('interrupted acquisition');
  const f = fixture({ acquireError: original });
  let admitted = false;
  await assert.rejects(f.store.withOwnership(() => { admitted = true; }), error => error === original);
  assert.equal(admitted, false);
  assert.ok(f.releases[0] instanceof Error);
  assert.equal(f.client.listenerCount('error'), 0);
  assert.ok(!f.queries.some(sql => sql.includes('pg_advisory_unlock')));
});

test('busy backup ownership admits no work and uses explicit busy recovery rather than invented deferred counts', async () => {
  const f = fixture({ busy: true }); let admitted = false;
  await assert.rejects(f.store.withOwnership(() => { admitted = true; }), { code: 'backup_artifact_operation_busy' });
  assert.equal(await f.store.withOwnership(() => { admitted = true; }, { onBusy: () => 'busy' }), 'busy');
  assert.equal(admitted, false); assert.equal(f.releases.length, 2); assert.ok(!f.queries.some(sql => sql.includes('pg_advisory_unlock')));
});

test('work Error/null wins over unlock failure and uncertain sessions are destroyed', async () => {
  for (const original of [new Error('work failed'), null]) {
    const f = fixture({ unlockError: new Error('unlock failed') }); let failed = false;
    try { await f.store.withOwnership(() => { throw original; }); } catch (error) { failed = true; assert.equal(error, original); }
    assert.equal(failed, true); assert.equal(f.releases.length, 1); assert.ok(f.releases[0] instanceof Error);
  }
});

test('connection loss refuses future admission and drains held work before retiring its client', async () => {
  const f = fixture(), ready = Promise.withResolvers(), finish = Promise.withResolvers();
  const task = f.store.withOwnership(async ({ assertOwnership }) => {
    ready.resolve(); await finish.promise; await assertOwnership(); throw new Error('unreachable');
  });
  const outcome = task.then(() => null, error => error); await ready.promise;
  f.client.emit('error', new Error('private connection detail')); assert.equal(f.releases.length, 0);
  finish.resolve(); const error = await outcome;
  assert.equal(error.code, 'backup_artifact_owner_lost'); assert.doesNotMatch(error.message, /private connection/u);
  assert.ok(!f.queries.some(sql => sql.includes('pg_advisory_unlock'))); assert.ok(f.releases[0] instanceof Error);
  assert.equal(f.client.listenerCount('error'), 0);
});
