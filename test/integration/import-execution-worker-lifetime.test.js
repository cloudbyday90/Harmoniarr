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
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createImportCandidateExecutionRunStore } from '../../src/server/import-candidates/import-candidate-execution-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Import execution native finalization and app fixture ownership', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} keeps database/environment/workspace through execution release${fails ? ' and retains scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const gate = createFixtureGate({ signal: t.signal }); const releasing = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled native execution release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let store; let workspace; let database; let released = false; let settled = false;
        const createAppFn = () => {
          store = createImportCandidateExecutionRunStore();
          worker = createImportCandidateExecutionWorker({ acquireLease: store.acquireLease, markRunStarted: store.markRunStarted,
            markRunCompleted: store.markRunCompleted, markRunFailed: store.markRunFailed,
            releaseLease: async input => {
              releasing.release(); await gate.promise;
              assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database);
              await access(workspace); await store.releaseLease(input); released = true;
              if (fails) throw cleanupError;
            } });
          const close = worker.close;
          worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), importCandidateModule: { importCandidateExecutionWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          const queued = await store.createOperationRun({ requestedCandidateCount: 0 });
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['import_candidate_execution_planning'] });
          assert.equal(claimed.id, queued.id);
          const { completion } = await worker.startWorkerRun({ runId: queued.id, requestedCandidateCount: 0 });
          await waitForFixtureReady({ ready: releasing.promise, operation: completion, signal: t.signal });
          assert.equal((await store.getRunById(queued.id)).status, 'completed');
          if (fails) throw null;
          return 'execution-result';
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
          assert.equal(settled, false); assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await access(workspace);
          await assert.rejects(worker.startWorkerRun({ runId: 'late', requestedCandidateCount: 0 }), { code: 'worker_closing' });
          gate.release();
          if (fails) await assert.rejects(pending, error => error === null);
          else assert.equal(await pending, 'execution-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase);
          await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError);
          else await worker.close();
        } finally { gate.release(); await pending.catch(() => {}); await runtime?.cleanup(); }
      });
    }
  }
});
