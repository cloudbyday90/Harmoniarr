/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { withDatabasePreparation } from '../../src/server/database-preparation-owner-service.js';
import { databasePreparationLockKey } from '../../src/server/database-preparation-lock-store.js';
import { prepareDatabase } from '../../src/server/database-preparation.js';

function fixture(options = {}) {
  const calls = [], client = new EventEmitter(); let connects = 0, status = options.status ?? 'I';
  client.getTransactionStatus = () => status;
  client.query = async function (sql, values) {
    assert.equal(this, client); assert.deepEqual(values, databasePreparationLockKey);
    const stage = sql.includes('pg_locks') ? 'owned' : sql.includes('pg_try_advisory_lock') ? 'acquire' : 'unlock';
    calls.push(stage);
    if (options.failAt === stage) throw options.original;
    const key = stage === 'owned' ? 'owned' : stage === 'acquire' ? 'acquired' : 'unlocked';
    return { rows: [{ [key]: Object.hasOwn(options, key) ? options[key] : stage !== 'owned' }] };
  };
  client.release = function (destroy) {
    assert.equal(this, client); calls.push(destroy ? 'destroy' : 'release');
    if (Object.hasOwn(options, 'releaseFailure')) throw options.releaseFailure;
  };
  const getPoolFn = () => ({ connect: async () => { connects++; return client; } });
  return { client, calls, getPoolFn, connects: () => connects, setStatus: value => { status = value; },
    run: (work = async () => { calls.push('work'); return 'done'; }) => withDatabasePreparation({ getPoolFn }, work) };
}

test('one owned session spans nested preparation work without recursive locking and retires its listeners', async () => {
  const f = fixture(); let saved;
  assert.equal(await f.run(async preparation => {
    saved = preparation; assert.equal(preparation.client, f.client); assert.equal(Object.isFrozen(preparation), true);
    return withDatabasePreparation({ preparation, getPoolFn: () => { throw new Error('second checkout'); } }, async context => {
      assert.equal(context, preparation); f.calls.push('work'); return 'done';
    });
  }), 'done');
  assert.deepEqual(f.calls, ['owned', 'acquire', 'work', 'unlock', 'release']); assert.equal(f.connects(), 1);
  assert.equal(f.client.listenerCount('error'), 0); assert.equal(f.client.listenerCount('end'), 0);
  for (const preparation of [saved, { ...saved }, null]) {
    await assert.rejects(withDatabasePreparation({ preparation }, () => assert.fail('inactive work')), TypeError);
  }
});

test('busy or inherited ownership refuses before work and active/unknown transactions are discarded', async () => {
  const busy = fixture({ acquired: false });
  await assert.rejects(busy.run(), { code: 'database_preparation_busy' });
  assert.deepEqual(busy.calls, ['owned', 'acquire', 'release']);
  for (const owned of [true, undefined]) {
    const f = fixture({ owned }); await assert.rejects(f.run(), { code: 'database_preparation_lock_inherited' });
    assert.deepEqual(f.calls, ['owned', 'destroy']);
  }
  for (const status of ['T', 'E', null]) {
    const f = fixture(); f.setStatus(status);
    await assert.rejects(f.run(), { code: 'migration_connection_not_idle' }); assert.deepEqual(f.calls, ['destroy']);
  }
});

test('uncertain acquisition never unlocks or returns a potentially locked session to the pool', async () => {
  for (const failAt of ['owned', 'acquire']) for (const original of [new Error('lost reply'), null]) {
    const f = fixture({ failAt, original, releaseFailure: new Error('release') });
    await assert.rejects(f.run(), error => error === original);
    assert.equal(f.calls.at(-1), 'destroy'); assert.equal(f.calls.includes('unlock'), false); assert.equal(f.calls.includes('work'), false);
  }
  const f = fixture({ acquired: undefined });
  await assert.rejects(f.run(), { code: 'database_preparation_lock_unknown' });
  assert.deepEqual(f.calls, ['owned', 'acquire', 'destroy']);
});

test('primary work Error/null survives unlock and release Error/null without retry or history work', async () => {
  for (const original of [new Error('work'), null]) for (const secondary of [new Error('unlock'), null]) {
    const f = fixture({ failAt: 'unlock', original: secondary, releaseFailure: secondary });
    await assert.rejects(f.run(async () => { f.calls.push('work'); throw original; }), error => error === original);
    assert.deepEqual(f.calls, ['owned', 'acquire', 'work', 'unlock', 'destroy']);
  }
  const f = fixture(); const original = new Error('transaction failed');
  await assert.rejects(f.run(async () => { f.setStatus('E'); throw original; }), error => error === original);
  assert.deepEqual(f.calls, ['owned', 'acquire', 'destroy']);
});

test('post-work unlock Error/null or false acknowledgement is explicit ambiguity with one disposal', async () => {
  for (const options of [{ failAt: 'unlock', original: new Error('reply lost') }, { failAt: 'unlock', original: null }, { unlocked: false }]) {
    const f = fixture(options);
    await assert.rejects(f.run(), error => {
      assert.equal(error.code, 'database_preparation_unlock_unknown');
      if (options.failAt) assert.equal(error.cause, options.original);
      assert.doesNotMatch(error.message, /reply lost/u); return true;
    });
    assert.deepEqual(f.calls, ['owned', 'acquire', 'work', 'unlock', 'destroy']);
  }
});

test('connection error/end invalidates nested and outer work and discards the session without unlock', async () => {
  for (const event of ['error', 'end']) {
    const f = fixture();
    await assert.rejects(f.run(async preparation => {
      f.client.emit(event, new Error('private connection detail'));
      await assert.rejects(withDatabasePreparation({ preparation }, () => assert.fail('lost owner work')), { code: 'database_preparation_connection_unavailable' });
    }), { code: 'database_preparation_connection_unavailable' });
    assert.deepEqual(f.calls, ['owned', 'acquire', 'destroy']);
  }
});

test('composed bootstrap, migration and final observation share one captured owner until verification finishes', async () => {
  const f = fixture(); let owner;
  const stage = name => async ({ preparation }) => {
    owner ??= preparation; assert.equal(preparation, owner);
    return withDatabasePreparation({ preparation }, async () => { f.calls.push(name); return name; });
  };
  const result = await prepareDatabase({ getPoolFn: f.getPoolFn,
    bootstrapDatabaseSchemaFromSnapshotFn: stage('bootstrap'), applyPendingMigrationsFn: stage('migrate'),
    assertNoPendingMigrationsFn: async ({ queryable }) => { assert.equal(queryable, f.client); f.calls.push('verify'); return 'current'; },
  });
  assert.equal(result.status, 'current'); assert.equal(f.connects(), 1);
  assert.deepEqual(f.calls, ['owned', 'acquire', 'bootstrap', 'migrate', 'verify', 'unlock', 'release']);
});
