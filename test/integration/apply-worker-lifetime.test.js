/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { after, before, suite, test } from 'node:test';
import { getPool } from '../../src/server/database.js';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';
import { createImportCandidateApplyRunStore } from '../../src/server/import-candidates/import-candidate-apply-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { runLibraryAddFixtureWorker } from '../../testing/integration/library-add-media-fixtures.js';

const config = resolveIntegrationTestRuntimeConfig();
let postgres;

suite('apply worker native lease and app-fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); },
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('per-run fixture completion waits for actual finalization before reading terminal status', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    const gate = createFixtureGate({ signal: t.signal });
    const releasing = createFixtureGate({ signal: t.signal });
    let store;
    let worker;
    let reads = 0;
    await withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run }) => postgres.runIsolatedDatabase(run),
      createAppFn: () => {
        store = createImportCandidateApplyRunStore();
        worker = createImportCandidateApplyWorker({ acquireLease: store.acquireLease,
          markRunStarted: store.markRunStarted, markRunCompleted: store.markRunCompleted,
          markRunFailed: store.markRunFailed, releaseLease: async input => {
            releasing.release(); await gate.promise; await store.releaseLease(input);
          } });
        return { app: createServer((_request, response) => response.end('ready')),
          importCandidateModule: { importCandidateApplyWorker: worker } };
      },
      run: async ({ getPoolFn }) => {
        const created = await store.createOperationRun({ requestedCandidateCount: 0 });
        const pending = runLibraryAddFixtureWorker({ pool: getPoolFn(), runId: created.id,
          module: { importCandidateApplyWorker: worker, importCandidateApplyRunStore: {
            getRunById: async runId => { reads += 1; return store.getRunById(runId); },
          } } });
        try {
          await releasing.promise;
          assert.equal((await store.getRunById(created.id)).status, 'completed');
          assert.equal(reads, 0);
        } finally { gate.release(); await pending; }
        assert.equal(reads, 1);
      },
    });
  });

  for (const entrypoint of ['reusable', 'functional']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} fixture drains native lease release before teardown${fails ? ' while retaining a null scenario error' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async (t) => {
        const gate = createFixtureGate({ signal: t.signal });
        const releasing = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal });
        const cleanupError = new Error('controlled release failure');
        let worker;
        let store;
        let runId;
        let workspace;
        let database;
        let released = false;
        let complete = false;
        const originalDatabase = process.env.PGDATABASE;
        const createAppFn = () => {
          store = createImportCandidateApplyRunStore();
          worker = createImportCandidateApplyWorker({
            acquireLease: store.acquireLease,
            markRunStarted: store.markRunStarted,
            markRunCompleted: store.markRunCompleted,
            markRunFailed: store.markRunFailed,
            releaseLease: async input => {
              releasing.release();
              await gate.promise;
              assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database);
              await access(workspace);
              await store.releaseLease(input);
              released = true;
              if (fails) throw cleanupError;
            },
          });
          const close = worker.close;
          worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')),
            importCandidateModule: { importCandidateApplyWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir;
          database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          const created = await store.createOperationRun({ requestedCandidateCount: 0 });
          runId = created.id;
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['import_candidate_apply'] });
          assert.equal(claimed.id, runId);
          const { completion } = await worker.startWorkerRun({ runId, requestedCandidateCount: 0 });
          await waitForFixtureReady({ ready: releasing.promise, operation: completion, signal: t.signal });
          assert.equal((await store.getRunById(runId)).status, 'completed');
          if (fails) throw null;
          return 'scenario-result';
        };
        let appRuntime;
        if (entrypoint === 'reusable') {
          appRuntime = await createIntegrationAppRuntime({ config, createAppFn,
            postgresRuntimeFactory: async () => ({
              runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {},
            }) });
        }
        const pending = entrypoint === 'reusable'
          ? appRuntime.runScenario(run)
          : withIntegrationApp({ config, createAppFn, run,
              withPostgresIntegrationRuntimeFn: ({ run: execute }) => postgres.runIsolatedDatabase(execute) });
        void pending.then(() => { complete = true; }, () => { complete = true; });
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(complete, false);
          assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database);
          await access(workspace);
          await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
          gate.release();
          if (fails) await assert.rejects(pending, error => error === null);
          else assert.equal(await pending, 'scenario-result');
          assert.equal(released, true);
          assert.equal(process.env.PGDATABASE, originalDatabase);
          await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError);
          else await worker.close();
        } finally {
          gate.release();
          await pending.catch(() => {});
          await appRuntime?.cleanup();
        }
      });
    }
  }
});
