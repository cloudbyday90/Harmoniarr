/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';
import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { readOperatorReconciliationLifetimeState, seedOperatorReconciliationLifetimeRun } from '../../testing/integration/operator-reconciliation-lifetime-fixture.js';
import { saveNewOperatorPolicy } from '../../testing/integration/operator-reconciliation-authority-fixture.js';

const config = resolveIntegrationTestRuntimeConfig();
let postgres;

suite('Operator monitoring opt-out at request publication', () => {
  before(async () => {
    postgres = await createPostgresIntegrationRuntime({ config, env: {} });
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  const scenario = run => withIntegrationApp({ config, run,
    withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) =>
      postgres.runIsolatedDatabase(execute, { phaseObserver }),
  });

  async function executeRun(run, { forgeEligibility = false } = {}) {
    const requests = createOperatorArtistReconciliationRequestService({
      reconcileDiscoveryRequests: createLibraryDiscoveryRequestService().reconcileDiscoveryRequests,
    });
    let captured;
    const execution = createOperatorArtistReconciliationExecutionService({
      operatorArtistReconciliationRequestService: {
        materializeDesiredReleaseRequests: async input => {
          captured = structuredClone(input.publicationSource);
          const desiredReleases = forgeEligibility
            ? input.desiredReleases.map(release => ({ ...release, eligibleForDownstreamWork: true }))
            : input.desiredReleases;
          return requests.materializeDesiredReleaseRequests({ ...input, desiredReleases });
        },
      },
    });
    const worker = createOperatorArtistReconciliationWorker({
      ...createOperatorArtistReconciliationRunStore(),
      executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation,
    });
    try {
      const claimed = await createOperationQueueStore().claimNextRunnableRun({
        operationTypes: ['operator_artist_reconciliation'],
      });
      assert.equal(claimed.id, run.id);
      const { completion } = await worker.startWorkerRun({ ...run, runId: run.id });
      await completion;
    } finally {
      await worker.close();
    }
    return { captured, state: await readOperatorReconciliationLifetimeState(run.id) };
  }

  for (const forgeEligibility of [false, true]) {
    test(forgeEligibility
      ? 'unchanged saved opt-out refuses caller-forged eligibility in the SQL transaction'
      : 'saved opt-out completes its queued reconciliation without creating acquisition work',
    { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun();
        const saved = await saveNewOperatorPolicy(fixture);
        assert.equal(saved.snapshot.snapshotRevision, 2);
        assert.equal(saved.reconciliation.run.snapshotId, saved.snapshot.id);
        const wanted = await createDatabaseTransactionRunner()(queryable =>
          createLibraryWantedReleaseReader().readWantedReleaseProjection({ queryable }));
        assert.deepEqual(wanted.wantedReleases, []);
        const { captured, state } = await executeRun(saved.reconciliation.run, { forgeEligibility });
        assert.equal(captured.monitoring.isMonitored, false);
        assert.equal(captured.snapshot.snapshotRevision, 2);
        assert.deepEqual(state.requests, []);
        assert.deepEqual(state.events, []);
        assert.deepEqual(state.discovery, []);
        if (forgeEligibility) {
          assert.equal(state.operation.status, 'failed');
          assert.equal(state.operation.error_message, 'Saved artist policy or catalog changed before request publication');
        } else {
          assert.equal(state.operation.status, 'completed');
          assert.equal(state.operation.summary.unmonitoredBlockedCount, 1);
          assert.equal(state.operation.summary.policyDesiredReleaseCount, 1);
          assert.equal(state.operation.summary.downstreamEligibleReleaseCount, 0);
          assert.equal(state.operation.summary.downstreamCreatedRequestCount, 0);
        }
      });
    });
  }

  test('explicit monitored consent still publishes under manual-only track-only policy',
    { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun();
        const saved = await createOperatorArtistSaveService({
          getOperatorArtistProjection: async () => null,
          startMetadataArtistRefresh: async () => ({ accepted: true }),
        }).saveOperatorArtist({
          appUserId: fixture.user.id,
          metadataArtistId: fixture.metadata.metadataArtistId,
          expectedSnapshotRevision: fixture.snapshot.snapshotRevision,
          draft: {
            monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true,
              monitoredReleaseGroupTypes: ['album'], releaseScope: 'track_only',
              wantedAutomationMode: 'manual_only', selectionSourceMode: 'policy_plus_overrides' },
            releaseGroupSelections: [{ metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId,
              resolvedMetadataReleaseId: fixture.metadata.metadataReleaseId,
              selectionSource: 'manual', selectionOrigin: 'manual_inclusion', selectionState: 'selected' }],
            trackOverrides: [],
          },
        });
        const { state } = await executeRun(saved.reconciliation.run);
        assert.equal(state.operation.status, 'completed');
        assert.equal(state.operation.summary.unmonitoredBlockedCount, 0);
        assert.equal(state.operation.summary.explicitDesiredReleaseCount, 1);
        assert.equal(state.requests.length, 1);
        assert.equal(state.requests[0].requested_by_user_id, fixture.user.id);
        assert.equal(state.requests[0].matched_metadata_release_id, fixture.metadata.metadataReleaseId);
        assert.equal(state.requests[0].evidence.operatorArtistReconciliation.isExplicitSelection, true);
        assert.equal(state.events.length, 1);
        assert.equal(state.events[0].media_request_id, state.requests[0].id);
        assert.equal(state.discovery.length, 1);
      });
    });

  test('saved opt-out preserves an existing request and its required event',
    { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await seedOperatorReconciliationLifetimeRun();
        const { state: beforeSave } = await executeRun(fixture.run);
        assert.equal(beforeSave.operation.status, 'completed');
        assert.equal(beforeSave.requests.length, 1);
        assert.equal(beforeSave.events.length, 1);
        const saved = await saveNewOperatorPolicy(fixture);
        const { state } = await executeRun(saved.reconciliation.run);
        assert.equal(state.operation.status, 'completed');
        assert.equal(state.operation.summary.activeRequestBlockedCount, 1);
        assert.equal(state.operation.summary.downstreamCreatedRequestCount, 0);
        assert.deepEqual(state.requests, beforeSave.requests);
        assert.deepEqual(state.events, beforeSave.events);
        assert.deepEqual(state.discovery, beforeSave.discovery);
      });
    });
});
