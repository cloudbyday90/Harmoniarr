/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { getPool } from '../../src/server/database.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createOperatorArtistSaveService } from '../../src/server/metadata/operator-artist-save-service.js';
import { defaultOperatorArtistMonitoringPolicy } from '../../src/server/metadata/operator-artist-monitoring-policy.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createOperatorTrackScopeVerificationService } from '../../src/server/metadata/operator-track-scope-verification-service.js';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedOperatorReconciliationLifetimeRun } from '../../testing/integration/operator-reconciliation-lifetime-fixture.js';
import { executeOperatorReconciliationFixtureRun } from '../../testing/integration/operator-reconciliation-execution-fixture.js';

const config = resolveIntegrationTestRuntimeConfig();
let postgres;
suite('Current catalog and operator track requirements', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  const scenario = run => withIntegrationApp({ config, run,
    withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });

  async function prepare({ unknown = false, trackMbid = false, subset = false } = {}) {
    const fixture = await seedOperatorReconciliationLifetimeRun();
    const pool = getPool();
    const recording = (await pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id=$1', [fixture.metadata.metadataRecordingId])).rows[0];
    if (subset) {
      await pool.query(`INSERT INTO metadata_tracks(metadata_medium_id,metadata_recording_id,position,title,length_ms)
        VALUES($1,$2,2,'Second track',300000)`, [fixture.metadata.metadataMediumId, fixture.metadata.metadataRecordingId]);
      await pool.query('UPDATE metadata_releases SET track_count=2 WHERE id=$1', [fixture.metadata.metadataReleaseId]);
    }
    const saved = await createOperatorArtistSaveService({ getOperatorArtistProjection: async () => null,
      startMetadataArtistRefresh: async () => ({ accepted: true }) }).saveOperatorArtist({
      appUserId: fixture.user.id, metadataArtistId: fixture.metadata.metadataArtistId, expectedSnapshotRevision: 1,
      draft: { monitoring: { ...defaultOperatorArtistMonitoringPolicy, isMonitored: true,
        monitoredReleaseGroupTypes: ['album'], releaseScope: 'track_only', wantedAutomationMode: 'manual_only', selectionSourceMode: 'policy_plus_overrides' },
      releaseGroupSelections: [], trackOverrides: [{ metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId,
        metadataReleaseId: fixture.metadata.metadataReleaseId, isDesired: true, remapStatus: 'resolved',
        ...(trackMbid ? { trackMbid: randomUUID() } : { recordingMbid: unknown ? randomUUID() : recording.musicbrainz_recording_id, mediumPosition: 1, trackPosition: 1 }) }] },
    });
    return { ...fixture, saved };
  }

  for (const entry of [{ name: 'unknown recording', unknown: true }, { name: 'unsupported track MBID', trackMbid: true }]) {
    test(`${entry.name} cannot manufacture a verified acquisition grant`, { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await prepare(entry);
        const { state } = await executeOperatorReconciliationFixtureRun(fixture.saved.reconciliation.run);
        assert.deepEqual(state.requests, []);
        assert.deepEqual(state.events, []);
        assert.equal(state.operation.status, 'completed');
        assert.equal(state.operation.summary.trackScopeBlockedCount, 1);
      });
    });
  }

  for (const subset of [false, true]) {
    test(subset ? 'partial consent persists exact track scope without granting whole-release work'
      : 'verified whole catalog consent retains supported release-wide work', { timeout: config.scenarioTimeoutMs }, async () => {
      await scenario(async () => {
        const fixture = await prepare({ subset });
        const { state } = await executeOperatorReconciliationFixtureRun(fixture.saved.reconciliation.run);
        assert.equal(state.operation.status, 'completed');
        assert.equal(state.requests.length, 1);
        assert.equal(state.events.length, 1);
        const scope = state.requests[0].evidence.operatorArtistReconciliation.operatorTrackScope;
        assert.equal(scope.mode, subset ? 'tracks' : 'release');
        assert.deepEqual(scope.tracks.map(track => track.metadataTrackId), [fixture.metadata.metadataTrackId]);
        const wanted = await createDatabaseTransactionRunner()(queryable => createLibraryWantedReleaseReader().readWantedReleaseProjection({ queryable }));
        assert.deepEqual(wanted.wantedReleases[0].evidence.operatorTrackScope, scope);
        await createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {} }).reconcileWantedReleases();
        const persisted = (await getPool().query('SELECT app_user_id,evidence,expected_track_count FROM library_wanted_releases')).rows;
        assert.equal(persisted.length, 1);
        assert.equal(persisted[0].app_user_id, fixture.user.id);
        assert.deepEqual(persisted[0].evidence.operatorTrackScope, scope);
        assert.equal(persisted[0].expected_track_count, 1);
        const verifier = createOperatorTrackScopeVerificationService();
        const invoke = () => createDatabaseTransactionRunner()(queryable => verifier.assertScopesCurrent([{ scope }], { queryable }));
        if (subset) {
          const discovery = (await getPool().query('SELECT request_status,blocked_reason,search_attempt_count FROM library_discovery_requests')).rows[0];
          assert.equal(discovery.request_status, 'blocked');
          assert.equal(discovery.blocked_reason, 'operator_track_scope_verification_required');
          assert.equal(discovery.search_attempt_count, 0);
          assert.deepEqual(state.discovery[0].evidence.operatorTrackScope, scope);
          const dispatch = createLibraryDiscoveryDispatchService({ libraryDiscoveryRequestStore: createLibraryDiscoveryRequestStore(),
            slskdService: { startSearch: async () => assert.fail('Subset cannot call provider') },
            importCandidateService: { ingestSlskdSearchResponses: async () => assert.fail('Subset cannot create candidates') } });
          const dispatched = await dispatch.dispatchReadyDiscoveryRequests({ actorUserId: fixture.user.id });
          assert.equal(dispatched.dispatchedCount, 0);
          const legacy = { normalizedPayload: { requestOwnership: { sourceMediaRequestId: state.requests[0].id } } };
          await assert.rejects(verifier.assertCandidateCurrent(legacy), { code: 'operator_track_scope_verification_required' });
          const candidate = (await getPool().query(`INSERT INTO import_candidates
            (source_provider,source_search_id,source_response_key,username,folder_path,raw_payload,normalized_payload,discovered_at,status)
            VALUES('slskd','scoped-native-search','scoped-response','scoped-peer','/scoped','{}'::jsonb,$1::jsonb,NOW(),'import_pending') RETURNING id`,
          [JSON.stringify(legacy.normalizedPayload)])).rows[0];
          const apply = createImportCandidateApplyOperationService({ statFn: async () => assert.fail('Subset cannot inspect filesystem for apply'),
            recordImportOperationFn: async () => assert.fail('Subset cannot record a filesystem mutation') });
          await assert.rejects(apply.applyImportCandidatePreview({ importCandidateId: candidate.id,
            applyPreview: { files: [{ filename: '01 Foil.flac' }], summary: { status: 'ready' } } }),
          { code: 'operator_track_scope_verification_required' });
          await assert.rejects(invoke(), { code: 'operator_track_scope_verification_required' });
          await assert.rejects(createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext({
            operatorLinks: [{ wantedReleaseId: randomUUID(), appUserId: fixture.user.id, operatorTrackScope: scope, qualityPreferences: {} },
              { wantedReleaseId: randomUUID(), appUserId: fixture.other.id, qualityPreferences: {} }],
          }), { code: 'operator_track_scope_verification_required' });
        } else {
          await invoke();
          await getPool().query('UPDATE metadata_tracks SET title=$2 WHERE id=$1', [fixture.metadata.metadataTrackId, 'Changed track']);
          await assert.rejects(invoke(), { code: 'operator_track_scope_verification_required' });
        }
      });
    });
  }

  test('catalog mutation after planning refuses atomic request/event publication', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async () => {
      const fixture = await prepare();
      const { state } = await executeOperatorReconciliationFixtureRun(fixture.saved.reconciliation.run, {
        beforeMaterialize: async () => getPool().query('DELETE FROM metadata_tracks WHERE id=$1', [fixture.metadata.metadataTrackId]),
      });
      assert.equal(state.operation.status, 'failed');
      assert.equal(state.operation.error_message, 'Saved artist policy or catalog changed before request publication');
      assert.deepEqual(state.requests, []);
      assert.deepEqual(state.events, []);
    });
  });
});
