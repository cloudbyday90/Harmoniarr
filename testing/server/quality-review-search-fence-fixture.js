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
async function observeWait(observer, blockerPid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting', [blockerPid])).rows[0].waiting) return;
    await delay(10);
  }
  assert.fail('Expected an observed database lock wait');
}

/** Owned disposable database only; qualifies the fence, not application authority. */
export async function qualifyQualityReviewSearchFences({ pool }) {
  const store = createImportCandidateSearchRevisionStore({ getPoolFn: () => pool });
  const sourceSearchId = 'restart-fence-fixture';
  await pool.query(`INSERT INTO import_candidates(id,source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
    SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'fence-fixture',$1,n::text,'fixture','/fixture',
      CASE WHEN n=1 THEN 'failed' ELSE 'pending' END,'{}','{}',NOW() FROM generate_series(1,2) n`, [sourceSearchId]);
  const command = await pool.connect(); const writer = await pool.connect(); const observer = new pg.Client(pool.options);
  let pending;
  try {
    await observer.connect();
    const commandPid = (await command.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const before = await store.readRevision({ sourceSearchId, queryable: observer });
    await command.query('BEGIN'); await command.query("SET LOCAL statement_timeout='15s'");
    await command.query('SELECT id FROM import_candidates WHERE id=$1 FOR UPDATE', [id(1)]);
    await writer.query('BEGIN'); await writer.query("SET LOCAL statement_timeout='15s'");
    await writer.query("UPDATE import_candidates SET status='held' WHERE id=$1", [id(2)]);
    pending = writer.query('UPDATE import_candidates SET updated_at=NOW() WHERE id=$1', [id(1)]).then(() => null, error => error);
    await observeWait(observer, commandPid);
    await assert.rejects(store.lockRevisionNowait({ sourceSearchId, queryable: command }), { code: '55P03' });
    await command.query('ROLLBACK'); assert.equal(await pending, null); await writer.query('COMMIT');
    assert.notEqual(await store.readRevision({ sourceSearchId, queryable: observer }), before);

    // A writer already inserting candidate data waits at its AFTER trigger;
    // the successful fence orders its commit after command commit.
    await command.query('BEGIN'); await command.query("SET LOCAL statement_timeout='15s'");
    await command.query('SELECT id FROM import_candidates WHERE id=$1 FOR UPDATE', [id(1)]);
    const fenced = await store.lockRevisionNowait({ sourceSearchId, queryable: command });
    await writer.query('BEGIN'); await writer.query("SET LOCAL statement_timeout='15s'");
    pending = writer.query(`INSERT INTO import_candidates(id,source_provider,source_search_id,source_response_key,username,folder_path,raw_payload,normalized_payload,discovered_at)
      VALUES($1,'fence-fixture',$2,'3','fixture','/fixture','{}','{}',NOW())`, [id(3), sourceSearchId]).then(() => null, error => error);
    await observeWait(observer, commandPid);
    assert.equal(await store.readRevision({ sourceSearchId, queryable: observer }), fenced);
    assert.equal((await observer.query('SELECT count(*)::int AS count FROM import_candidates WHERE id=$1', [id(3)])).rows[0].count, 0);
    await command.query('COMMIT'); assert.equal(await pending, null); await writer.query('COMMIT');
    assert.notEqual(await store.readRevision({ sourceSearchId, queryable: observer }), fenced);
    assert.equal((await observer.query('SELECT count(*)::int AS count FROM import_candidates WHERE id=$1', [id(3)])).rows[0].count, 1);
    return { version: (await observer.query('SHOW server_version')).rows[0].server_version,
      observedWriterWaitingForCandidate: true, inversionRefusedNowait: true, observedInsertWaitingForFence: true,
      insertCommittedAfterFenceRelease: true };
  } finally {
    await command.query('ROLLBACK'); await writer.query('ROLLBACK'); await pending;
    command.release(); writer.release(); await observer.end();
    await pool.query('DELETE FROM import_candidates WHERE source_search_id=$1', [sourceSearchId]);
  }
}
