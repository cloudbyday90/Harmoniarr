/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { before, after, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createOperationQueueDispatcher } from '../../src/server/operation-queue-dispatcher.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { createStartupServiceSupervisor } from '../../src/server/startup-service-supervisor.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createImportCandidateApplyRunStore } from '../../src/server/import-candidates/import-candidate-apply-run-store.js';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Dispatcher native claim and returned apply completion ownership', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const fails of [false, true]) {
    test(`committed claim hands off after closure and drains actual lease release${fails ? ' retaining a null finalizer failure' : ''}`, {
      timeout: config.scenarioTimeoutMs,
    }, async t => {
      await postgres.runIsolatedDatabase(async ({ getPoolFn }) => {
        await applyPendingMigrations({ getPoolFn });
        const claimReady = createFixtureGate({ signal: t.signal }); const deliverClaim = createFixtureGate({ signal: t.signal });
        const releasing = createFixtureGate({ signal: t.signal }); const releaseLease = createFixtureGate({ signal: t.signal });
        const store = createImportCandidateApplyRunStore({ getPoolFn });
        const queued = await store.createOperationRun({ requestedCandidateCount: 0 });
        const next = await store.createOperationRun({ requestedCandidateCount: 0 });
        let finalized = false; let claims = 0; let teardown = false;
        const worker = createImportCandidateApplyWorker({ acquireLease: store.acquireLease,
          markRunStarted: store.markRunStarted, markRunCompleted: store.markRunCompleted, markRunFailed: store.markRunFailed,
          releaseLease: async input => {
            releasing.release(); await releaseLease.promise; await store.releaseLease(input); finalized = true;
            if (fails) throw null;
          } });
        const queue = createOperationQueueStore({ getPoolFn });
        const dispatcher = createOperationQueueDispatcher({
          handlers: createOperationQueueHandlers({ importCandidateModule: { importCandidateApplyWorker: worker } }),
          operationQueueStore: { claimNextRunnableRun: async input => {
            claims++; const run = await queue.claimNextRunnableRun(input);
            claimReady.release(); await deliverClaim.promise; return run;
          } },
          onError: async error => { assert.equal(error, null); throw new Error('secondary reporter'); },
        });
        const supervisor = createStartupServiceSupervisor({ processEmitter: new EventEmitter() });
        supervisor.registerService(dispatcher);
        const tick = dispatcher.tick();
        await waitForFixtureReady({ ready: claimReady.promise, operation: tick, signal: t.signal });
        const closing = supervisor.shutdown({ onShutdown: async () => {
          await worker.close(); assert.equal(finalized, true); teardown = true;
        } });
        void closing.catch(() => {});
        try {
          const admitted = (await getPoolFn().query('SELECT attempt_count,claimed_at FROM operation_runs WHERE id=$1', [queued.id])).rows[0];
          assert.equal(admitted.attempt_count, 1); assert.notEqual(admitted.claimed_at, null);
          assert.deepEqual(await dispatcher.tick(), { reason: 'stopped', skipped: true });
          deliverClaim.release();
          await waitForFixtureReady({ ready: releasing.promise, operation: closing, signal: t.signal });
          assert.equal((await store.getRunById(queued.id)).status, 'completed');
          assert.equal(finalized, false); assert.equal(teardown, false); assert.equal(getPoolFn().ending, false);
          const pending = (await getPoolFn().query('SELECT status,attempt_count,claimed_at FROM operation_runs WHERE id=$1', [next.id])).rows[0];
          assert.equal(pending.status, 'pending'); assert.equal(pending.attempt_count, 0); assert.equal(pending.claimed_at, null);
          releaseLease.release();
          if (fails) await assert.rejects(closing, error => error === null);
          else await closing;
          assert.equal(finalized, true); assert.equal(teardown, !fails); assert.equal(claims, 1);
          assert.equal((await tick).claimedCount, 1);
        } finally {
          deliverClaim.release(); releaseLease.release();
          await tick.catch(() => {}); await closing.catch(() => {}); await worker.close().catch(() => {});
        }
      }, { signal: t.signal });
    });
  }

  test('closure during native readiness leaves queued command unclaimed', { timeout: config.scenarioTimeoutMs }, async t => {
    await postgres.runIsolatedDatabase(async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });
      const queued = await createImportCandidateApplyRunStore({ getPoolFn }).createOperationRun({ requestedCandidateCount: 0 });
      const ready = createFixtureGate({ signal: t.signal }); const hold = createFixtureGate({ signal: t.signal });
      const queue = createOperationQueueStore({ getPoolFn }); let claims = 0;
      const dispatcher = createOperationQueueDispatcher({
        handlers: { import_candidate_apply: async () => assert.fail('Closed admission launched a worker') },
        dispatchPauseService: { resolveDispatchReadiness: async () => { await getPoolFn().query('SELECT 1'); ready.release(); await hold.promise; return { allowed: true }; } },
        operationQueueStore: { claimNextRunnableRun: async input => { claims++; return queue.claimNextRunnableRun(input); } },
      });
      const tick = dispatcher.tick();
      await waitForFixtureReady({ ready: ready.promise, operation: tick, signal: t.signal });
      const closing = dispatcher.stopAndDrain();
      try {
        assert.equal(getPoolFn().ending, false); hold.release(); await tick; await closing;
        const row = (await getPoolFn().query('SELECT attempt_count,claimed_at FROM operation_runs WHERE id=$1', [queued.id])).rows[0];
        assert.equal(claims, 0); assert.equal(row.attempt_count, 0); assert.equal(row.claimed_at, null);
      } finally { hold.release(); await tick.catch(() => {}); await closing.catch(() => {}); }
    }, { signal: t.signal });
  });
});
