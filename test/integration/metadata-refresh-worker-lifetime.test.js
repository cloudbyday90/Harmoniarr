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
import { createMetadataArtistRefreshWorker } from '../../src/server/metadata/metadata-artist-refresh-worker.js';
import { createMetadataArtistRefreshRunStore } from '../../src/server/metadata/metadata-artist-refresh-run-store.js';
import { createMetadataReadService } from '../../src/server/metadata/metadata-read-service.js';
import { createMetadataRefreshService } from '../../src/server/metadata/metadata-refresh-service.js';
import { createMetadataRefreshSchedulerService } from '../../src/server/metadata/metadata-refresh-scheduler-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createMetadataRefreshHttpFixture, metadataRefreshFixtureTime, readMetadataRefreshLifetimeState, seedMetadataRefreshLifetimeRun } from '../../testing/integration/metadata-refresh-lifetime-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
function createServices(provider) {
  const read = createMetadataReadService();
  return { refresh: createMetadataRefreshService({ musicBrainzClient: provider.client,
    getMetadataArtistByMusicBrainzId: read.getArtistByMusicBrainzId, nowFn: () => new Date(metadataRefreshFixtureTime),
    metadataReleaseDetectionService: { recordDetectedReleaseGroups: async () => [] },
  }), scheduler: createMetadataRefreshSchedulerService({ getMetadataArtist: read.getArtist }) };
}
suite('Metadata refresh native HTTP, catalog/schedule and app fixture lifetime', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} retains resources through provider, schedule and release${fails ? ' with scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const provider = await createMetadataRefreshHttpFixture({ signal: t.signal });
        const scheduleGate = createFixtureGate({ signal: t.signal }); const scheduleEntered = createFixtureGate({ signal: t.signal });
        const releaseGate = createFixtureGate({ signal: t.signal }); const releaseEntered = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled metadata release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let workspace; let database; let fixture; let released = false; let scheduled = false; let settled = false; let releaseStarted = false;
        const assertResources = async () => {
          assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database); await access(workspace);
        };
        const createAppFn = () => {
          const store = createMetadataArtistRefreshRunStore(); const services = createServices(provider);
          worker = createMetadataArtistRefreshWorker({ ...store, refreshMetadataArtist: services.refresh.refreshArtistCatalogById,
            recordArtistRefreshCompleted: async input => {
              scheduleEntered.release(); await scheduleGate.promise; await assertResources();
              const result = await services.scheduler.recordArtistRefreshCompleted(input); scheduled = true; return result;
            }, releaseLease: async input => {
              releaseStarted = true; releaseEntered.release(); await releaseGate.promise; await assertResources();
              await store.releaseLease(input); released = true; if (fails) throw cleanupError;
            } });
          const close = worker.close; worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), metadataModule: { metadataArtistRefreshWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready'); fixture = await seedMetadataRefreshLifetimeRun({ artistMbid: provider.artistMbid });
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['metadata_artist_refresh'] }); assert.equal(claimed.id, fixture.run.id);
          const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id });
          await waitForFixtureReady({ ready: provider.entered, operation: completion, signal: t.signal });
          if (fails) throw null;
          return 'refresh-result';
        };
        let runtime;
        if (entrypoint === 'reusable') runtime = await createIntegrationAppRuntime({ config, createAppFn,
          postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {} }) });
        const pending = entrypoint === 'reusable' ? runtime.runScenario(run)
          : withIntegrationApp({ config, createAppFn, run,
              withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });
        void pending.then(() => { settled = true; }, () => { settled = true; });
        const read = () => readMetadataRefreshLifetimeState({ runId: fixture.run.id, artistId: fixture.artist.id });
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(scheduled, false); assert.equal(releaseStarted, false); assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await assertResources();
          const pendingState = await read(); assert.equal(pendingState.operation.status, 'running'); assert.equal(pendingState.artist.name, 'Original owned artist');
          assert.equal(pendingState.groups.length, 0); assert.equal(pendingState.schedule.last_refreshed_at, null);
          assert.equal(provider.requests.length, 1); assert.equal(provider.transportCalls[0].redirect, 'error');
          assert.equal(new URL(provider.transportCalls[0].url).origin, 'https://musicbrainz.org'); assert.match(provider.transportCalls[0].userAgent, /^Harmoniarr\//);
          await assert.rejects(worker.startWorkerRun({ ...fixture.run, runId: 'late' }), { code: 'worker_closing' }); provider.release();
          await waitForFixtureReady({ ready: scheduleEntered.promise, operation: pending, signal: t.signal });
          const catalogState = await read(); assert.equal(catalogState.artist.name, 'Updated owned artist'); assert.equal(catalogState.groups.length, 1);
          assert.equal(catalogState.operation.status, 'running'); assert.equal(catalogState.schedule.last_refreshed_at, null);
          assert.equal(scheduled, false); assert.equal(releaseStarted, false); assert.equal(settled, false); scheduleGate.release();
          await waitForFixtureReady({ ready: releaseEntered.promise, operation: pending, signal: t.signal });
          assert.equal(scheduled, true); assert.equal(settled, false); assert.equal(released, false); assert.equal(releaseStarted, true);
          const state = await read(); assert.equal(state.operation.status, 'completed'); assert.equal(state.operation.summary.releaseGroupCount, 1);
          assert.equal(state.schedule.last_refreshed_at.toISOString(), metadataRefreshFixtureTime);
          assert.equal(state.operation.summary.nextRefreshAt, state.schedule.next_refresh_at.toISOString());
          assert.equal(state.operation.summary.musicBrainzArtistId, provider.artistMbid); assert.equal(state.operation.summary.metadataArtistId, fixture.artist.id);
          assert.deepEqual(provider.requests.map(item => item.method), ['GET', 'GET']); await assertResources(); releaseGate.release();
          if (fails) await assert.rejects(pending, error => error === null); else assert.equal(await pending, 'refresh-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase); await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError); else await worker.close();
        } finally { provider.release(); scheduleGate.release(); releaseGate.release(); await pending.catch(() => {}); await runtime?.cleanup(); await provider.close(); }
      });
    }
  }
  test('monitoring removed during provider work clears the prior schedule without recording a new refresh date', { timeout: config.scenarioTimeoutMs }, async t => {
    const provider = await createMetadataRefreshHttpFixture({ signal: t.signal });
    try {
      await withIntegrationApp({ config, withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
        run: async () => {
          const fixture = await seedMetadataRefreshLifetimeRun({ artistMbid: provider.artistMbid }); const services = createServices(provider);
          const store = createMetadataArtistRefreshRunStore(); const worker = createMetadataArtistRefreshWorker({ ...store,
            refreshMetadataArtist: services.refresh.refreshArtistCatalogById, recordArtistRefreshCompleted: services.scheduler.recordArtistRefreshCompleted });
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['metadata_artist_refresh'] }); assert.equal(claimed.id, fixture.run.id);
          const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id }); const closing = worker.close(); void closing.catch(() => {});
          try {
            await waitForFixtureReady({ ready: provider.entered, operation: completion, signal: t.signal });
            await getPool().query('UPDATE operator_artist_monitoring SET is_monitored=FALSE WHERE metadata_artist_id=$1', [fixture.artist.id]);
            provider.release(); await completion; await closing;
            const state = await readMetadataRefreshLifetimeState({ runId: fixture.run.id, artistId: fixture.artist.id });
            assert.equal(state.operation.status, 'completed'); assert.equal(state.operation.summary.nextRefreshAt, null);
            assert.equal(state.schedule.next_refresh_at, null); assert.equal(state.schedule.last_refreshed_at, null); assert.equal(state.groups.length, 1);
          } finally { provider.release(); await completion.catch(() => {}); await closing.catch(() => {}); }
        } });
    } finally { await provider.close(); }
  });
});
