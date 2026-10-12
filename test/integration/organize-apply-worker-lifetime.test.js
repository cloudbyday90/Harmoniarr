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
import { createLibraryOrganizeApplyWorker } from '../../src/server/library/library-organize-apply-worker.js';
import { createLibraryOrganizeApplyRunStore } from '../../src/server/library/library-organize-apply-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { seedOrganizeLifetimeFixture } from '../../testing/integration/organize-lifetime-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Organize apply native verified movement and app fixture finalization', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains bytes/catalog/database through advisory and lease cleanup${fails ? ' with scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const advisoryGate = createFixtureGate({ signal: t.signal }); const advisoryEntered = createFixtureGate({ signal: t.signal });
        const releaseGate = createFixtureGate({ signal: t.signal }); const releaseEntered = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled organize release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let store; let fixture; let workspace; let database; let released = false; let settled = false;
        let advisoryFinished = false; let releaseStarted = false;
        const assertMove = async () => {
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database);
          await access(workspace); assert.deepEqual(await fixture.readDestination(), fixture.bytes);
          assert.equal(await fixture.readPath(), fixture.destination); await assert.rejects(access(fixture.source), { code: 'ENOENT' });
        };
        const createAppFn = () => {
          store = createLibraryOrganizeApplyRunStore();
          worker = createLibraryOrganizeApplyWorker({ ...store,
            buildLibraryOrganizePreview: async () => ({ files: [fixture.file], counts: { totalFiles: 1 } }),
            createExclusiveFileMutationPlan: input => fixture.createExclusiveFileMutationPlan(input),
            applyOrganizeMutation: input => fixture.applyOrganizeMutation(input),
            onReleaseAddedFn: async () => { advisoryEntered.release(); await advisoryGate.promise; await assertMove(); advisoryFinished = true; },
            recordActivityEventFn: async () => { await getPool().query('SELECT 1'); },
            releaseLease: async input => {
              releaseStarted = true; releaseEntered.release(); await releaseGate.promise;
              await assertMove(); await store.releaseLease(input); released = true;
              if (fails) throw cleanupError;
            },
          });
          const close = worker.close;
          worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), libraryModule: { libraryOrganizeApplyWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          fixture = await seedOrganizeLifetimeFixture({ getPoolFn: getPool, workspaceDir: workspace });
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          const queued = await store.createOperationRun({ plannedRenameCount: 1 });
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['library_organize_apply'] });
          assert.equal(claimed.id, queued.id);
          const { completion } = await worker.startWorkerRun({ runId: queued.id, plannedRenameCount: 1 });
          await waitForFixtureReady({ ready: advisoryEntered.promise, operation: completion, signal: t.signal });
          assert.equal((await fixture.readRun(queued.id)).status, 'completed'); await assertMove();
          if (fails) throw null;
          return 'organize-result';
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
          assert.equal(settled, false); assert.equal(released, false); assert.equal(process.env.PGDATABASE, database);
          assert.equal(releaseStarted, false);
          assert.equal(getPool().ending, false); await assertMove();
          await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
          advisoryGate.release();
          await waitForFixtureReady({ ready: releaseEntered.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(released, false); await assertMove(); releaseGate.release();
          if (fails) await assert.rejects(pending, error => error === null);
          else assert.equal(await pending, 'organize-result');
          assert.equal(advisoryFinished, true); assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase);
          await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError);
          else await worker.close();
        } finally { advisoryGate.release(); releaseGate.release(); await pending.catch(() => {}); await runtime?.cleanup(); }
      });
    }
  }
});
