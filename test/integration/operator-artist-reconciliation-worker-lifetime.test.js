/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { before, after, suite, test } from 'node:test';
import { getPool } from '../../src/server/database.js';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';
import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';
import { createOperatorArtistReconciliationSnapshotService } from '../../src/server/metadata/operator-artist-reconciliation-snapshot-service.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { readOperatorReconciliationLifetimeState, seedOperatorReconciliationLifetimeRun } from '../../testing/integration/operator-reconciliation-lifetime-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Operator reconciliation native requests, discovery and app fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  const functional = options => withIntegrationApp({ config, ...options,
    withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }) });
  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains resources through snapshot, request event, discovery and release${fails ? ' with scenario null' : ''}`, { timeout: config.scenarioTimeoutMs }, async t => {
        const gates = Object.fromEntries(['snapshot', 'event', 'discovery', 'release'].map(name => [name, {
          hold: createFixtureGate({ signal: t.signal }), entered: createFixtureGate({ signal: t.signal }),
        }]));
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled reconciliation release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let workspace; let database; let fixture; let released = false; let discoveryDone = false; let settled = false;
        const assertResources = async () => { assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database); await access(workspace); };
        const hold = async name => { gates[name].entered.release(); await gates[name].hold.promise; await assertResources(); };
        const createAppFn = () => {
          const store = createOperatorArtistReconciliationRunStore(); const snapshots = createOperatorArtistReconciliationSnapshotService();
          const requests = createLibraryMediaRequestStore(); const discovery = createLibraryDiscoveryRequestService();
          const materialization = createOperatorArtistReconciliationRequestService({ libraryMediaRequestStore: requests,
            insertMediaRequestEvent: async input => { await hold('event'); return requests.insertMediaRequestEvent(input); },
            reconcileDiscoveryRequests: async () => { await hold('discovery'); await discovery.reconcileDiscoveryRequests(); discoveryDone = true; },
          });
          const execution = createOperatorArtistReconciliationExecutionService({
            getOperatorArtistReconciliationSnapshotById: async input => { await hold('snapshot'); return snapshots.getOperatorArtistReconciliationSnapshotById(input); },
            operatorArtistReconciliationRequestService: materialization,
          });
          worker = createOperatorArtistReconciliationWorker({ ...store, executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation,
            releaseLease: async input => { await hold('release'); await store.releaseLease(input); released = true; if (fails) throw cleanupError; } });
          const close = worker.close; worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), metadataModule: { operatorArtistReconciliationWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready'); fixture = await seedOperatorReconciliationLifetimeRun();
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['operator_artist_reconciliation'] }); assert.equal(claimed.id, fixture.run.id);
          const handlers = createOperationQueueHandlers({ metadataModule: { operatorArtistReconciliationWorker: worker } });
          const { completion } = await handlers.operator_artist_reconciliation({ run: claimed });
          await waitForFixtureReady({ ready: gates.snapshot.entered.promise, operation: completion, signal: t.signal });
          if (fails) throw null;
          return 'reconciliation-result';
        };
        let runtime;
        if (entrypoint === 'reusable') runtime = await createIntegrationAppRuntime({ config, createAppFn,
          postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {} }) });
        const pending = entrypoint === 'reusable' ? runtime.runScenario(run) : functional({ createAppFn, run });
        void pending.then(() => { settled = true; }, () => { settled = true; });
        const read = () => readOperatorReconciliationLifetimeState(fixture.run.id);
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(released, false); assert.equal(getPool().ending, false); assert.equal(process.env.PGDATABASE, database); await assertResources();
          assert.equal((await read()).operation.status, 'running'); assert.equal((await read()).requests.length, 0);
          await assert.rejects(worker.startWorkerRun({ ...fixture.run, runId: 'late' }), { code: 'worker_closing' }); gates.snapshot.hold.release();
          await waitForFixtureReady({ ready: gates.event.entered.promise, operation: pending, signal: t.signal });
          const uncommitted = await read(); assert.equal(uncommitted.requests.length, 0); assert.equal(uncommitted.events.length, 0); assert.equal(settled, false);
          gates.event.hold.release(); await waitForFixtureReady({ ready: gates.discovery.entered.promise, operation: pending, signal: t.signal });
          const committed = await read(); assert.equal(committed.operation.status, 'running'); assert.equal(committed.requests.length, 1); assert.equal(committed.events.length, 1); assert.equal(committed.discovery.length, 0);
          const request = committed.requests[0]; const event = committed.events[0];
          assert.equal(request.requested_by_user_id, fixture.user.id); assert.equal(request.requested_for_user_id, fixture.user.id); assert.equal(request.matched_metadata_release_id, fixture.metadata.metadataReleaseId);
          assert.equal(request.evidence.operatorArtistReconciliation.appUserId, fixture.user.id); assert.equal(request.evidence.operatorArtistReconciliation.snapshotId, fixture.snapshot.id);
          assert.equal(request.evidence.operatorArtistReconciliation.snapshotRevision, fixture.snapshot.snapshotRevision);
          assert.equal(event.media_request_id, request.id); assert.equal(event.actor_user_id, fixture.user.id); assert.equal(event.event_type, 'created'); assert.equal(event.details.snapshotId, fixture.snapshot.id);
          assert.equal(discoveryDone, false); assert.equal(released, false); assert.equal(settled, false); gates.discovery.hold.release();
          await waitForFixtureReady({ ready: gates.release.entered.promise, operation: pending, signal: t.signal });
          const completed = await read(); assert.equal(completed.operation.status, 'completed'); assert.equal(completed.operation.summary.downstreamCreatedRequestCount, 1);
          assert.deepEqual(completed.operation.summary.downstreamCreatedRequestIds, [request.id]); assert.equal(completed.operation.summary.snapshotRevision, fixture.snapshot.snapshotRevision);
          assert.equal(completed.operation.summary.discoveryReconciled, true); assert.equal(completed.discovery.length, 1);
          assert.equal(completed.discovery[0].evidence.sourceMediaRequestId, request.id); assert.equal(discoveryDone, true); assert.equal(released, false); assert.equal(settled, false); await assertResources();
          gates.release.hold.release(); if (fails) await assert.rejects(pending, error => error === null); else assert.equal(await pending, 'reconciliation-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase); await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError); else await worker.close();
        } finally { for (const gate of Object.values(gates)) gate.hold.release(); await pending.catch(() => {}); await runtime?.cleanup(); }
      });
    }
  }
  for (const refusal of ['actor', 'revision', 'cancelled', 'event']) {
    test(`${refusal} refusal leaves no published downstream request or event`, { timeout: config.scenarioTimeoutMs }, async t => {
      await functional({ run: async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun(); const store = createOperatorArtistReconciliationRunStore();
        const snapshots = createOperatorArtistReconciliationSnapshotService(); const entered = createFixtureGate({ signal: t.signal }); const gate = createFixtureGate({ signal: t.signal });
        const requests = createLibraryMediaRequestStore(); let discoveryCalled = false;
        const materialization = createOperatorArtistReconciliationRequestService({ libraryMediaRequestStore: requests,
          insertMediaRequestEvent: async input => { await requests.insertMediaRequestEvent(input); if (refusal === 'event') throw null; },
          reconcileDiscoveryRequests: async () => { discoveryCalled = true; },
        });
        const execution = createOperatorArtistReconciliationExecutionService({ operatorArtistReconciliationRequestService: materialization,
          getOperatorArtistReconciliationSnapshotById: async input => { entered.release(); await gate.promise; return snapshots.getOperatorArtistReconciliationSnapshotById(input); } });
        const worker = createOperatorArtistReconciliationWorker({ ...store, executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation });
        const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['operator_artist_reconciliation'] }); assert.equal(claimed.id, fixture.run.id);
        const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id,
          appUserId: refusal === 'actor' ? fixture.other.id : fixture.user.id,
          snapshotRevision: fixture.snapshot.snapshotRevision + (refusal === 'revision' ? 1 : 0),
        }); const closing = worker.close(); void closing.catch(() => {});
        try {
          await waitForFixtureReady({ ready: entered.promise, operation: completion, signal: t.signal });
          if (refusal === 'cancelled') await getPool().query('UPDATE operation_runs SET cancel_requested_at=NOW() WHERE id=$1', [fixture.run.id]);
          gate.release(); await completion; await closing; const state = await readOperatorReconciliationLifetimeState(fixture.run.id);
          assert.equal(state.operation.status, refusal === 'cancelled' ? 'cancelled' : 'failed');
          assert.equal(state.requests.length, 0); assert.equal(state.events.length, 0); assert.equal(discoveryCalled, false);
          if (refusal === 'actor') assert.match(state.operation.error_message, /snapshot could not be found/u);
          if (refusal === 'revision') assert.match(state.operation.error_message, /revision mismatch/u);
          if (refusal === 'event') assert.equal(state.operation.error_message, 'Operator artist reconciliation failed');
        } finally { gate.release(); await completion.catch(() => {}); await closing.catch(() => {}); }
      } });
    });
  }
});
