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
import { createLibraryExternalIntakeWorker } from '../../src/server/library/library-external-intake-worker.js';
import { createLibraryExternalIntakeRunStore } from '../../src/server/library/library-external-intake-run-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryProviderIngestPlanningService } from '../../src/server/library/library-provider-ingest-planning-service.js';
import { createLibraryProviderIngestExecutionService } from '../../src/server/library/library-provider-ingest-execution-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
const canonicalUrl = 'https://open.spotify.com/album/stored123';
const planningType = 'library_external_intake_planning';
const executionType = 'library_external_intake_execution';

suite('External intake native planning/handoff and app fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains resources through durable handoff and release${fails ? ' with scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const handoffGate = createFixtureGate({ signal: t.signal }); const handoffEntered = createFixtureGate({ signal: t.signal });
        const releaseGate = createFixtureGate({ signal: t.signal }); const releaseEntered = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled intake release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let store; let workspace; let database; let request; let actor; let recipient; let runId;
        let released = false; let handoffFinished = false; let settled = false; let releaseStarted = false; let queuedExecution;
        const assertResources = async () => {
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database); await access(workspace);
        };
        const createAppFn = () => {
          store = createLibraryExternalIntakeRunStore();
          const planner = createLibraryProviderIngestPlanningService();
          const executor = createLibraryProviderIngestExecutionService();
          worker = createLibraryExternalIntakeWorker({ ...store,
            planExternalMediaRequest: planner.planExternalMediaRequest,
            queueExternalMediaRequestExecution: async input => {
              queuedExecution = await executor.queueExternalMediaRequestExecution(input); handoffEntered.release();
              await handoffGate.promise; await assertResources(); handoffFinished = true; return queuedExecution;
            },
            releaseLease: async input => {
              releaseStarted = true; releaseEntered.release(); await releaseGate.promise; await assertResources();
              await store.releaseLease(input); released = true; if (fails) throw cleanupError;
            },
          });
          const close = worker.close;
          worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), libraryModule: { libraryExternalIntakeWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          const users = (await getPool().query(`INSERT INTO app_users(username,password_hash,role)
            VALUES ('intake-actor','synthetic-unused-password','admin'), ('intake-recipient','synthetic-unused-password','requester')
            RETURNING id, username`)).rows;
          actor = users.find(user => user.username === 'intake-actor').id;
          recipient = users.find(user => user.username === 'intake-recipient').id;
          request = await createLibraryMediaRequestStore().createMediaRequest({ requestKind: 'external_url', requestState: 'needs_fetch',
            requestedByUserId: actor, requestedForUserId: recipient, sourceProvider: 'spotify',
            sourceUrl: `${canonicalUrl}?si=discarded`, normalizedQuery: 'external intake lifetime' });
          const queued = await store.createOperationRun({ mediaRequestId: request.id, canonicalUrl: 'untrusted-launch-metadata',
            sourceProvider: 'spotify', sourceIdentifier: 'launch-id', resourceType: 'release', triggeredByUserId: actor });
          runId = queued.id;
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: [planningType] });
          assert.equal(claimed.id, runId);
          const { completion } = await worker.startWorkerRun({ ...queued, runId, triggeredByUserId: actor });
          await waitForFixtureReady({ ready: handoffEntered.promise, operation: completion, signal: t.signal });
          if (fails) throw null;
          return 'intake-result';
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
          assert.equal(settled, false); assert.equal(handoffFinished, false); assert.equal(releaseStarted, false); assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await assertResources();
          assert.equal((await getPool().query('SELECT status FROM operation_runs WHERE id = $1', [runId])).rows[0].status, 'running');
          const execution = (await getPool().query('SELECT status, summary, triggered_by_user_id FROM operation_runs WHERE id = $1', [queuedExecution.run.id])).rows[0];
          assert.equal(execution.status, 'pending'); assert.equal(execution.triggered_by_user_id, actor);
          assert.equal(execution.summary.canonicalUrl, canonicalUrl); assert.equal(execution.summary.mediaRequestId, request.id);
          assert.equal(execution.summary.sourceIdentifier, 'stored123'); assert.equal(execution.summary.triggerSource, 'planning_complete');
          const owned = (await getPool().query(`SELECT r.requested_for_user_id, r.requested_by_user_id, i.canonical_url, i.status
            FROM media_requests r JOIN provider_ingest_requests i ON i.media_request_id = r.id WHERE r.id = $1`, [request.id])).rows;
          assert.equal(owned.length, 1); assert.equal(owned[0].requested_for_user_id, recipient); assert.equal(owned[0].requested_by_user_id, actor);
          assert.equal(owned[0].canonical_url, canonicalUrl); assert.equal(owned[0].status, 'planned');
          assert.equal((await getPool().query('SELECT count(*)::int AS count FROM operation_runs WHERE operation_type = $1', [executionType])).rows[0].count, 1);
          await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' }); handoffGate.release();
          await waitForFixtureReady({ ready: releaseEntered.promise, operation: pending, signal: t.signal });
          assert.equal(handoffFinished, true); assert.equal(releaseStarted, true); assert.equal(settled, false); assert.equal(released, false);
          assert.equal((await getPool().query('SELECT status FROM operation_runs WHERE id = $1', [runId])).rows[0].status, 'completed');
          await assertResources(); releaseGate.release();
          if (fails) await assert.rejects(pending, error => error === null);
          else assert.equal(await pending, 'intake-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase); await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError);
          else await worker.close();
        } finally { handoffGate.release(); releaseGate.release(); await pending.catch(() => {}); await runtime?.cleanup(); }
      });
    }
  }
});
