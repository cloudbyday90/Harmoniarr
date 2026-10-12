/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { getPool } from '../database.js';
import { normalizeOperatorTrackOverrideRow } from './operator-track-override-policy.js';
import { listImportCandidateFiles } from '../import-candidates/import-candidate-repository.js';
import { createOperatorTrackReceiptStore } from './operator-track-receipt-store.js';

export function createOperatorTrackAcquisitionStore({ getPoolFn = getPool,
  receiptStore = createOperatorTrackReceiptStore({ getPoolFn }) } = {}) {
  const db = queryable => queryable ?? getPoolFn();
  async function readWanted({ ids = [], metadataReleaseId = null, queryable }) {
    const result = metadataReleaseId
      ? await db(queryable).query('SELECT id,app_user_id,evidence,metadata_release_id FROM library_wanted_releases WHERE metadata_release_id=$1::uuid', [metadataReleaseId])
      : await db(queryable).query(`SELECT wanted.id,wanted.app_user_id,wanted.evidence,wanted.metadata_release_id FROM library_wanted_releases wanted
        WHERE wanted.id=ANY($1::uuid[]) OR wanted.metadata_release_id IN
        (SELECT metadata_release_id FROM library_wanted_releases WHERE id=ANY($1::uuid[]))`, [ids]);
    return result.rows;
  }
  async function readRequest({ requestId, queryable }) {
    const result = await db(queryable).query('SELECT evidence,matched_metadata_release_id,requested_for_user_id FROM media_requests WHERE id=$1::uuid', [requestId]);
    return result.rows;
  }
  async function readCandidate({ importCandidateId, queryable }) {
    const result = await db(queryable).query('SELECT normalized_payload FROM import_candidates WHERE id=$1::uuid', [importCandidateId]);
    return result.rows[0] ? { id: importCandidateId, normalizedPayload: result.rows[0].normalized_payload } : null;
  }
  async function readParticipantRequests({ ownerIds, metadataReleaseId, queryable }) {
    const result = await db(queryable).query(`SELECT id,requested_for_user_id,evidence FROM media_requests
      WHERE requested_for_user_id=ANY($1::uuid[]) AND matched_metadata_release_id=$2::uuid
        AND request_state NOT IN ('cancelled','failed')
      ORDER BY created_at DESC,id DESC`, [ownerIds, metadataReleaseId]);
    return result.rows;
  }
  async function readDeliveryOwner({ ownerId, queryable }) {
    const result = await db(queryable).query('SELECT id,is_disabled,managed_library_relative_root FROM app_users WHERE id=$1::uuid', [ownerId]);
    return result.rows[0] ?? null;
  }
  async function readCurrentConsent({ ownerId, metadataReleaseId, queryable }) {
    const result = await db(queryable).query(`SELECT monitoring.is_monitored,users.is_disabled,
      COALESCE((SELECT jsonb_agg(overrides) FROM operator_track_override overrides
        WHERE overrides.app_user_id=$1::uuid AND overrides.metadata_release_group_id=release.metadata_release_group_id),'[]'::jsonb) AS overrides
      FROM metadata_releases release
      JOIN metadata_release_groups release_group ON release_group.id=release.metadata_release_group_id
      JOIN operator_artist_monitoring monitoring ON monitoring.metadata_artist_id=release_group.metadata_artist_id AND monitoring.app_user_id=$1::uuid
      JOIN app_users users ON users.id=monitoring.app_user_id WHERE release.id=$2::uuid`, [ownerId, metadataReleaseId]);
    const row = result.rows[0];
    return row ? { isMonitored: row.is_monitored, isDisabled: row.is_disabled,
      overrides: row.overrides.map(normalizeOperatorTrackOverrideRow) } : null;
  }
  async function readFiles({ importCandidateId, queryable }) {
    return listImportCandidateFiles(importCandidateId, db(queryable));
  }
  async function readReleaseMbid({ metadataReleaseId, queryable }) {
    const result = await db(queryable).query('SELECT musicbrainz_release_id FROM metadata_releases WHERE id=$1::uuid', [metadataReleaseId]);
    return result.rows[0]?.musicbrainz_release_id ?? null;
  }
  async function saveFulfillment({ importCandidateId, receipt, queryable }) {
    await db(queryable).query(`UPDATE import_candidates SET normalized_payload=normalized_payload
      || jsonb_build_object('operatorTrackFulfillment',$2::jsonb) WHERE id=$1::uuid`, [importCandidateId, JSON.stringify(receipt)]);
  }
  async function listFulfillment({ ownerId, metadataReleaseIds, queryable }) {
    return receiptStore.listFulfillment({ ownerId, metadataReleaseIds, queryable });
  }
  return { readWanted, readRequest, readCandidate, readParticipantRequests, readDeliveryOwner,
    readCurrentConsent, readReleaseMbid, readFiles, saveFulfillment, listFulfillment };
}
