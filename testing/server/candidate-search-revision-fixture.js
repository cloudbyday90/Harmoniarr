/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createImportCandidateSearchRevisionStore } from '../../src/server/import-candidates/import-candidate-search-revision-store.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const table = 'import_candidate_search_revisions';
const update = (client, n, status = 'held') => client.query('UPDATE import_candidates SET status=$2 WHERE id=$1', [id(n), status]);
async function waitForBlock(observer, blockerPid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting', [blockerPid])).rows[0].waiting) return;
    await delay(10);
  }
  assert.fail('Expected an observed PostgreSQL lock wait');
}

/** Owned disposable database only. Shared by host and packaged PostgreSQL lanes. */
export async function qualifyCandidateSearchRevisions({ pool }) {
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM import_candidates')).rows[0].count, 0);
  const store = createImportCandidateSearchRevisionStore({ getPoolFn: () => pool });
  const revision = (sourceSearchId, queryable) => store.readRevision({ sourceSearchId, queryable });
  await pool.query(`INSERT INTO import_candidates(id,source_provider,source_search_id,source_response_key,username,folder_path,raw_payload,normalized_payload,discovered_at)
    SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'revision-fixture',
      CASE WHEN n<3 THEN 'revision-a' ELSE 'revision-b' END,n::text,'fixture','/fixture','{}','{}',NOW() FROM generate_series(1,4) n`);
  const initialA = await revision('revision-a'); const initialB = await revision('revision-b');
  assert.ok(initialA); assert.ok(initialB); assert.notEqual(initialA, initialB);
  await pool.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,raw_payload,normalized_payload,discovered_at)
    VALUES('revision-fixture','revision-a','1','fixture','/fixture','{}','{"extensions":["flac"]}',NOW())
    ON CONFLICT(source_provider,source_search_id,source_response_key) DO UPDATE SET normalized_payload=EXCLUDED.normalized_payload`);
  assert.notEqual(await revision('revision-a'), initialA); assert.equal(await revision('revision-b'), initialB);
  const beforeMove = await revision('revision-a');
  await pool.query("UPDATE import_candidates SET source_search_id='revision-c' WHERE id=$1", [id(4)]);
  assert.notEqual(await revision('revision-b'), initialB); assert.ok(await revision('revision-c'));
  assert.equal(await revision('revision-a'), beforeMove);
  const noRows = await revision('revision-a');
  await pool.query("UPDATE import_candidates SET status='held' WHERE false"); assert.equal(await revision('revision-a'), noRows);

  const first = await pool.connect(); const second = await pool.connect(); const observer = new pg.Client(pool.options);
  let pending;
  try {
    await observer.connect();
    await first.query('BEGIN'); await second.query('BEGIN');
    await first.query("SET LOCAL statement_timeout='15s'"); await second.query("SET LOCAL statement_timeout='15s'");
    const pid = (await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await update(first, 1);
    assert.notEqual(await revision('revision-a', first), noRows);
    assert.equal(await revision('revision-a', observer), noRows, 'Uncommitted writer revisions stay invisible without blocking readers');
    pending = update(second, 2).then(() => null, error => error);
    await waitForBlock(observer, pid); await first.query('ROLLBACK');
    assert.equal(await pending, null); await second.query('COMMIT');
    assert.notEqual(await revision('revision-a', observer), noRows, 'A waiting writer publishes its own revision after predecessor rollback');
    assert.equal((await observer.query('SELECT status FROM import_candidates WHERE id=$1', [id(1)])).rows[0].status, 'pending');
    const beforeCycle = await revision('revision-a', observer);
    await first.query('BEGIN'); await second.query('BEGIN');
    await first.query("SET LOCAL statement_timeout='15s'"); await second.query("SET LOCAL statement_timeout='15s'");
    await second.query('SELECT id FROM import_candidates WHERE id=$1 FOR UPDATE', [id(2)]);
    await update(first, 1);
    const blocked = update(second, 2, 'pending').then(() => ({ side: 'second', error: null }), error => ({ side: 'second', error }));
    pending = blocked;
    await waitForBlock(observer, pid);
    const inverted = update(first, 2, 'pending').then(() => ({ side: 'first', error: null }), error => ({ side: 'first', error }));
    const loser = await Promise.race([blocked, inverted]);
    assert.equal(loser.error?.code, '40P01', 'Prelocked candidate/revision inversion must abort rather than publish partial state');
    await (loser.side === 'first' ? first : second).query('ROLLBACK');
    const outcomes = await Promise.all([blocked, inverted]);
    assert.equal(outcomes.filter(result => result.error?.code === '40P01').length, 1);
    await first.query('ROLLBACK'); await second.query('ROLLBACK');
    assert.equal(await revision('revision-a', observer), beforeCycle, 'Rolling back both transactions preserves the committed revision');
  } finally {
    await first.query('ROLLBACK'); await second.query('ROLLBACK'); await pending;
    first.release(); second.release(); await observer.end();
  }

  const beforeDelete = await revision('revision-c');
  await pool.query('DELETE FROM import_candidates WHERE id=$1', [id(4)]);
  assert.notEqual(await revision('revision-c'), beforeDelete, 'Deletion retains a changed tombstone revision');
  const client = await pool.connect();
  const beforeTruncate = await revision('revision-a');
  try {
    await client.query('BEGIN'); await client.query('TRUNCATE import_candidates CASCADE');
    assert.notEqual(await revision('revision-a', client), beforeTruncate); await client.query('ROLLBACK');
  } finally { await client.query('ROLLBACK'); client.release(); }
  assert.equal(await revision('revision-a'), beforeTruncate);
  await pool.query('TRUNCATE import_candidates CASCADE');
  assert.notEqual(await revision('revision-a'), beforeTruncate);
  assert.equal((await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE source_search_id LIKE 'revision-%'`)).rows[0].count, 3);
  return { version: (await pool.query('SHOW server_version')).rows[0].server_version,
    insertUpsertMoveDeleteTruncate: true, zeroRowsStable: true, rollback: true, observedWriterWait: true,
    observedInversionAbort: true, nonblockingCommittedReads: true };
}
