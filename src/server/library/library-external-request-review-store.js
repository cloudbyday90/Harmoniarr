/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';

const intentSelect = `
  SELECT intent.*, release.title AS release_title, artist.name AS artist_name,
    release.metadata_release_group_id, run.status AS run_status
  FROM library_external_request_release_intents intent
  JOIN metadata_releases release ON release.id = intent.metadata_release_id
  JOIN metadata_release_groups release_group ON release_group.id = release.metadata_release_group_id
  JOIN metadata_artists artist ON artist.id = release_group.metadata_artist_id
  LEFT JOIN operation_runs run ON run.id = intent.operation_run_id
`;

function mapIntent(row) {
  return row ? {
    id: row.id,
    mediaRequestId: row.media_request_id,
    metadataReleaseId: row.metadata_release_id,
    requestedForUserId: row.requested_for_user_id,
    providerKey: row.provider_key,
    providerEvidence: row.provider_evidence,
    approvedByUserId: row.approved_by_user_id,
    createdAt: row.created_at,
    operationRunId: row.operation_run_id,
    status: row.run_status ?? null,
    artistName: row.artist_name,
    releaseTitle: row.release_title,
    releaseGroupId: row.metadata_release_group_id,
  } : null;
}

export function createLibraryExternalRequestReviewStore({ getPoolFn = getPool } = {}) {
  const db = (queryable) => queryable ?? getPoolFn();

  async function lockRequest({ mediaRequestId, queryable }) {
    if (!queryable) throw new Error('Request locking requires a transaction client');
    await queryable.query('SELECT id FROM media_requests WHERE id = $1 FOR UPDATE', [mediaRequestId]);
  }

  async function listIntents({ mediaRequestId, queryable = null }) {
    const result = await db(queryable).query(`${intentSelect} WHERE intent.media_request_id = $1 ORDER BY intent.created_at, intent.id`, [mediaRequestId]);
    return result.rows.map(mapIntent);
  }

  async function listIntentsByMediaRequestIds({ mediaRequestIds }) {
    if (mediaRequestIds.length === 0) return [];
    const result = await getPoolFn().query(`${intentSelect} WHERE intent.media_request_id = ANY($1::uuid[])`, [mediaRequestIds]);
    return result.rows.map(mapIntent);
  }

  async function getIntentById({ intentId, queryable = null }) {
    const result = await db(queryable).query(`${intentSelect} WHERE intent.id = $1`, [intentId]);
    return mapIntent(result.rows[0]);
  }

  async function getRelease({ metadataReleaseId, queryable = null }) {
    const result = await db(queryable).query(`
      SELECT release.id, release.title, artist.name AS artist_name
      FROM metadata_releases release
      JOIN metadata_release_groups release_group ON release_group.id = release.metadata_release_group_id
      JOIN metadata_artists artist ON artist.id = release_group.metadata_artist_id
      WHERE release.id = $1
    `, [metadataReleaseId]);
    return result.rows[0] ?? null;
  }

  async function createIntent({ mediaRequestId, metadataReleaseId, requestedForUserId, providerKey, providerEvidence, approvedByUserId, queryable }) {
    const result = await db(queryable).query(`
      INSERT INTO library_external_request_release_intents
        (media_request_id, metadata_release_id, requested_for_user_id, provider_key, provider_evidence, approved_by_user_id)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id
    `, [mediaRequestId, metadataReleaseId, requestedForUserId, providerKey, JSON.stringify(providerEvidence), approvedByUserId]);
    return getIntentById({ intentId: result.rows[0].id, queryable });
  }

  async function setIntentRun({ intentId, operationRunId, queryable }) {
    await db(queryable).query('UPDATE library_external_request_release_intents SET operation_run_id = $2 WHERE id = $1', [intentId, operationRunId]);
    return getIntentById({ intentId, queryable });
  }

  async function retryFailedProviderItems({ mediaRequestId, queryable }) {
    await db(queryable).query(`UPDATE provider_ingest_requests SET status = 'planned', updated_at = NOW()
      WHERE media_request_id = $1 AND status = 'failed'`, [mediaRequestId]);
  }

  return { lockRequest, listIntents, listIntentsByMediaRequestIds, getIntentById, getRelease, createIntent, setIntentRun, retryFailedProviderItems };
}
