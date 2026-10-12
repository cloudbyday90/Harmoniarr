/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLibraryAddMediaFixture, libraryAddRuntimePath } from '../../testing/integration/library-add-media-fixtures.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createImportCandidatePreviewService } from '../../src/server/import-candidates/import-candidate-preview-service.js';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { assertOperatorTrackManifest, assertOperatorTrackMedia } from '../../src/server/metadata/operator-track-file-policy.js';
import { buildMediaRequestFulfillmentStatus } from '../../src/server/library/library-media-request-fulfillment-service.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
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
          assert.notEqual(discovery.blocked_reason, 'operator_track_scope_verification_required');
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
          await invoke();
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

  test('one of two tracks is selected, media-verified, imported and fulfilled only for its owner', { timeout: config.scenarioTimeoutMs }, async () => {
    await scenario(async ({ workspaceDir }) => {
      const fixture = await prepare({ subset: true });
      const pool = getPool();
      await pool.query('UPDATE metadata_tracks SET length_ms=2000 WHERE id=$1', [fixture.metadata.metadataTrackId]);
      await createLibraryReleaseReconciliationStore().replaceLibraryReleaseReconciliations({ reconciliations: [{
        metadataArtistId: fixture.metadata.metadataArtistId, metadataReleaseGroupId: fixture.metadata.metadataReleaseGroupId,
        metadataReleaseId: fixture.metadata.metadataReleaseId, reconciliationStatus: 'complete', expectedTrackCount: 2,
        matchedTrackCount: 2, missingTrackCount: 0, matchedFileCount: 2, duplicateTrackCount: 0,
        evidence: { scope: 'global-coarse-availability' } }] });
      const { state } = await executeOperatorReconciliationFixtureRun(fixture.saved.reconciliation.run);
      assert.equal(state.requests.length, 1, 'Global release counts cannot fulfill this owner\'s selected track');
      const request = state.requests[0];
      const scope = request.evidence.operatorArtistReconciliation.operatorTrackScope;
      const readWanted = () => createDatabaseTransactionRunner()(queryable => createLibraryWantedReleaseReader().readWantedReleaseProjection({ queryable }));
      assert.equal((await readWanted()).wantedReleases.length, 1);
      const releaseMbid = (await pool.query('SELECT musicbrainz_release_id FROM metadata_releases WHERE id=$1', [scope.metadataReleaseId])).rows[0].musicbrainz_release_id;
      const paths = Object.fromEntries(['downloads', 'staging', 'music'].map(key => [key, join(workspaceDir, key)]));
      await mkdir(join(paths.downloads, 'subset'), { recursive: true });
      const sourcePath = join(paths.downloads, 'subset', '01 Foil.flac');
      const siblingPath = join(paths.downloads, 'subset', '02 Second.flac');
      const media = createLibraryAddMediaFixture({ getFixtureRoot: () => workspaceDir });
      assert.equal(await media.verifyTooling(), null);
      await media.mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100',
        '-t', '2', '-ac', '2', '-c:a', 'flac', '-metadata', 'title=Foil', '-metadata', 'track=1', '-metadata', 'disc=1',
        '-metadata', `MUSICBRAINZ_TRACKID=${scope.tracks[0].recordingMbid}`, '-metadata', `MUSICBRAINZ_ALBUMID=${releaseMbid}`, sourcePath], { readonly: false });
      await writeFile(siblingPath, 'Unrequested sibling must remain untouched');
      const siblingBefore = await readFile(siblingPath);
      const candidate = await seedImportCandidateFixture({ queryable: pool, candidateOverrides: {
        status: 'pending', sourceSearchId: 'native-subset-search', folderPath: 'subset', normalizedPayload: {
          musicQueue: { operatorTrackScopes: [{ mediaRequestId: request.id, scope }] }, requestOwnership: {
            sourceMediaRequestId: request.id, sourceRequestedForUserId: fixture.user.id } } },
      files: [{ filename: '01 Foil.flac', extension: 'flac', sizeBytes: (await stat(sourcePath)).size, lengthSeconds: 2, isLocked: false },
        { filename: '02 Second.flac', extension: 'flac', sizeBytes: siblingBefore.length, lengthSeconds: 300, isLocked: false }] });
      const verifier = createOperatorTrackScopeVerificationService();
      const candidates = createImportCandidateService({ pool });
      await candidates.selectImportCandidate({ importCandidateId: candidate.id, actorUserId: fixture.user.id });
      const selected = await candidates.getImportCandidate({ importCandidateId: candidate.id });
      const selection = await createDatabaseTransactionRunner()(queryable => verifier.assertCandidateCurrent(selected, { queryable }));
      assert.equal(selection.files.length, 1);
      const requestedFiles = selection.files.map(file => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
      await verifier.assertCandidateCurrent(selected, { requestedFiles });
      assert.throws(() => assertOperatorTrackManifest(selection, [...requestedFiles, { filename: 'subset\\02 Second.flac', size: siblingBefore.length }]),
        { code: 'operator_track_scope_verification_required' });
      await pool.query('UPDATE operator_track_override SET is_desired=false WHERE app_user_id=$1', [fixture.user.id]);
      await assert.rejects(verifier.assertCandidateCurrent(selected, { requestedFiles }), { code: 'operator_track_scope_verification_required' });
      await pool.query('UPDATE operator_track_override SET is_desired=true WHERE app_user_id=$1', [fixture.user.id]);
      await candidates.markImportCandidateImportPending({ importCandidateId: candidate.id });
      const previewService = createImportCandidatePreviewService({ getImportCandidate: candidates.getImportCandidate,
        loadSettingsFn: async () => ({ paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, libraryAddRuntimePath(value)])) }) });
      const inspection = createMediaInspectionService({ mediaCommandService: { runCommand: ({ binary, args }) => media.mediaCommand(binary, args) } });
      const preview = await createImportCandidateApplyPreviewService({ previewImportCandidate: previewService.previewImportCandidate,
        mediaInspectionService: inspection }).previewImportCandidateApply({ importCandidateId: candidate.id });
      assert.equal(preview.files.length, 1);
      const wrong = structuredClone(preview);
      wrong.files[0].inspection.metadata.tags.musicbrainz_trackid = randomUUID();
      assert.throws(() => assertOperatorTrackMedia({ track: scope.tracks[0], releaseMbid, inspection: wrong.files[0].inspection }),
        { code: 'operator_track_scope_verification_required' });
      const apply = createImportCandidateApplyOperationService({ mediaInspectionService: inspection });
      await assert.rejects(apply.applyImportCandidatePreview({ importCandidateId: candidate.id, applyPreview: wrong, executionMode: 'copy' }),
        { code: 'operator_track_scope_verification_required' });
      const revoked = createImportCandidateApplyOperationService({ mediaInspectionService: inspection,
        onMutationIntent: async () => pool.query('UPDATE operator_track_override SET is_desired=false WHERE app_user_id=$1', [fixture.user.id]) });
      const stopped = await revoked.applyImportCandidatePreview({ importCandidateId: candidate.id, applyPreview: preview, executionMode: 'copy' });
      assert.equal(stopped.summary.failedFileCount, 1);
      await assert.rejects(stat(preview.files[0].stagingTarget.path), { code: 'ENOENT' });
      await pool.query('UPDATE operator_track_override SET is_desired=true WHERE app_user_id=$1', [fixture.user.id]);
      const result = await apply.applyImportCandidatePreview({ importCandidateId: candidate.id, applyPreview: preview, executionMode: 'copy' });
      assert.equal(result.summary.appliedFileCount, 1);
      assert.equal(result.summary.failedFileCount, 0);
      assert.deepEqual(result.fileOperations[0].verifiedTrack, scope.tracks[0]);
      assert.deepEqual(await readFile(siblingPath), siblingBefore);
      await assert.rejects(stat(join(paths.music, 'subset', '02 Second.flac')), { code: 'ENOENT' });
      const eventFailure = new Error('Controlled receipt event failure');
      const failingEvent = createImportCandidateService({ pool, insertImportCandidateEventFn: async () => { throw eventFailure; } });
      await assert.rejects(failingEvent.markImportCandidateApplied({ importCandidateId: candidate.id, applyResult: result }), error => error === eventFailure);
      const rolledBack = await candidates.getImportCandidate({ importCandidateId: candidate.id });
      assert.equal(rolledBack.status, 'import_pending');
      assert.equal(Object.hasOwn(rolledBack.normalizedPayload, 'operatorTrackFulfillment'), false);
      const applied = await candidates.markImportCandidateApplied({ importCandidateId: candidate.id, applyResult: result });
      assert.deepEqual(applied.candidate.normalizedPayload.operatorTrackFulfillment.scope, scope);
      const requested = { ...request, requestedForUser: { id: fixture.user.id } };
      assert.equal(buildMediaRequestFulfillmentStatus({ request: requested, importCandidates: [applied.candidate] }).code, 'fulfilled');
      assert.equal(buildMediaRequestFulfillmentStatus({ request: { ...requested, requestedForUser: { id: fixture.other.id } },
        importCandidates: [applied.candidate] }).code, 'under_review');
      assert.deepEqual((await readWanted()).wantedReleases, []);
      await writeFile(result.fileOperations[0].libraryPath, 'Replaced file cannot retain fulfillment');
      assert.equal((await readWanted()).wantedReleases.length, 1);
    });
  });
});
