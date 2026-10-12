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
import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';
import { createLibraryDiscoveryRunStore } from '../../src/server/library/library-discovery-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Discovery native release/pruning, HTTP and app fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains database/environment/workspace through release and pruning${fails ? ' with scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const releaseGate = createFixtureGate({ signal: t.signal }); const releaseEntered = createFixtureGate({ signal: t.signal });
        const pruneGate = createFixtureGate({ signal: t.signal }); const pruneEntered = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled discovery prune');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let store; let workspace; let database; let released = false; let pruned = false; let settled = false;
        const assertResources = async () => {
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database); await access(workspace);
        };
        const createAppFn = () => {
          store = createLibraryDiscoveryRunStore();
          worker = createLibraryDiscoveryWorker({ ...store,
            releaseLease: async input => { releaseEntered.release(); await releaseGate.promise; await assertResources();
              await store.releaseLease(input); released = true; },
            pruneOldRuns: async () => { assert.equal(released, true); pruneEntered.release(); await pruneGate.promise;
              await assertResources(); await store.pruneOldRuns(); pruned = true; if (fails) throw cleanupError; },
          });
          const close = worker.close;
          worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), libraryModule: { libraryDiscoveryWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          const queued = await store.createOperationRun({});
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['library_discovery_dispatch'] });
          assert.equal(claimed.id, queued.id);
          const { completion } = await worker.startWorkerRun({ runId: queued.id });
          await waitForFixtureReady({ ready: releaseEntered.promise, operation: completion, signal: t.signal });
          assert.equal((await store.getRunById(queued.id)).status, 'completed');
          if (fails) throw null;
          return 'discovery-result';
        };
        let runtime;
        if (entrypoint === 'reusable') runtime = await createIntegrationAppRuntime({ config, createAppFn,
          postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {} }) });
        const pending = entrypoint === 'reusable' ? runtime.runScenario(run)
          : withIntegrationApp({ config, createAppFn, run,
              withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });
        void pending.then(() => { settled = true; }, () => { settled = true; });
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(released, false); assert.equal(pruned, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await assertResources();
          await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' }); releaseGate.release();
          await waitForFixtureReady({ ready: pruneEntered.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(released, true); assert.equal(pruned, false); await assertResources(); pruneGate.release();
          if (fails) await assert.rejects(pending, error => error === null);
          else assert.equal(await pending, 'discovery-result');
          assert.equal(pruned, true); assert.equal(process.env.PGDATABASE, priorDatabase);
          await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError);
          else await worker.close();
        } finally { releaseGate.release(); pruneGate.release(); await pending.catch(() => {}); await runtime?.cleanup(); }
      });
    }
  }

  test('native provider HTTP remains admitted through close without a second POST or premature database disposal', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    const responseGate = createFixtureGate({ signal: t.signal }); const requestEntered = createFixtureGate({ signal: t.signal });
    const closing = createFixtureGate({ signal: t.signal }); let requests = 0; let worker; let store; let database; let workspace; let dispatched = false;
    const requestMethods = []; let persisted = false;
    const provider = createServer((request, response) => {
      requests++; requestMethods.push(request.method); request.resume(); requestEntered.release();
      void responseGate.promise.then(() => { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{"id":"controlled-search"}'); },
        () => { response.destroy(); });
    });
    await new Promise(resolve => { provider.listen(0, '127.0.0.1', resolve); });
    const providerUrl = `http://127.0.0.1:${provider.address().port}/search`;
    const pending = withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
      createAppFn: () => {
        store = createLibraryDiscoveryRunStore();
        worker = createLibraryDiscoveryWorker({ ...store,
          markRunCompleted: async input => { const result = await store.markRunCompleted(input); persisted = result !== false; return result; },
          dispatchDiscoveryRequests: async () => {
          const response = await fetch(providerUrl, { method: 'POST' }); assert.equal(response.status, 200);
          assert.equal((await response.json()).id, 'controlled-search');
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database);
          await access(workspace); dispatched = true; return { attemptedCount: 1, dispatchedCount: 1 };
        } });
        const close = worker.close; worker.close = () => { const value = close(); closing.release(); return value; };
        return { app: createServer((_request, response) => response.end('ready')), libraryModule: { libraryDiscoveryWorker: worker } };
      },
      run: async context => {
        database = context.databaseConfig.database; workspace = context.workspaceDir;
        const queued = await store.createOperationRun({});
        const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['library_discovery_dispatch'] });
        assert.equal(claimed.id, queued.id);
        const { completion } = await worker.startWorkerRun({ runId: queued.id });
        await waitForFixtureReady({ ready: requestEntered.promise, operation: completion, signal: t.signal });
        assert.equal((await store.getRunById(queued.id)).status, 'running'); return 'provider-result';
      },
    });
    try {
      await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
      assert.equal(dispatched, false); assert.equal(requests, 1); assert.equal(getPool().ending, false); await access(workspace);
      responseGate.release(); assert.equal(await pending, 'provider-result'); assert.equal(dispatched, true); assert.equal(requests, 1);
      assert.equal(persisted, true); assert.deepEqual(requestMethods, ['POST']);
      await worker.close(); await assert.rejects(access(workspace), { code: 'ENOENT' });
    } finally { responseGate.release(); await pending.catch(() => {}); await new Promise(resolve => { provider.close(resolve); }); }
  });
});
