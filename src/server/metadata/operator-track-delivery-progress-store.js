/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { getPool } from '../database.js';
import { createOperatorArtistSaveStateStore } from './operator-artist-save-state-store.js';
import { lockLibraryRequestProjection } from '../library/library-request-projection-lock-store.js';
import { lockJobLeaseKey } from '../job-lease-lock-store.js';
import { normalizeJobLease } from '../job-lease-store.js';

export function createOperatorTrackDeliveryProgressStore({ getPoolFn = getPool } = {}) {
  const db = queryable => queryable ?? getPoolFn();
  async function readCandidate({ importCandidateId, queryable, lock = false }) {
    const row = (await db(queryable).query(`SELECT id,status,normalized_payload FROM import_candidates WHERE id=$1::uuid ${lock ? 'FOR UPDATE' : ''}`, [importCandidateId])).rows[0];
    return row ? { id: row.id, status: row.status, normalizedPayload: row.normalized_payload } : null;
  }
  async function lockContext({ candidate, operationRunId = null, expectedLease = null, queryable }) {
    const participants = (candidate.normalizedPayload?.musicQueue ?? candidate.normalizedPayload?.musicQueueContext)?.operatorTrackParticipants;
    const releaseId = participants?.[0]?.scope?.metadataReleaseId;
    const artistId = (await queryable.query(`SELECT release_group.metadata_artist_id FROM metadata_releases release
      JOIN metadata_release_groups release_group ON release_group.id=release.metadata_release_group_id WHERE release.id=$1::uuid`, [releaseId])).rows[0]?.metadata_artist_id;
    for (const owner of [...participants].sort((a, b) => a.ownerId.localeCompare(b.ownerId))) {
      await createOperatorArtistSaveStateStore().lockOperatorArtistSave({ appUserId: owner.ownerId, metadataArtistId: artistId, client: queryable });
    }
    if (operationRunId) {
      await queryable.query('SELECT id FROM operation_runs WHERE id=$1::uuid FOR UPDATE', [operationRunId]);
      await lockJobLeaseKey({ leaseKey: expectedLease.leaseKey, queryable });
    }
    await lockLibraryRequestProjection({ queryable });
    await queryable.query('SELECT id FROM app_users WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE', [participants.map(owner => owner.ownerId)]);
    await queryable.query('SELECT namespace,setting_key FROM app_settings ORDER BY namespace,setting_key FOR SHARE');
    await queryable.query('SELECT id FROM media_requests WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE', [participants.map(owner => owner.mediaRequestId)]);
    return readCandidate({ importCandidateId: candidate.id, queryable, lock: true });
  }
  async function readAuthority({ operationRunId, expectedLease, queryable }) {
    const run = (await queryable.query('SELECT * FROM operation_runs WHERE id=$1::uuid', [operationRunId])).rows[0];
    const lease = normalizeJobLease((await queryable.query('SELECT * FROM job_leases WHERE lease_key=$1', [expectedLease.leaseKey])).rows[0]);
    const clock = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
    return { run, lease, now: clock instanceof Date ? clock.getTime() : Date.parse(clock) };
  }
  async function saveProgress({ importCandidateId, progress, queryable }) {
    return (await queryable.query(`UPDATE import_candidates SET normalized_payload=normalized_payload
      || jsonb_build_object('operatorTrackDeliveryProgress',$2::jsonb) WHERE id=$1::uuid AND status='import_pending' RETURNING id`, [importCandidateId, JSON.stringify(progress)])).rowCount === 1;
  }
  return { readCandidate, lockContext, readAuthority, saveProgress };
}
