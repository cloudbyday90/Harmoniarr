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
import { createLibraryProviderIngestExecutionWorker } from '../../src/server/library/library-provider-ingest-execution-worker.js';
import { createLibraryProviderIngestExecutionRunStore } from '../../src/server/library/library-provider-ingest-execution-run-store.js';
import { createLibraryProviderIngestExecutionService } from '../../src/server/library/library-provider-ingest-execution-service.js';
import { createLibraryExternalRequestCollectionIntakeService } from '../../src/server/library/library-external-request-collection-intake-service.js';
import { createSpotifyClient } from '../../src/server/integrations/spotify/spotify-client.js';
import { createYouTubeClient } from '../../src/server/integrations/youtube/youtube-client.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createProviderIngestHttpFixture, readProviderIngestLifetimeState, seedProviderIngestLifetimeRun } from '../../testing/integration/provider-ingest-lifetime-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
const operationType = 'library_external_intake_execution';
const sourceUrl = 'https://open.spotify.com/album/stored123';
suite('Provider ingest native HTTP, collection publication and app fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains resources through provider response and release${fails ? ' with scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const provider = await createProviderIngestHttpFixture({ signal: t.signal, payload: { id: 'stored123', name: 'Owned album' } });
        const releaseGate = createFixtureGate({ signal: t.signal }); const releaseEntered = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled ingest release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let store; let workspace; let database; let fixture;
        let executed = false; let released = false; let settled = false; let releaseStarted = false;
        const assertResources = async () => {
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database); await access(workspace);
        };
        const createAppFn = () => {
          store = createLibraryProviderIngestExecutionRunStore();
          const service = createLibraryProviderIngestExecutionService({ resolveProviderClients: () => ({
            spotify: createSpotifyClient({ accessTokenProvider: async () => 'synthetic-owned-token', fetchFn: provider.fetchFn }),
          }) });
          worker = createLibraryProviderIngestExecutionWorker({ ...store,
            executeProviderIngestRequests: async input => { const result = await service.executeProviderIngestRequests(input); executed = true; return result; },
            releaseLease: async input => {
              releaseStarted = true; releaseEntered.release(); await releaseGate.promise; await assertResources();
              await store.releaseLease(input); released = true; if (fails) throw cleanupError;
            },
          });
          const close = worker.close; worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), libraryModule: { libraryProviderIngestExecutionWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          fixture = await seedProviderIngestLifetimeRun({ sourceUrl: `${sourceUrl}?si=discarded`, sourceProvider: 'spotify' });
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: [operationType] });
          assert.equal(claimed.id, fixture.run.id);
          const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id, triggeredByUserId: fixture.actorId });
          await waitForFixtureReady({ ready: provider.entered, operation: completion, signal: t.signal });
          if (fails) throw null;
          return 'ingest-result';
        };
        let runtime;
        if (entrypoint === 'reusable') runtime = await createIntegrationAppRuntime({ config, createAppFn,
          postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {} }) });
        const pending = entrypoint === 'reusable' ? runtime.runScenario(run)
          : withIntegrationApp({ config, createAppFn, run,
              withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });
        void pending.then(() => { settled = true; }, () => { settled = true; });
        const read = () => readProviderIngestLifetimeState({ runId: fixture.run.id, mediaRequestId: fixture.request.id });
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(executed, false); assert.equal(releaseStarted, false); assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await assertResources();
          assert.deepEqual(provider.requests, ['GET']); assert.equal(provider.transportCalls.length, 1);
          const transport = provider.transportCalls[0];
          assert.equal(transport.url, 'https://api.spotify.com/v1/albums/stored123'); assert.equal(transport.method, 'GET');
          assert.equal(transport.redirect, 'error'); assert.equal(transport.signal.aborted, false);
          const pendingState = await read(); assert.equal(pendingState.operation.status, 'running'); assert.equal(pendingState.rows[0].status, 'planned');
          assert.equal(pendingState.request.requested_by_user_id, fixture.actorId); assert.equal(pendingState.request.requested_for_user_id, fixture.recipientId);
          await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' }); provider.release();
          await waitForFixtureReady({ ready: releaseEntered.promise, operation: pending, signal: t.signal });
          assert.equal(executed, true); assert.equal(releaseStarted, true); assert.equal(settled, false); assert.equal(released, false);
          const completedState = await read(); assert.equal(completedState.operation.status, 'completed'); assert.equal(completedState.operation.summary.executedCount, 1);
          assert.equal(completedState.operation.summary.failedCount, 0); assert.equal(completedState.operation.triggered_by_user_id, fixture.actorId);
          assert.equal(completedState.rows.length, 1); assert.equal(completedState.rows[0].status, 'completed'); assert.equal(completedState.rows[0].canonical_url, sourceUrl);
          assert.equal(completedState.rows[0].evidence.response.id, 'stored123'); assert.equal(completedState.request.evidence.providerAutomation.status, 'executed');
          assert.equal((await getPool().query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'provider_ingest_requests_executed' AND actor_user_id = $1", [fixture.actorId])).rows[0].count, 1);
          assert.deepEqual(provider.requests, ['GET']); await assertResources(); releaseGate.release();
          if (fails) await assert.rejects(pending, error => error === null); else assert.equal(await pending, 'ingest-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase); await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError); else await worker.close();
        } finally { provider.release(); releaseGate.release(); await pending.catch(() => {}); await runtime?.cleanup(); await provider.close(); }
      });
    }
  }

  for (const cancelled of [false, true]) {
    test(`tracked collection owns response and ${cancelled ? 'refuses publication after cancellation' : 'publishes guarded page before release'}`, {
      timeout: config.scenarioTimeoutMs,
    }, async t => {
      const provider = await createProviderIngestHttpFixture({ signal: t.signal, payload: {
        items: [{ id: 'membership123', snippet: { title: 'Owned video', resourceId: { videoId: 'video123' } } }],
      } });
      try {
        await withIntegrationApp({ config,
          withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
          run: async () => {
            const collection = createLibraryExternalRequestCollectionIntakeService({ resolveProviderClients: () => ({
              youtube: createYouTubeClient({ accessTokenProvider: async () => 'synthetic-owned-token', fetchFn: provider.fetchFn }),
            }) });
            const fixture = await seedProviderIngestLifetimeRun({ sourceProvider: 'youtube', sourceUrl: 'https://www.youtube.com/playlist?list=playlist123', collectionIntakeService: collection });
            const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: [operationType] });
            assert.equal(claimed.id, fixture.run.id);
            const store = createLibraryProviderIngestExecutionRunStore();
            const service = createLibraryProviderIngestExecutionService({ collectionIntakeService: collection });
            let released = false;
            const worker = createLibraryProviderIngestExecutionWorker({ ...store, executeProviderIngestRequests: service.executeProviderIngestRequests,
              releaseLease: async input => { await store.releaseLease(input); released = true; } });
            const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id, triggeredByUserId: fixture.actorId });
            const closing = worker.close(); void closing.catch(() => {});
            try {
              await waitForFixtureReady({ ready: provider.entered, operation: completion, signal: t.signal });
              assert.equal(released, false); assert.deepEqual(provider.requests, ['GET']);
              if (cancelled) await getPool().query("UPDATE media_requests SET request_state = 'cancelled' WHERE id = $1", [fixture.request.id]);
              provider.release(); await completion; await closing;
              const state = await readProviderIngestLifetimeState({ runId: fixture.run.id, mediaRequestId: fixture.request.id });
              assert.equal(released, true); assert.equal(state.operation.status, cancelled ? 'cancelled' : 'completed');
              assert.equal(state.rows[0].status, cancelled ? 'planned' : 'completed');
              const prepared = await collection.getCollection({ mediaRequestId: fixture.request.id });
              assert.equal(prepared.status, cancelled ? 'preparing' : 'ready'); assert.equal(prepared.pagesCompleted, cancelled ? 0 : 1);
              assert.equal((await getPool().query('SELECT count(*)::int AS count FROM library_external_request_collection_items WHERE media_request_id = $1', [fixture.request.id])).rows[0].count, cancelled ? 0 : 1);
              assert.deepEqual(provider.requests, ['GET']); assert.equal(provider.transportCalls.length, 1);
            } finally { provider.release(); await completion.catch(() => {}); await closing.catch(() => {}); }
          },
        });
      } finally { await provider.close(); }
    });
  }
});
