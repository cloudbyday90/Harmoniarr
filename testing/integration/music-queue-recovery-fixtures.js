/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomUUID } from 'node:crypto';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createMusicQueueRecoveryService } from '../../src/server/import-candidates/music-queue-recovery-service.js';
import { createMusicQueueRecoveryStore } from '../../src/server/import-candidates/music-queue-recovery-store.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createImportCandidateExecutionRunStore } from '../../src/server/import-candidates/import-candidate-execution-run-store.js';
import { replaceImportExecutionRunItems } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createLibraryDiscoveryRunStore } from '../../src/server/library/library-discovery-run-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';

const consent = (wantedReleaseId, minimumBitrateKbps) => ({ mode: 'allow_fallback_quality', wantedReleaseId, minimumBitrateKbps });

export function createMusicQueueRecoveryFixtureContext({ getPoolFn }) {
  const store = createMusicQueueRecoveryStore({ getPoolFn });
  const executionRuns = createImportCandidateExecutionRunStore({ getPoolFn });
  const discoveryRuns = createLibraryDiscoveryRunStore({ getPoolFn });
  const maintenance = createMaintenanceLockService({ getPoolFn });
  const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
  const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
  const service = createMusicQueueRecoveryService({ store, assertMaintenanceWriteAllowed: guard.assertNoActiveWriteLocks,
    withTransaction, createExecutionRun: executionRuns.createOperationRun,
    createDiscoveryRun: discoveryRuns.createOperationRun });
  return { getPoolFn, pool: getPoolFn(), store, service, executionRuns, discoveryRuns,
    withTransaction, assertMaintenanceWriteAllowed: guard.assertNoActiveWriteLocks };
}
export async function createRecoveryFixtureOwner(pool, preferences = { minimumQuality: 'high', preferredFormat: 'any' }) {
  return (await pool.query(`INSERT INTO app_users(username,password_hash,role,must_change_password,user_preferences)
    VALUES($1,'controlled-integration-hash','requester',false,$2::jsonb) RETURNING id`,
  [`recovery-${randomUUID()}`, JSON.stringify(preferences)])).rows[0];
}
export async function createRecoveryFixtureWantedRelease(pool, owner, metadata) {
  return (await pool.query(`INSERT INTO library_wanted_releases(app_user_id,metadata_artist_id,metadata_release_group_id,
    metadata_release_id,wanted_status,expected_track_count,matched_track_count,missing_track_count)
    VALUES($1,$2,$3,$4,'missing',1,0,1) RETURNING id`,
  [owner.id, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId])).rows[0].id;
}
export async function seedMusicQueueRecoveryFixture(context, { shared = false, fallback = false } = {}) {
  const { pool, store, executionRuns } = context;
  const preferences = fallback ? { minimumQuality: 'lossless', preferredFormat: 'flac' } : undefined;
  const owner = await createRecoveryFixtureOwner(pool, preferences);
  const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: `Recovery ${owner.id}` });
  const wantedId = await createRecoveryFixtureWantedRelease(pool, owner, metadata);
  const wantedIds = [wantedId];
  if (shared) wantedIds.push(await createRecoveryFixtureWantedRelease(pool, await createRecoveryFixtureOwner(pool, preferences), metadata));
  const searchId = `recovery-${randomUUID()}`;
  const discoveryId = (await pool.query(`INSERT INTO library_discovery_requests(metadata_artist_id,metadata_release_group_id,
    metadata_release_id,wanted_status,search_mode,request_status,last_search_at,evidence)
    VALUES($1,$2,$3,'missing','automatic','blocked',NOW(),jsonb_build_object('lastSearchId',$4::text,
      'lastDispatchAttemptedAt',NOW(),'lastSearchResult',jsonb_build_object('observedAt',NOW()))) RETURNING id`,
  [metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId, searchId])).rows[0].id;
  for (const [index, id] of wantedIds.entries()) {
    await pool.query(`INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id,evidence)
      VALUES($1,$2,$3::jsonb)`, [discoveryId, id, JSON.stringify(fallback ? { musicQueueQualityOverride: consent(id, index ? 320 : 256) } : {})]);
  }
  const normalizedPayload = { extensions: ['mp3'], bitrateKbps: 320,
    musicQueue: { wantedReleaseId: wantedId, ...(shared ? { wantedReleaseIds: wantedIds, sharedOperatorDiscovery: true } : {}),
      profileCode: fallback ? 'lossless_archive' : 'high_quality', minimumBitrateKbps: fallback ? 256 : 320,
      ...(fallback ? { qualityOverride: consent(wantedId, 256) } : {}) },
    discoveryScope: { metadataReleaseId: metadata.metadataReleaseId },
    requestOwnership: { metadataReleaseId: metadata.metadataReleaseId, sourceRequestedForUserId: owner.id, sourceType: 'music_queue' } };
  const original = await seedImportCandidateFixture({ queryable: pool,
    candidateOverrides: { status: 'downloading', sourceSearchId: searchId, normalizedPayload },
    files: [{ filename: '01.mp3', extension: 'mp3', sizeBytes: 1000, bitRateKbps: 320, isLocked: false }] });
  const candidate = await store.getCandidate(original.id);
  const observation = captureRecoveryObservation(candidate);
  const origin = await executionRuns.createOperationRun({ status: 'running', requestedCandidateCount: 1,
    summary: { triggerSource: 'missing_music_manual', selectedCandidateId: candidate.id, sourceSearchId: searchId, sourceWantedReleaseId: wantedId } });
  await replaceImportExecutionRunItems(origin.id, [{ importCandidateId: candidate.id, position: 1, itemStatus: 'queued', statusMessage: 'Controlled accepted handoff',
    planningSnapshot: { execution: { acceptedCandidateObservation: observation, handoff: { state: 'confirmed' } } } }], pool);
  return { owner, metadata, wantedId, wantedIds, discoveryId, searchId, candidate, observation, originRunId: origin.id };
}
export async function seedMusicQueueRecoveryReplacement({ pool }, f, { bitrate = 320, searchId = f.searchId, scope = null } = {}) {
  return seedImportCandidateFixture({ queryable: pool, candidateOverrides: { sourceSearchId: searchId,
    folderPath: `Replacement-${randomUUID()}`, normalizedPayload: { ...f.candidate.normalizedPayload, bitrateKbps: bitrate,
      ...(scope ? { requestOwnership: scope } : {}) } },
  files: [{ filename: '01.mp3', extension: 'mp3', sizeBytes: 2000, bitRateKbps: bitrate, isLocked: false }] });
}
export const recoverMusicQueueFixture = (context, f, kind = 'download') => context.service.handleMusicQueueRecovery({ kind,
  failedCandidateId: f.candidate.id, operationRunId: f.originRunId, observation: f.observation, failureReason: 'Controlled terminal observation' });
