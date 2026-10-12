/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import pg from 'pg';
import { getPool } from '../../src/server/database.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';
import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { runParallelTasksAndDrain } from '../../src/server/parallel-task-drain.js';
import { readOperatorReconciliationLifetimeState, seedOperatorReconciliationLifetimeRun } from '../../testing/integration/operator-reconciliation-lifetime-fixture.js';
import { mutateReconciliationAuthority, saveNewOperatorPolicy, seedSecondReconciliationRelease } from '../../testing/integration/operator-reconciliation-authority-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Operator reconciliation transaction-owned publication authority', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  const scenario = run => withIntegrationApp({ config, run,
    withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });
  async function start(fixture, materializer, workerOverrides = {}) {
    const execution = createOperatorArtistReconciliationExecutionService({ operatorArtistReconciliationRequestService: materializer });
    const worker = createOperatorArtistReconciliationWorker({ ...createOperatorArtistReconciliationRunStore(), executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation, ...workerOverrides });
    const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['operator_artist_reconciliation'] }); assert.equal(claimed.id, fixture.run.id);
    const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id }); const closing = worker.close(); void closing.catch(() => {});
    return { completion, closing };
  }
  for (const kind of ['save', 'monitoring', 'selection', 'override', 'catalog', 'replacement', 'expired', 'cancelled', 'disabled', 'scope']) {
    test(`${kind} changed after planning refuses request publication`, { timeout: config.scenarioTimeoutMs }, async t => {
      await scenario(async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun(); const gate = createFixtureGate({ signal: t.signal }); const entered = createFixtureGate({ signal: t.signal });
        const requests = createOperatorArtistReconciliationRequestService(); let captured; let replacement;
        const active = await start(fixture, { materializeDesiredReleaseRequests: async input => { captured = input; entered.release(); await gate.promise; return requests.materializeDesiredReleaseRequests(input); } });
        try {
          await waitForFixtureReady({ ready: entered.promise, operation: active.completion, signal: t.signal });
          assert.equal(captured.desiredReleases.filter(release => release.eligibleForDownstreamWork).length, 1);
          replacement = await mutateReconciliationAuthority(kind, fixture); gate.release(); await active.completion; await active.closing;
          const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(state.requests.length, 0); assert.equal(state.events.length, 0);
          if (kind === 'cancelled') assert.equal(state.operation.status, 'cancelled');
          else if (!['replacement', 'expired', 'scope'].includes(kind)) {
            assert.equal(state.operation.status, 'failed'); assert.equal(state.operation.error_message, 'Saved artist policy or catalog changed before request publication');
          }
          if (kind === 'save') {
            const followUp = await createOperatorArtistReconciliationRunStore().getPendingRunByOperatorArtist({ appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId });
            assert.equal(followUp.snapshotRevision, fixture.snapshot.snapshotRevision + 1);
          }
          if (kind === 'replacement') {
            assert.notEqual(replacement.acquisitionId, captured.workerContext.expectedLease.acquisitionId);
            const lease = (await getPool().query('SELECT acquisition_id,released_at FROM job_leases WHERE lease_key=$1', [replacement.leaseKey])).rows[0];
            assert.equal(lease.acquisition_id, replacement.acquisitionId); assert.equal(lease.released_at, null);
          }
        } finally { gate.release(); await active.completion.catch(() => {}); await active.closing.catch(() => {}); }
      });
    });
  }
  for (const failure of ['expiry', 'event_null']) {
    test(`${failure} after request/event insertion rolls back both rows`, { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun(); const media = createLibraryMediaRequestStore(); let inserted = false; let discovered = false;
        const requests = createOperatorArtistReconciliationRequestService({ insertMediaRequestEvent: async input => {
          await media.insertMediaRequestEvent(input); inserted = true;
          if (failure === 'event_null') throw null;
          // Await the actual SQL clock expiry on the owned client, after both inserts.
          await input.queryable.query(`SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM expires_at-clock_timestamp())+0.01))
            FROM job_leases WHERE lease_key=$1`, [`operator_artist_reconciliation:${fixture.run.id}`]);
        }, reconcileDiscoveryRequests: async () => { discovered = true; } });
        const runStore = createOperatorArtistReconciliationRunStore();
        const active = await start(fixture, requests, failure === 'expiry' ? { renewLease: undefined, acquireLease: async input => {
          const lease = await runStore.acquireLease(input);
          await getPool().query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '5 seconds' WHERE lease_key=$1", [lease.leaseKey]);
          return lease;
        } } : {}); await active.completion; await active.closing;
        const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(inserted, true); assert.equal(discovered, false);
        assert.equal(state.requests.length, 0); assert.equal(state.events.length, 0);
        if (failure === 'event_null') assert.equal(state.operation.error_message, 'Operator artist reconciliation failed');
      });
    });
  }
  test('a later stale release preserves the first committed request/event and reconciles its discovery', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const second = await seedSecondReconciliationRelease(fixture);
      const transaction = createDatabaseTransactionRunner(); const discovery = createLibraryDiscoveryRequestService(); let committed = 0; let discoveryCalls = 0;
      const requests = createOperatorArtistReconciliationRequestService({ withTransaction: async work => {
        const result = await transaction(work); committed++;
        if (committed === 1) await saveNewOperatorPolicy(fixture);
        return result;
      }, reconcileDiscoveryRequests: async () => { discoveryCalls++; await discovery.reconcileDiscoveryRequests(); } });
      const active = await start(fixture, requests); await active.completion; await active.closing;
      const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(state.operation.status, 'failed');
      assert.equal(committed, 1); assert.equal(state.requests.length, 1); assert.equal(state.events.length, 1); assert.equal(state.discovery.length, 1); assert.equal(discoveryCalls, 1);
      assert.notEqual(state.requests[0].matched_metadata_release_id, second.id); assert.equal(state.events[0].media_request_id, state.requests[0].id);
      assert.equal(state.requests[0].evidence.operatorArtistReconciliation.snapshotId, fixture.snapshot.id);
    });
  });
  test('canonical save waits for publication without reversing the save/run/lease lock order', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(async ({ databaseConfig }) => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const media = createLibraryMediaRequestStore();
      const gate = createFixtureGate({ signal: t.signal }); const entered = createFixtureGate({ signal: t.signal }); let holderPid; let saved;
      const requests = createOperatorArtistReconciliationRequestService({ insertMediaRequestEvent: async input => {
        await media.insertMediaRequestEvent(input); holderPid = (await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        entered.release(); await gate.promise;
      } });
      const active = await start(fixture, requests);
      const observer = new pg.Client(databaseConfig);
      try {
        await observer.connect();
        await waitForFixtureReady({ ready: entered.promise, operation: active.completion, signal: t.signal });
        saved = saveNewOperatorPolicy(fixture); void saved.catch(() => {});
        await waitForFixturePostgresBlock({ queryable: observer, holderPid, operation: saved, signal: t.signal });
        assert.equal((await observer.query('SELECT id FROM media_requests')).rowCount, 0);
        gate.release(); await active.completion; await active.closing; await saved;
        const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(state.requests.length, 1); assert.equal(state.events.length, 1);
        assert.equal(state.requests[0].evidence.operatorArtistReconciliation.snapshotRevision, fixture.snapshot.snapshotRevision);
        assert.equal((await createOperatorArtistReconciliationRunStore().getPendingRunByOperatorArtist({ appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId })).snapshotRevision, fixture.snapshot.snapshotRevision + 1);
      } finally { gate.release(); await active.completion.catch(() => {}); await active.closing.catch(() => {}); await saved?.catch(() => {}); await observer.end(); }
    });
  });
  test('concurrent matching publications keep one request and one required event', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const requests = createOperatorArtistReconciliationRequestService(); let results;
      const active = await start(fixture, { materializeDesiredReleaseRequests: async input => {
        results = await runParallelTasksAndDrain([() => requests.materializeDesiredReleaseRequests(input), () => requests.materializeDesiredReleaseRequests(input)]);
        return results[0];
      } });
      await active.completion; await active.closing; const state = await readOperatorReconciliationLifetimeState(fixture.run.id);
      assert.equal(state.requests.length, 1); assert.equal(state.events.length, 1);
      assert.equal(results.reduce((sum, result) => sum + result.createdRequestCount, 0), 1);
      assert.equal(results.reduce((sum, result) => sum + result.duplicateSuppressedCount, 0), 1);
    });
  });
  test('null rollback failure evicts the native client and leaves no request/event transaction behind', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const media = createLibraryMediaRequestStore();
      const ended = createFixtureGate({ signal: t.signal }); let discarded; let rollbackCalls = 0;
      const requests = createOperatorArtistReconciliationRequestService({ getPoolFn: () => ({ connect: async () => {
        const client = await getPool().connect(); client.once('end', ended.release);
        return { query: (sql, ...args) => { if (sql === 'ROLLBACK') { rollbackCalls++; throw null; } return client.query(sql, ...args); },
          release: reason => { discarded = reason; client.release(reason); } };
      } }), insertMediaRequestEvent: async input => { await media.insertMediaRequestEvent(input); throw new Error('controlled publication refusal'); } });
      const active = await start(fixture, requests); await active.completion; await active.closing; await ended.promise;
      const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(rollbackCalls, 1); assert.ok(discarded instanceof Error); assert.equal(discarded.cause, null);
      assert.equal(state.requests.length, 0); assert.equal(state.events.length, 0); assert.equal(state.operation.status, 'failed');
      assert.equal(state.operation.error_message, 'controlled publication refusal');
    });
  });
});
