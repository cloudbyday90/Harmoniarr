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
import { createAppUserService } from '../../src/server/app-user-service.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createLibraryExternalRequestDiscoveryModule } from '../../src/server/library/library-external-request-discovery-module.js';
import { createLibraryExternalRequestDiscoveryRunStore } from '../../src/server/library/library-external-request-discovery-run-store.js';
import { createLibraryExternalRequestReviewStore } from '../../src/server/library/library-external-request-review-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createExternalDiscoveryHttpFixture, readExternalDiscoveryLifetimeState, seedExternalDiscoveryLifetimeRun } from '../../testing/integration/external-request-discovery-lifetime-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
const operationType = 'library_external_request_discovery';
function createModule(provider, runStore) {
  return createLibraryExternalRequestDiscoveryModule({ runStore, slskdService: provider.service,
    importCandidateService: createImportCandidateService({ pool: getPool(), slskdService: provider.service }),
    getAppUserById: createAppUserService().getAppUserById, reviewStore: createLibraryExternalRequestReviewStore(),
    mediaRequestStore: createLibraryMediaRequestStore(), getReleaseTracklistExpectationsFn: async () => ({ expectedTrackCount: 1, expectedTrackTitles: ['Foil'] }),
  });
}
suite('External request discovery native HTTP, publication and app fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains resources through candidate publication and release${fails ? ' with scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const provider = await createExternalDiscoveryHttpFixture({ signal: t.signal });
        const releaseGate = createFixtureGate({ signal: t.signal }); const releaseEntered = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled external discovery release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let workspace; let database; let fixture; let released = false; let settled = false; let releaseStarted = false;
        const assertResources = async () => {
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database); await access(workspace);
        };
        const createAppFn = () => {
          const store = createLibraryExternalRequestDiscoveryRunStore();
          const module = createModule(provider, { ...store, releaseLease: async input => {
            releaseStarted = true; releaseEntered.release(); await releaseGate.promise; await assertResources();
            await store.releaseLease(input); released = true; if (fails) throw cleanupError;
          } });
          worker = module.libraryExternalRequestDiscoveryWorker;
          const close = worker.close; worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), libraryModule: module };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready'); fixture = await seedExternalDiscoveryLifetimeRun();
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: [operationType] }); assert.equal(claimed.id, fixture.run.id);
          const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id, triggeredByUserId: fixture.actorId });
          await waitForFixtureReady({ ready: provider.entered, operation: completion, signal: t.signal });
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
        const read = () => readExternalDiscoveryLifetimeState({ runId: fixture.run.id });
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(releaseStarted, false); assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await assertResources();
          const pendingState = await read(); assert.equal(pendingState.operation.status, 'running'); assert.equal(pendingState.candidates.length, 0);
          assert.deepEqual(provider.requests.map(item => item.method), ['POST', 'GET']); assert.deepEqual(provider.queries, ['Autechre Amber']);
          await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' }); provider.release();
          await waitForFixtureReady({ ready: releaseEntered.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(released, false); assert.equal(releaseStarted, true);
          const state = await read(); assert.equal(state.operation.status, 'completed'); assert.equal(state.operation.summary.candidateCount, 1);
          assert.equal(state.operation.triggered_by_user_id, fixture.actorId); assert.equal(state.candidates.length, 1); assert.equal(state.files.length, 1);
          assert.equal(state.candidates[0].status, 'pending'); assert.equal(state.files[0].import_candidate_id, state.candidates[0].id);
          const ownership = state.candidates[0].normalized_payload.requestOwnership;
          assert.equal(ownership.externalRequestReleaseIntentId, fixture.intent.id); assert.equal(ownership.sourceMediaRequestId, fixture.request.id);
          assert.equal(ownership.sourceRequestedForUserId, fixture.recipientId); assert.equal(ownership.sourceRequestedByUserId, fixture.actorId);
          assert.equal(ownership.metadataReleaseId, fixture.metadata.metadataReleaseId); assert.deepEqual(state.audits, [{ actor_user_id: fixture.actorId }]);
          assert.deepEqual(provider.requests.map(item => item.method), ['POST', 'GET']); await assertResources(); releaseGate.release();
          if (fails) await assert.rejects(pending, error => error === null); else assert.equal(await pending, 'discovery-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase); await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError); else await worker.close();
        } finally { provider.release(); releaseGate.release(); await pending.catch(() => {}); await runtime?.cleanup(); await provider.close(); }
      });
    }
  }

  for (const mutation of ['cancelled', 'retargeted']) {
    test(`response fetched before request ${mutation} cannot publish candidates or files`, { timeout: config.scenarioTimeoutMs }, async t => {
      const provider = await createExternalDiscoveryHttpFixture({ signal: t.signal });
      try {
        await withIntegrationApp({ config,
          withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
          run: async () => {
            const fixture = await seedExternalDiscoveryLifetimeRun();
            const module = createModule(provider, createLibraryExternalRequestDiscoveryRunStore()); const worker = module.libraryExternalRequestDiscoveryWorker;
            const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: [operationType] }); assert.equal(claimed.id, fixture.run.id);
            const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id, triggeredByUserId: fixture.actorId });
            const closing = worker.close(); void closing.catch(() => {});
            try {
              await waitForFixtureReady({ ready: provider.entered, operation: completion, signal: t.signal });
              if (mutation === 'cancelled') await getPool().query("UPDATE media_requests SET request_state = 'cancelled' WHERE id = $1", [fixture.request.id]);
              else await getPool().query('UPDATE media_requests SET requested_for_user_id = $2 WHERE id = $1', [fixture.request.id, fixture.actorId]);
              provider.release(); await completion; await closing;
              const state = await readExternalDiscoveryLifetimeState({ runId: fixture.run.id });
              assert.equal(state.operation.status, 'cancelled'); assert.deepEqual(state.candidates, []); assert.deepEqual(state.files, []); assert.deepEqual(state.audits, []);
              assert.deepEqual(provider.requests.map(item => item.method), ['POST', 'GET']);
            } finally { provider.release(); await completion.catch(() => {}); await closing.catch(() => {}); }
          },
        });
      } finally { await provider.close(); }
    });
  }
});
