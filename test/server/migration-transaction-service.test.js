/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeMigrationTransaction } from '../../src/server/migration-transaction-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withPreparationLockFixture } from '../../testing/server/preparation-lock-fixture.js';

const migration = { filename: '20260101_000001_fixture.sql', migrationKey: '20260101_000001', checksum: 'fixture', sql: 'SELECT 1' };
function fixture(options = {}) {
  const { failAt, original, rollbackFailure, journalFailure, commitCommand = 'COMMIT', rowCount = 1 } = options;
  const calls = []; let discarded = false, status = 'I';
  const client = { getTransactionStatus: () => status, async query(sql) {
    assert.equal(this, client); calls.push(sql);
    const stage = sql === 'BEGIN' ? 'begin' : sql === 'SELECT 1' ? 'body' : sql === 'COMMIT' ? 'commit'
      : sql.includes("status='applied'") ? 'receipt' : null;
    if (stage && failAt === stage) throw original;
    if (sql === 'ROLLBACK' && Object.hasOwn(options, 'rollbackFailure')) throw rollbackFailure;
    if (sql.includes("'failed'") && Object.hasOwn(options, 'journalFailure')) throw journalFailure;
    if (sql === 'BEGIN') status = 'T';
    if (sql === 'COMMIT' || sql === 'ROLLBACK') status = 'I';
    return { command: sql === 'COMMIT' ? commitCommand : sql === 'ROLLBACK' ? 'ROLLBACK' : null, rowCount, rows: [] };
  } };
  withPreparationLockFixture(client);
  return { calls, client, discarded: () => discarded, run: () => executeMigrationTransaction({
    client, migration, sql: migration.sql, markClientUnusable: () => { discarded = true; },
  }) };
}
test('one transaction owns body SQL and its checked applied receipt before acknowledged COMMIT', async () => {
  const f = fixture(); await f.run();
  assert.equal(f.calls[0], 'BEGIN'); assert.equal(f.calls.at(-1), 'COMMIT');
  assert.ok(f.calls.indexOf('SELECT 1') < f.calls.findIndex(sql => sql.includes("status='applied'")));
  assert.equal(f.calls.some(sql => sql.includes("'failed'")), false); assert.equal(f.discarded(), false);
});
test('body/receipt Error and null survive rollback and journal failures without committing', async () => {
  for (const failAt of ['body', 'receipt']) for (const original of [new Error('primary'), null]) {
    for (const secondary of [{}, { rollbackFailure: new Error('rollback') }, { rollbackFailure: null },
      { journalFailure: new Error('journal') }, { journalFailure: null }]) {
      const f = fixture({ failAt, original, ...secondary });
      await assert.rejects(f.run(), error => error === original);
      assert.equal(f.calls.includes('COMMIT'), false);
      if (Object.hasOwn(secondary, 'rollbackFailure')) assert.equal(f.calls.some(sql => sql.includes("'failed'")), false);
      assert.equal(f.discarded(), Object.keys(secondary).length > 0);
    }
  }
});
test('COMMIT Error/null or an unrecognized acknowledgement are uncertain and never authorize rollback or failed history', async () => {
  for (const options of [{ failAt: 'commit', original: new Error('lost acknowledgement') }, { failAt: 'commit', original: null }, { commitCommand: undefined }]) {
    const f = fixture(options.commitCommand === undefined && !options.failAt ? { commitCommand: 'unexpected' } : options);
    await assert.rejects(f.run(), error => {
      assert.equal(error.code, 'migration_commit_outcome_unknown');
      if (options.failAt) assert.equal(error.cause, options.original);
      assert.ok(error.message.length < 250); return true;
    });
    assert.equal(f.discarded(), true); assert.equal(f.calls.at(-1), 'COMMIT');
  }
});
test('an acknowledged COMMIT rollback and a missing applied receipt cannot count as success', async () => {
  const rolled = fixture({ commitCommand: 'ROLLBACK' });
  await assert.rejects(rolled.run(), { code: 'migration_commit_rolled_back' });
  assert.equal(rolled.calls.some(sql => sql.includes("'failed'")), true);
  const missing = fixture({ rowCount: 0 });
  await assert.rejects(missing.run(), { code: 'migration_receipt_missing' });
  assert.equal(missing.calls.includes('COMMIT'), false);
});
test('failed BEGIN acknowledgement discards its connection without SQL, rollback or journal work', async () => {
  const original = new Error('begin lost'); const f = fixture({ failAt: 'begin', original });
  await assert.rejects(f.run(), error => error === original);
  assert.deepEqual(f.calls, ['BEGIN']); assert.equal(f.discarded(), true);
});
test('unsupported SQL refuses the whole pending plan before preparation DDL', async () => {
  const calls = [];
  await assert.rejects(applyPendingMigrations({ loadMigrationManifestFn: async () => [migration,
    { ...migration, filename: '20260101_000002_fixture.sql', migrationKey: '20260101_000002', sql: 'COMMIT;' }],
    getPoolFn: () => ({ connect: async () => withPreparationLockFixture({ getTransactionStatus: () => 'I', query: async sql => { calls.push(sql); return { rows: [{ ledger_present: false, relation_count: 0 }] }; }, release() { calls.push('release'); } }) }),
  }), { code: 'migration_sql_transaction_invalid' });
  assert.equal(calls.length, 2); assert.equal(calls[1], 'release');
});

test('borrowed active, aborted or unknown transaction state is refused without queries', async () => {
  for (const status of ['T', 'E', null]) {
    const f = fixture(); f.client.getTransactionStatus = () => status;
    await assert.rejects(f.run(), { code: 'migration_connection_not_idle' });
    assert.deepEqual(f.calls, []); assert.equal(f.discarded(), true);
  }
});

test('release Error/null after an acknowledged commit cannot cause rollback or failed-history writes', async () => {
  for (const original of [new Error('release failed'), null]) {
    const f = fixture(); const query = f.client.query;
    f.client.query = async function (sql) {
      if (sql.includes('pg_catalog.pg_class')) return { rows: [{ ledger_present: false, relation_count: 0 }] };
      return query.call(this, sql);
    };
    f.client.release = () => { throw original; };
    await assert.rejects(applyPendingMigrations({ getPoolFn: () => ({ connect: async () => f.client }),
      loadMigrationManifestFn: async () => [migration] }), error => error === original);
    assert.equal(f.calls.at(-1), 'COMMIT');
    assert.equal(f.calls.some(sql => sql === 'ROLLBACK' || sql.includes("'failed'")), false);
  }
});
