/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, suite, test } from 'node:test';
import { withFixturePostgresObserver } from '../integration/fixture-postgres-observer.js';
import { waitForFixturePostgresBlock } from '../integration/fixture-lock-observer.js';
import { waitForFixtureReady } from '../integration/fixture-lifecycle.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createSourceUserSpectralJobStore } from '../../src/server/activity/source-user-spectral-job-store.js';

export function registerSpectralAdmissionTests({ config, createRuntime }) {
  let runtime;
  const input = { username: 'fixture-peer', filePath: '/fixture/source.flac' };
  const retro = libraryFileId => ({ files: [{ libraryFileId, filePath: input.filePath }] });
  const enqueue = (store, kind, fileId) => kind === 'apply'
    ? store.enqueueSpectralJob(input) : store.enqueueRetroactiveLibraryJobs(retro(fileId));
  const admitted = result => Number(result.enqueued);

  async function fixture(work) {
    return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseConfig }) => {
      await applyPendingMigrations({ getPoolFn });
      const pool = getPoolFn();
      await work({ pool, getPoolFn, databaseConfig,
        store: cap => createSourceUserSpectralJobStore({ getPoolFn, maxBacklog: cap }),
        rows: async () => (await pool.query('SELECT * FROM source_user_spectral_jobs ORDER BY created_at')).rows });
    });
  }

  /** Gate the actual INSERT result while its admission transaction still owns commit. */
  function heldProducer(pool, { maxBacklog, failure, fail = false, repeatableDefault = false } = {}) {
    const entered = Promise.withResolvers();
    const gate = Promise.withResolvers();
    let pid;
    const getPoolFn = () => ({ connect: async () => {
      const client = await pool.connect();
      try {
        pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        if (repeatableDefault) await client.query("SET default_transaction_isolation = 'repeatable read'");
      } catch (error) { client.release(error); throw error; }
      return {
        release: error => client.release(error),
        query: async (...args) => {
          const result = await client.query(...args);
          if (args[0].startsWith('INSERT INTO source_user_spectral_jobs')) {
            assert.equal((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation, 'read committed');
            entered.resolve();
            await gate.promise;
            if (fail) throw failure;
          }
          return result;
        },
      };
    } });
    return { store: createSourceUserSpectralJobStore({ getPoolFn, maxBacklog }),
      entered: entered.promise, release: () => gate.resolve(), pid: () => pid };
  }

  async function contend(c, t, { firstKind, secondKind, cap, duplicate = false, rollback = false, failure } = {}) {
    const first = heldProducer(c.pool, { maxBacklog: cap, fail: rollback, failure, repeatableDefault: true });
    const fileId = randomUUID();
    const task = enqueue(first.store, firstKind, fileId);
    const firstOutcome = task.then(value => ({ value }), error => ({ error }));
    let other;
    try {
      await waitForFixtureReady({ ready: first.entered, operation: task, signal: t.signal });
      const secondProducer = heldProducer(c.pool, { maxBacklog: cap, repeatableDefault: true });
      secondProducer.release();
      other = enqueue(secondProducer.store, secondKind, duplicate ? fileId : randomUUID());
      other.catch(() => {});
      await withFixturePostgresObserver({ connectionConfig: c.databaseConfig, signal: t.signal }, async observer => {
        await waitForFixturePostgresBlock({ queryable: observer, holderPid: first.pid(), operation: other, signal: t.signal });
        assert.equal((await observer.query('SELECT COUNT(*)::int AS count FROM source_user_spectral_jobs')).rows[0].count, 0);
      });
      first.release();
      const outcome = await firstOutcome;
      if (rollback) assert.equal(outcome.error, failure);
      else assert.equal(admitted(outcome.value), 1);
      const second = await other;
      assert.equal(admitted(second), rollback ? 1 : 0);
      assert.equal((await c.rows()).length, 1);
      if (secondKind === 'apply' && !rollback) assert.equal(second.reason, 'backlog_full');
    } finally {
      first.release();
      await Promise.allSettled([task, other]);
    }
  }

  suite('transactional spectral queue admission in real PostgreSQL', () => {
    before(async () => { runtime = await createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
    after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

    for (const [firstKind, secondKind] of [['apply', 'apply'], ['apply', 'retroactive'], ['retroactive', 'apply'], ['retroactive', 'retroactive']]) {
      test(`${firstKind}/${secondKind} serialize the last backlog slot`, { timeout: config.scenarioTimeoutMs }, async t =>
        fixture(c => contend(c, t, { firstKind, secondKind, cap: 1 })));
    }

    test('retroactive contenders deduplicate one UUID even with spare capacity', { timeout: config.scenarioTimeoutMs }, async t =>
      fixture(c => contend(c, t, { firstKind: 'retroactive', secondKind: 'retroactive', cap: 10, duplicate: true })));

    for (const failure of [new Error('owned insertion failure'), null]) {
      test(`rollback releases capacity and duplicate admission after ${failure === null ? 'null' : 'Error'}`, { timeout: config.scenarioTimeoutMs }, async t =>
        fixture(c => contend(c, t, { firstKind: 'retroactive', secondKind: 'retroactive', cap: 1, duplicate: true, rollback: true, failure })));
    }

    test('active jobs count, terminal history permits re-admission and apply work remains independent', { timeout: config.scenarioTimeoutMs }, async () => fixture(async c => {
      const store = c.store(2);
      assert.equal((await store.enqueueSpectralJob(input)).enqueued, true);
      assert.equal((await store.enqueueSpectralJob(input)).enqueued, true);
      const claims = await store.claimNextSpectralJobs();
      assert.equal(claims.length, 2);
      assert.equal((await store.enqueueSpectralJob(input)).reason, 'backlog_full');
      await store.completeSpectralJob({ id: claims[0].id, expectedClaim: claims[0] });
      await store.failSpectralJob({ id: claims[1].id, expectedClaim: claims[1], maxAttempts: 1 });
      const fileId = randomUUID();
      assert.equal((await store.enqueueRetroactiveLibraryJobs(retro(fileId))).enqueued, 1);
      const [job] = await store.claimNextSpectralJobs();
      assert.equal((await store.enqueueRetroactiveLibraryJobs(retro(fileId))).skipped, 1);
      await store.completeSpectralJob({ id: job.id, expectedClaim: job });
      assert.equal((await store.enqueueRetroactiveLibraryJobs(retro(fileId))).enqueued, 1);
      assert.equal(await store.countPendingSpectralJobs(), 1);
    }));

    test('retroactive files commit independently before a later SQL failure', { timeout: config.scenarioTimeoutMs }, async () => fixture(async c => {
      const fileId = randomUUID();
      await assert.rejects(c.store(10).enqueueRetroactiveLibraryJobs({ files: [
        ...retro(fileId).files, { libraryFileId: 'invalid-uuid', filePath: input.filePath },
      ] }), { code: '22P02' });
      assert.equal((await c.rows()).length, 1);
      assert.equal((await c.rows())[0].library_file_id, fileId);
      assert.equal((await c.store(10).enqueueSpectralJob(input)).enqueued, true);
    }));

    test('held admission permits worker progress and bounded lock refusal publishes no second job', { timeout: config.scenarioTimeoutMs }, async t => fixture(async c => {
      const existing = await c.store(10).enqueueSpectralJob(input);
      const first = heldProducer(c.pool, { maxBacklog: 10 });
      const task = first.store.enqueueSpectralJob(input);
      let other;
      try {
        await waitForFixtureReady({ ready: first.entered, operation: task, signal: t.signal });
        const [claim] = await c.store(10).claimNextSpectralJobs();
        assert.equal(claim.id, existing.job.id);
        assert.equal(claim.state, 'active');
        other = c.store(10).enqueueSpectralJob(input);
        const refused = assert.rejects(other, { code: '55P03' });
        await withFixturePostgresObserver({ connectionConfig: c.databaseConfig, signal: t.signal }, observer =>
          waitForFixturePostgresBlock({ queryable: observer, holderPid: first.pid(), operation: other, signal: t.signal }));
        await refused;
        assert.equal((await c.rows()).length, 1);
        first.release();
        assert.equal((await task).enqueued, true);
        assert.equal((await c.rows()).length, 2);
        assert.equal((await c.store(10).enqueueSpectralJob(input)).enqueued, true);
      } finally { first.release(); await Promise.allSettled([task, other]); }
    }));
  });
}
