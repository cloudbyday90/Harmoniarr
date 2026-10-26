/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeSchemaSnapshotTransaction } from '../../src/server/schema-snapshot-transaction-service.js';

const migration = { filename: '20990101_000001_fixture.sql', migrationKey: '20990101_000001', checksum: 'fixture' };
const row = { filename: migration.filename, migration_key: migration.migrationKey, checksum: migration.checksum, status: 'applied' };
function fixture(options = {}) {
  const calls = []; let status = 'I', discarded = false;
  const client = { getTransactionStatus: () => status, async query(sql) {
    assert.equal(this, client); calls.push(sql);
    const stage = sql === 'SNAPSHOT_BODY' ? 'body' : sql.includes('SELECT filename, checksum, status') ? 'verify'
      : sql === 'BEGIN' ? 'begin' : sql === 'COMMIT' ? 'commit' : sql === 'ROLLBACK' ? 'rollback' : '';
    if (options.failAt === stage || (stage === 'rollback' && Object.hasOwn(options, 'rollbackFailure'))) {
      throw stage === 'rollback' ? options.rollbackFailure : options.original;
    }
    if (sql === 'BEGIN') status = 'T';
    if (sql === 'COMMIT' || sql === 'ROLLBACK') status = 'I';
    return { command: sql === 'COMMIT' ? (options.commitCommand ?? 'COMMIT') : sql === 'ROLLBACK' ? 'ROLLBACK' : '', rows: options.rows ?? [row] };
  } };
  return { calls, discarded: () => discarded, run: () => executeSchemaSnapshotTransaction({ client, sql: 'SNAPSHOT_BODY',
    assertSnapshotSchemaAnchorsFn: async ({ client: owned }) => {
      assert.equal(owned, client); assert.equal(status, 'T'); calls.push('ANCHORS');
      if (options.failAt === 'anchors') throw options.original;
    },
    repoMigrations: [migration], markClientUnusable: () => { discarded = true; } }) };
}

test('snapshot body and complete key/checksum/status observation precede its single acknowledged commit', async () => {
  const f = fixture(); await f.run();
  assert.deepEqual(f.calls.slice(0, 4), ['BEGIN', 'SET LOCAL standard_conforming_strings = on', 'SET LOCAL synchronous_commit = on', 'SNAPSHOT_BODY']);
  assert.match(f.calls[4], /SELECT filename, checksum, status/u); assert.equal(f.calls[5], 'ANCHORS'); assert.equal(f.calls[6], 'COMMIT');
  assert.equal(f.discarded(), false);
});

test('missing, duplicate, unknown, wrong-key/checksum or non-applied receipts roll the whole snapshot back', async () => {
  for (const rows of [[], [row, row], [{ ...row, filename: 'unknown.sql' }], [{ ...row, migration_key: 'wrong' }],
    [{ ...row, checksum: 'wrong' }], [{ ...row, status: 'failed' }]]) {
    const f = fixture({ rows }); await assert.rejects(f.run(), { code: 'snapshot_migration_state_invalid' });
    assert.equal(f.calls.at(-1), 'ROLLBACK'); assert.equal(f.calls.includes('COMMIT'), false);
    assert.equal(f.calls.some(sql => sql.includes("'failed'")), false);
  }
});

test('snapshot body/verification Error and null survive rollback Error/null without outside journal writes', async () => {
  for (const failAt of ['body', 'verify', 'anchors']) for (const original of [new Error('primary'), null]) {
    for (const secondary of [{}, { rollbackFailure: new Error('rollback') }, { rollbackFailure: null }]) {
      const f = fixture({ failAt, original, ...secondary });
      await assert.rejects(f.run(), error => error === original);
      assert.equal(f.calls.at(-1), 'ROLLBACK'); assert.equal(f.discarded(), Object.hasOwn(secondary, 'rollbackFailure'));
      assert.equal(f.calls.some(sql => /INSERT|UPDATE/u.test(sql)), false);
    }
  }
});

test('lost or unrecognized snapshot COMMIT replies discard without rollback, journal or retry', async () => {
  for (const options of [{ failAt: 'commit', original: new Error('lost reply') }, { failAt: 'commit', original: null }, { commitCommand: 'unexpected' }]) {
    const f = fixture(options); await assert.rejects(f.run(), error => {
      assert.equal(error.code, 'snapshot_commit_outcome_unknown');
      if (options.failAt) assert.equal(error.cause, options.original);
      assert.ok(error.message.length < 250); return true;
    });
    assert.equal(f.calls.at(-1), 'COMMIT'); assert.equal(f.discarded(), true);
  }
});

test('failed BEGIN and acknowledged COMMIT rollback never count as snapshot success', async () => {
  const original = new Error('begin failed'), start = fixture({ failAt: 'begin', original });
  await assert.rejects(start.run(), error => error === original); assert.deepEqual(start.calls, ['BEGIN']); assert.equal(start.discarded(), true);
  const rollback = fixture({ commitCommand: 'ROLLBACK' });
  await assert.rejects(rollback.run(), { code: 'snapshot_commit_rolled_back' }); assert.equal(rollback.calls.at(-1), 'COMMIT');
});
