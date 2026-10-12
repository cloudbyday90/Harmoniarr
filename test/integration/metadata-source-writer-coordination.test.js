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
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';
import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';
import { createOperatorReconciliationPublicationService } from '../../src/server/metadata/operator-reconciliation-publication-service.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { forceCanonicalRelease } from '../../src/server/metadata/canonical-release-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { seedOperatorReconciliationLifetimeRun, readOperatorReconciliationLifetimeState } from '../../testing/integration/operator-reconciliation-lifetime-fixture.js';
import { buildMetadataSourceWriter, selectionWriterInput } from '../../testing/integration/metadata-source-writer-fixtures.js';
import { seedSecondReconciliationRelease } from '../../testing/integration/operator-reconciliation-authority-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Supported metadata source writers coordinate through admitted publication', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  const scenario = run => withIntegrationApp({ config, run,
    withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });
  for (const kind of ['selection', 'selection_replace', 'override', 'override_replace', 'snapshot', 'monitoring', 'catalog_group', 'catalog_release',
    'catalog_medium', 'catalog_track', 'catalog_recording', 'catalog_media_delete', 'metadata_service', 'canonical', 'bulk_monitoring', 'bulk_selection', 'bulk_override']) {
    test(`${kind} waits through the final check and request/event commit`, { timeout: config.scenarioTimeoutMs }, async t => {
      await scenario(async ({ databaseConfig }) => {
        const fixture = await seedOperatorReconciliationLifetimeRun(); const write = await buildMetadataSourceWriter(kind, fixture);
        const entered = createFixtureGate({ signal: t.signal }); const gate = createFixtureGate({ signal: t.signal }); const guard = createOperatorReconciliationPublicationService();
        let checks = 0; let holderPid; let writer; let writerDone = false;
        const requests = createOperatorArtistReconciliationRequestService({ publicationGuard: { ...guard, assertCurrent: async input => {
          await guard.assertCurrent(input);
          if (++checks === 3) { holderPid = (await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; entered.release(); await gate.promise; }
        } } });
        const execution = createOperatorArtistReconciliationExecutionService({ operatorArtistReconciliationRequestService: requests });
        const worker = createOperatorArtistReconciliationWorker({ ...createOperatorArtistReconciliationRunStore(), executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation });
        const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['operator_artist_reconciliation'] }); assert.equal(claimed.id, fixture.run.id);
        const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id }); const closing = worker.close(); void closing.catch(() => {});
        const observer = new pg.Client(databaseConfig);
        try {
          await observer.connect(); await waitForFixtureReady({ ready: entered.promise, operation: completion, signal: t.signal });
          writer = write(); void writer.then(() => { writerDone = true; }, () => { writerDone = true; });
          await waitForFixturePostgresBlock({ queryable: observer, holderPid, operation: writer, signal: t.signal });
          assert.equal(writerDone, false); assert.equal((await observer.query('SELECT id FROM media_requests')).rowCount, 0);
          // A normal reader still progresses while publication and a writer occupy the app pool.
          assert.equal((await observer.query('SELECT id FROM metadata_artists WHERE id=$1', [fixture.metadata.metadataArtistId])).rowCount, 1);
          gate.release(); await completion; await closing; await writer;
          const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(state.operation.status, 'completed');
          assert.equal(state.requests.length, 1); assert.equal(state.events.length, 1); assert.equal(writerDone, true);
          assert.equal(state.requests[0].evidence.operatorArtistReconciliation.snapshotId, fixture.snapshot.id);
        } finally { gate.release(); await completion.catch(() => {}); await closing.catch(() => {}); await writer?.catch(() => {}); await observer.end(); }
      });
    });
  }
  test('autocommit borrowed policy queryable refuses before an absent selection is inserted', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun();
      await assert.rejects(createOperatorReleaseGroupSelectionStore().upsertOperatorReleaseGroupSelection({ ...selectionWriterInput(fixture), queryable: getPool() }), { code: '25P01' });
      assert.equal((await getPool().query('SELECT id FROM operator_release_group_selection')).rowCount, 0);
    });
  });
  test('another operator scope progresses while the admitted publication retains its own policy', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const entered = createFixtureGate({ signal: t.signal }); const gate = createFixtureGate({ signal: t.signal });
      const guard = createOperatorReconciliationPublicationService(); let checks = 0; let writer;
      const requests = createOperatorArtistReconciliationRequestService({ publicationGuard: { ...guard, assertCurrent: async input => {
        await guard.assertCurrent(input); if (++checks === 3) { entered.release(); await gate.promise; }
      } } });
      const execution = createOperatorArtistReconciliationExecutionService({ operatorArtistReconciliationRequestService: requests });
      const worker = createOperatorArtistReconciliationWorker({ ...createOperatorArtistReconciliationRunStore(), executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation });
      const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['operator_artist_reconciliation'] }); assert.equal(claimed.id, fixture.run.id);
      const { completion } = await worker.startWorkerRun({ ...fixture.run, runId: fixture.run.id }); const closing = worker.close(); void closing.catch(() => {});
      try {
        await waitForFixtureReady({ ready: entered.promise, operation: completion, signal: t.signal });
        writer = createOperatorArtistMonitoringStore().upsertOperatorArtistMonitoring({ ...defaultOperatorArtistMonitoringPolicy,
          appUserId: fixture.other.id, metadataArtistId: fixture.metadata.metadataArtistId, isMonitored: false });
        await waitForFixtureReady({ ready: writer, operation: completion, signal: t.signal });
        gate.release(); await completion; await closing;
        const state = await readOperatorReconciliationLifetimeState(fixture.run.id); assert.equal(state.requests.length, 1);
        assert.equal(state.requests[0].requested_for_user_id, fixture.user.id); assert.equal(state.operation.status, 'completed');
      } finally { gate.release(); await completion.catch(() => {}); await closing.catch(() => {}); await writer?.catch(() => {}); }
    });
  });
  test('borrowed policy transaction retains ownership and rolls back replacement after caller failure', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const client = await getPool().connect();
      try {
        await client.query('BEGIN'); await createOperatorReleaseGroupSelectionStore().replaceOperatorArtistReleaseGroupSelections({
          ...selectionWriterInput(fixture), operatorReleaseGroupSelections: [selectionWriterInput(fixture)], queryable: client });
        assert.equal((await client.query('SELECT id FROM operator_release_group_selection')).rowCount, 1);
        await client.query('ROLLBACK'); assert.equal((await getPool().query('SELECT id FROM operator_release_group_selection')).rowCount, 0);
      } finally { client.release(); }
    });
  });
  test('canonical setting failure restores the prior winner in PostgreSQL', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async () => {
      const fixture = await seedOperatorReconciliationLifetimeRun(); const second = await seedSecondReconciliationRelease(fixture);
      // Move the second edition into the first group as an ordinary non-canonical edition.
      await getPool().query('UPDATE metadata_releases SET metadata_release_group_id=$2,is_canonical=FALSE WHERE id=$1', [second.id, fixture.metadata.metadataReleaseGroupId]);
      const pool = getPool();
      const getPoolFn = () => ({ connect: async () => { const client = await pool.connect(); return { query: async (sql, ...args) => {
        if (sql.includes('SET is_canonical = TRUE')) throw null; return client.query(sql, ...args);
      }, release: reason => client.release(reason) }; } });
      await assert.rejects(forceCanonicalRelease(second.id, { getPoolFn }), error => error === null);
      const winners = (await pool.query('SELECT id FROM metadata_releases WHERE metadata_release_group_id=$1 AND is_canonical=TRUE', [fixture.metadata.metadataReleaseGroupId])).rows;
      assert.deepEqual(winners.map(row => row.id), [fixture.metadata.metadataReleaseId]);
    });
  });
});
