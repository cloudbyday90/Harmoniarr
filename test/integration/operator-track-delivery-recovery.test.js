/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedTrackDeliveryRecoveryFixture, runTrackDeliveryApply } from '../../testing/integration/operator-track-delivery-recovery-fixture.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { buildMediaRequestFulfillmentStatus } from '../../src/server/library/library-media-request-fulfillment-service.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
const refused = { code: 'operator_track_scope_verification_required' };

suite('Durable private delivery recovery and owned acquisition source lifecycle', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a failed second delivery reuses only recorded current bytes, publishes atomically and reopens only missing owned media', {
    timeout: config.scenarioTimeoutMs,
  }, async () => withIntegrationApp({ config, withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
    run: async ({ workspaceDir }) => {
      const c = await seedTrackDeliveryRecoveryFixture(workspaceDir);
      const preview = await c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId });
      const first = preview.files[0]; const second = preview.files[1];
      const filesystem = createMediaFilesystemService(); const mutations = [];
      const partial = createImportCandidateApplyOperationService({ mediaInspectionService: c.inspection,
        mediaFilesystemService: { ...filesystem, applyExclusiveFileMutationPlan: async plan => {
          mutations.push(plan);
          if (plan.destinationPath === second.libraryTarget.path) throw new Error('Controlled second private copy failure');
          return filesystem.applyExclusiveFileMutationPlan(plan);
        } } });
      const failed = await runTrackDeliveryApply(c, partial);
      assert.equal(failed.item.itemStatus, 'apply_failed');
      let current = await c.candidates.getImportCandidate({ importCandidateId: c.candidateId });
      assert.equal(current.status, 'import_pending');
      assert.equal(current.normalizedPayload.operatorTrackDeliveryProgress.files.length, 1);
      assert.equal(Object.hasOwn(current.normalizedPayload, 'operatorTrackFulfillment'), false);
      const bytes = await readFile(first.libraryTarget.path);
      const progress = current.normalizedPayload.operatorTrackDeliveryProgress;
      await symlink(first.delivery.libraryRoot, second.delivery.libraryRoot, 'junction');
      try { await assert.rejects(c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId }), refused); }
      finally { await rm(second.delivery.libraryRoot, { force: true }); }
      await writeFile(first.libraryTarget.path, 'Changed first delivery');
      await assert.rejects(c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId }), refused);
      await writeFile(first.libraryTarget.path, bytes);
      const owner = second.delivery.ownerId;
      const originalRoot = (await c.pool.query('SELECT managed_library_relative_root FROM app_users WHERE id=$1', [owner])).rows[0].managed_library_relative_root;
      for (const change of ['root', 'disabled', 'consent', 'catalog', 'checkpoint']) {
        if (change === 'root') await c.pool.query("UPDATE app_users SET managed_library_relative_root='changed-recovery-root' WHERE id=$1", [owner]);
        if (change === 'disabled') await c.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [owner]);
        if (change === 'consent') await c.pool.query('UPDATE operator_track_override SET is_desired=FALSE WHERE app_user_id=$1', [owner]);
        if (change === 'catalog') await c.pool.query("UPDATE metadata_tracks SET title='Changed catalog' WHERE id=$1", [progress.files[0].verifiedTrack.metadataTrackId]);
        if (change === 'checkpoint') await c.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{operatorTrackDeliveryProgress}','null'::jsonb) WHERE id=$1", [c.candidateId]);
        await assert.rejects(c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId }), refused);
        if (change === 'root') await c.pool.query('UPDATE app_users SET managed_library_relative_root=$2 WHERE id=$1', [owner, originalRoot]);
        if (change === 'disabled') await c.pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [owner]);
        if (change === 'consent') await c.pool.query('UPDATE operator_track_override SET is_desired=TRUE WHERE app_user_id=$1', [owner]);
        if (change === 'catalog') await c.pool.query('UPDATE metadata_tracks SET title=$2 WHERE id=$1', [progress.files[0].verifiedTrack.metadataTrackId, progress.files[0].verifiedTrack.title]);
        if (change === 'checkpoint') await c.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{operatorTrackDeliveryProgress}',$2::jsonb) WHERE id=$1", [c.candidateId, JSON.stringify(progress)]);
      }
      await c.pool.query(`CREATE FUNCTION reject_track_source_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='operator_track_source_retired' THEN RAISE EXCEPTION 'Controlled required source event'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_track_source_event BEFORE INSERT ON media_request_events FOR EACH ROW EXECUTE FUNCTION reject_track_source_event()`);
      const retryMutations = [];
      const recovery = createImportCandidateApplyOperationService({ mediaInspectionService: c.inspection,
        mediaFilesystemService: { ...filesystem, applyExclusiveFileMutationPlan: async plan => { retryMutations.push(plan); return filesystem.applyExclusiveFileMutationPlan(plan); } } });
      await runTrackDeliveryApply(c, recovery);
      current = await c.candidates.getImportCandidate({ importCandidateId: c.candidateId });
      assert.equal(current.status, 'import_pending'); assert.equal(current.normalizedPayload.operatorTrackDeliveryProgress.files.length, 2);
      assert.equal(Object.hasOwn(current.normalizedPayload, 'operatorTrackFulfillment'), false);
      assert.equal(retryMutations.length, 1); // The second staging copy already exists from the failed attempt.
      assert.equal(retryMutations[0].destinationPath, second.libraryTarget.path);
      assert.deepEqual(await readFile(first.libraryTarget.path), bytes);
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM media_requests WHERE request_state='needs_fetch'")).rows[0].count, 2);
      await c.pool.query('DROP TRIGGER reject_track_source_event ON media_request_events');
      retryMutations.length = 0;
      const published = await runTrackDeliveryApply(c, recovery);
      assert.equal(published.item.itemStatus, 'applied'); assert.equal(retryMutations.length, 0);
      current = await c.candidates.getImportCandidate({ importCandidateId: c.candidateId });
      assert.equal(current.status, 'applied'); assert.equal(current.normalizedPayload.operatorTrackFulfillment.receipts.length, 2);
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM media_requests WHERE request_state='already_exists'")).rows[0].count, 2);
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM operation_runs WHERE operation_type='import_candidate_execution_planning'")).rows[0].count, 0);
      for (const file of preview.files) assert.equal((await stat(file.sourceFile.path)).isFile(), true);
      assert.equal((await stat(c.third)).isFile(), true);
      await assert.rejects(stat(join(first.delivery.libraryRoot, 'union', '03 Unrequested third.flac')), { code: 'ENOENT' });
      const wanted = createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {} });
      const discovery = createLibraryDiscoveryRequestService({ assertMaintenanceWriteAllowed: async () => {} });
      await wanted.reconcileWantedReleases(); await discovery.reconcileDiscoveryRequests();
      assert.equal((await c.pool.query('SELECT COUNT(*)::int count FROM library_wanted_releases')).rows[0].count, 0);
      assert.equal((await c.pool.query('SELECT COUNT(*)::int count FROM library_discovery_requests')).rows[0].count, 0);
      await writeFile(first.libraryTarget.path, 'Owned media is no longer the delivered bytes');
      await wanted.reconcileWantedReleases(); await discovery.reconcileDiscoveryRequests();
      assert.deepEqual((await c.pool.query('SELECT app_user_id FROM library_wanted_releases')).rows.map(row => row.app_user_id), [first.delivery.ownerId]);
      const requests = (await c.pool.query('SELECT * FROM media_requests')).rows;
      for (const request of requests) {
        const missing = request.requested_for_user_id === first.delivery.ownerId;
        assert.equal(request.request_state, missing ? 'needs_fetch' : 'already_exists');
        const status = buildMediaRequestFulfillmentStatus({ request: { id: request.id, evidence: request.evidence,
          requestedForUser: { id: request.requested_for_user_id } }, importCandidates: [current] });
        assert.equal(status.code === 'fulfilled', !missing);
      }
      await wanted.reconcileWantedReleases();
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM media_request_events WHERE event_type='operator_track_source_reopened'")).rows[0].count, 1);
    } }));
  test('expiry during a required delivery event rolls back its checkpoint and leaves an unrecorded copy under review', {
    timeout: config.scenarioTimeoutMs,
  }, async () => withIntegrationApp({ config, withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => postgres.runIsolatedDatabase(run, { phaseObserver }),
    run: async ({ workspaceDir }) => {
      const c = await seedTrackDeliveryRecoveryFixture(workspaceDir);
      await c.pool.query(`CREATE FUNCTION expire_track_delivery_lease() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='operator_track_delivery_verified' THEN UPDATE job_leases
          SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key='import_candidate_apply:'||(NEW.details->>'operationRunId');
        END IF; RETURN NEW; END $$;
        CREATE TRIGGER expire_track_delivery_lease BEFORE INSERT ON import_candidate_events FOR EACH ROW EXECUTE FUNCTION expire_track_delivery_lease()`);
      const preview = await c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId });
      const result = await runTrackDeliveryApply(c, createImportCandidateApplyOperationService({ mediaInspectionService: c.inspection }));
      assert.equal(result.item.itemStatus, 'apply_failed');
      const candidate = await c.candidates.getImportCandidate({ importCandidateId: c.candidateId });
      assert.equal(candidate.status, 'import_pending');
      assert.equal(Object.hasOwn(candidate.normalizedPayload, 'operatorTrackDeliveryProgress'), false);
      assert.equal(Object.hasOwn(candidate.normalizedPayload, 'operatorTrackFulfillment'), false);
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM import_candidate_events WHERE event_type='operator_track_delivery_verified'")).rows[0].count, 0);
      assert.equal((await stat(preview.files[0].libraryTarget.path)).isFile(), true);
      assert.equal((await c.preview.previewImportCandidateApply({ importCandidateId: c.candidateId })).summary.status, 'blocked');
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM media_requests WHERE request_state='already_exists'")).rows[0].count, 0);
      assert.equal((await c.pool.query("SELECT COUNT(*)::int count FROM operation_runs WHERE operation_type='import_candidate_execution_planning'")).rows[0].count, 0);
    } }));
});
