/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** Bounded native sort work held at a server-observed lock, not a sleep. */
export async function withDeploymentDatabaseWork(pool, work) {
  const clients = []; const tasks = []; let gate; let failure; let failed = false;
  return withWorkerTaskCleanup(async () => {
    gate = await pool.connect();
    await gate.query('SELECT pg_advisory_lock(203226, 1)');
    for (let i = 0; i < 2; i++) {
      const client = await pool.connect(); clients.push(client);
      await client.query("BEGIN; SET LOCAL application_name = 'hx_memory_work'; SET LOCAL work_mem = '8MB'; SET LOCAL max_parallel_workers_per_gather = 0; SET LOCAL statement_timeout = '30s'");
      const task = client.query(`WITH data AS MATERIALIZED (
        SELECT i, repeat(md5(i::text), 4) AS payload FROM generate_series(1, 100000) i ORDER BY payload
      ) SELECT sum(length(payload))::int AS bytes, pg_advisory_xact_lock(203226, 1) FROM data`);
      tasks.push(task); void task.catch(error => { if (!failed) { failed = true; failure = error; } });
    }
    const deadline = performance.now() + 15_000;
    let active;
    do {
      if (failed) throw failure;
      active = Number((await pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = 'hx_memory_work' AND state = 'active' AND wait_event = 'advisory'")).rows[0].count);
      if (active === 2) break;
      assert.ok(performance.now() < deadline, 'Both database statements must reach their owned lock');
      await delay(10);
    } while (active !== 2);
    return await work({ activeStatements: active });
  }, async () => {
    // Unlock before awaiting the statements. End each transaction immediately so
    // the second xact lock can advance, including after an original Error/null.
    let cleanupFailure; let cleanupFailed = false;
    const attempt = async task => { try { await task(); } catch (error) { if (!cleanupFailed) { cleanupFailed = true; cleanupFailure = error; } } };
    if (gate) await attempt(() => gate.query('SELECT pg_advisory_unlock(203226, 1)'));
    await Promise.all(clients.map(async (client, i) => {
      if (tasks[i]) await attempt(async () => { const result = await tasks[i]; assert.equal(result.rows[0].bytes, 12_800_000); });
      await attempt(() => client.query('ROLLBACK')); await attempt(() => client.release());
    }));
    gate?.release();
    if (cleanupFailed) throw cleanupFailure;
  });
}
