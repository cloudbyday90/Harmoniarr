/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

function mapCollection(row) {
  if (!row) return null;
  return {
    mediaRequestId: row.media_request_id, requestedForUserId: row.requested_for_user_id,
    sourceProvider: row.source_provider, sourceResourceType: row.source_resource_type,
    sourceIdentifier: row.source_identifier, storefront: row.storefront, expansionPolicy: row.expansion_policy,
    status: row.status, revision: Number(row.revision), pagesCompleted: Number(row.pages_completed),
    itemsSeen: Number(row.items_seen), providerSnapshot: row.provider_snapshot, blockedReason: row.blocked_reason,
    reviewedAt: row.reviewed_at, reviewedByUserId: row.reviewed_by_user_id,
  };
}

function mapWork(row) {
  if (!row) return null;
  return {
    id: row.id, mediaRequestId: row.media_request_id, sourceProvider: row.source_provider,
    sourceResourceType: row.source_resource_type, ingestTargetType: row.ingest_target_type,
    sourceIdentifier: row.source_identifier, canonicalUrl: row.canonical_url,
    pageCursor: row.page_cursor, nextPageCursor: row.next_page_cursor, pageNumber: Number(row.page_number),
    ingestKey: row.ingest_key, evidence: row.evidence ?? {}, status: row.status,
  };
}

export function createLibraryExternalRequestCollectionIntakeStore({ getPoolFn = getPool } = {}) {
  const db = (queryable) => queryable ?? getPoolFn();
  async function getCollection({ mediaRequestId, queryable = null, lock = false }) {
    const result = await db(queryable).query(`SELECT * FROM library_external_request_collections WHERE media_request_id = $1${lock ? ' FOR UPDATE' : ''}`, [mediaRequestId]);
    return mapCollection(result.rows[0]);
  }
  async function lockRequest({ mediaRequestId, queryable }) {
    await queryable.query('SELECT id FROM media_requests WHERE id = $1 FOR UPDATE', [mediaRequestId]);
  }
  async function isCancellationRequested({ runId, queryable = null }) {
    if (!runId) return false;
    const result = await db(queryable).query(`SELECT cancel_requested_at, cancelled_at FROM operation_runs WHERE id = $1${queryable ? ' FOR SHARE' : ''}`, [runId]);
    return Boolean(result.rows[0]?.cancel_requested_at || result.rows[0]?.cancelled_at);
  }
  async function hasOtherPreparation({ mediaRequestId, operationRunId, queryable }) {
    const result = await queryable.query(`SELECT 1 FROM operation_runs
      WHERE operation_type = ANY($3::text[])
        AND status IN ('pending', 'running', 'paused') AND summary->>'mediaRequestId' = $1
        AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`, [mediaRequestId, operationRunId,
      [operationRunRegistry.libraryExternalIntakePlanning.operationType, operationRunRegistry.libraryExternalIntakeExecution.operationType]]);
    return result.rowCount > 0;
  }
  async function hasDecisions({ mediaRequestId, queryable }) {
    const result = await queryable.query(`SELECT 1 FROM library_external_request_collection_items
      WHERE media_request_id = $1 AND decision <> 'pending' LIMIT 1`, [mediaRequestId]);
    return result.rowCount > 0;
  }
  async function hasApprovedIntents({ mediaRequestId, queryable }) {
    const result = await queryable.query('SELECT 1 FROM library_external_request_release_intents WHERE media_request_id = $1 LIMIT 1', [mediaRequestId]);
    return result.rowCount > 0;
  }
  async function initialize({ mediaRequestId, requestedForUserId, normalizedSource, queryable }) {
    // A restart resets only undecided evidence, under the request lock and active-work guard.
    await queryable.query('DELETE FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId]);
    await queryable.query('DELETE FROM provider_ingest_requests WHERE media_request_id = $1', [mediaRequestId]);
    const result = await queryable.query(`INSERT INTO library_external_request_collections
      (media_request_id, requested_for_user_id, source_provider, source_resource_type, source_identifier, storefront)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (media_request_id) DO UPDATE SET requested_for_user_id = EXCLUDED.requested_for_user_id,
        source_provider = EXCLUDED.source_provider, source_resource_type = EXCLUDED.source_resource_type,
        source_identifier = EXCLUDED.source_identifier, storefront = EXCLUDED.storefront,
        status = 'preparing', revision = library_external_request_collections.revision + 1,
        pages_completed = 0, items_seen = 0, provider_snapshot = NULL, blocked_reason = NULL,
        reviewed_at = NULL, reviewed_by_user_id = NULL, updated_at = NOW() RETURNING *`,
    [mediaRequestId, requestedForUserId, normalizedSource.provider, normalizedSource.resourceType, normalizedSource.sourceIdentifier, normalizedSource.storefront ?? null]);
    return mapCollection(result.rows[0]);
  }
  async function insertWork({ row, queryable }) {
    const result = await queryable.query(`INSERT INTO provider_ingest_requests
      (media_request_id, source_provider, source_resource_type, ingest_target_type, source_identifier,
       canonical_url, page_number, page_cursor, ingest_key, status, evidence)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'planned', $10::jsonb)
      ON CONFLICT (media_request_id, ingest_key) WHERE ingest_key IS NOT NULL DO NOTHING RETURNING *`,
    [row.mediaRequestId, row.sourceProvider, row.sourceResourceType, row.ingestTargetType, row.sourceIdentifier,
      row.canonicalUrl, row.pageNumber ?? 1, row.pageCursor ?? null, row.ingestKey, JSON.stringify(row.evidence ?? {})]);
    return mapWork(result.rows[0]) ?? getWorkByKey({ mediaRequestId: row.mediaRequestId, ingestKey: row.ingestKey, queryable });
  }
  async function getWorkByKey({ mediaRequestId, ingestKey, queryable }) {
    const result = await queryable.query('SELECT * FROM provider_ingest_requests WHERE media_request_id = $1 AND ingest_key = $2', [mediaRequestId, ingestKey]);
    return mapWork(result.rows[0]);
  }
  async function getWork({ id, queryable }) {
    const result = await queryable.query('SELECT * FROM provider_ingest_requests WHERE id = $1 FOR UPDATE', [id]);
    return mapWork(result.rows[0]);
  }
  async function listWork({ mediaRequestId, limit = 10, queryable = null }) {
    const result = await db(queryable).query(`SELECT * FROM provider_ingest_requests
      WHERE media_request_id = $1 AND ingest_key IS NOT NULL AND status = 'planned'
      ORDER BY page_number, created_at, id LIMIT $2`, [mediaRequestId, limit]);
    return result.rows.map(mapWork);
  }
  async function listItemKeys({ mediaRequestId, queryable }) {
    const result = await queryable.query('SELECT item_key FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId]);
    return result.rows.map((row) => row.item_key);
  }
  async function insertItem({ mediaRequestId, item, providerIngestRequestId, queryable }) {
    await queryable.query(`INSERT INTO library_external_request_collection_items
      (media_request_id, item_key, provider_ingest_request_id, source_provider, source_identifier,
       item_kind, title, artist_name, evidence)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      ON CONFLICT (media_request_id, item_key) DO UPDATE SET
        provider_ingest_request_id = COALESCE(EXCLUDED.provider_ingest_request_id, library_external_request_collection_items.provider_ingest_request_id),
        item_kind = EXCLUDED.item_kind, title = COALESCE(EXCLUDED.title, library_external_request_collection_items.title),
        artist_name = COALESCE(EXCLUDED.artist_name, library_external_request_collection_items.artist_name),
        evidence = library_external_request_collection_items.evidence || EXCLUDED.evidence, updated_at = NOW()
      WHERE library_external_request_collection_items.decision = 'pending'`,
    [mediaRequestId, item.itemKey, providerIngestRequestId, item.sourceProvider, item.sourceIdentifier,
      item.itemKind, item.title, item.artistName, JSON.stringify(item.evidence ?? {})]);
  }
  async function completeWork({ id, nextPageCursor, evidence, queryable }) {
    await queryable.query(`UPDATE provider_ingest_requests SET status = 'completed', next_page_cursor = $2,
      evidence = evidence || $3::jsonb, updated_at = NOW() WHERE id = $1`, [id, nextPageCursor, JSON.stringify(evidence)]);
  }
  async function advanceCollection({ mediaRequestId, containerPage, itemsSeen = 0, providerSnapshot, queryable }) {
    const result = await queryable.query(`UPDATE library_external_request_collections c SET
      pages_completed = pages_completed + $2, items_seen = items_seen + $4,
      provider_snapshot = COALESCE(provider_snapshot, $3), revision = revision + 1, updated_at = NOW(),
      status = CASE WHEN EXISTS (SELECT 1 FROM provider_ingest_requests WHERE media_request_id = $1
        AND ingest_key IS NOT NULL AND status IN ('planned', 'failed')) THEN 'preparing' ELSE 'ready' END
      WHERE media_request_id = $1 RETURNING *`, [mediaRequestId, containerPage ? 1 : 0, providerSnapshot, itemsSeen]);
    return mapCollection(result.rows[0]);
  }
  async function failWork({ id, mediaRequestId, blockedReason, errorCode, queryable }) {
    await queryable.query(`UPDATE provider_ingest_requests SET status = 'failed',
      evidence = evidence || jsonb_build_object('errorCode', $2::text), updated_at = NOW()
      WHERE id = $1 AND status = 'planned'`, [id, errorCode]);
    await queryable.query(`UPDATE library_external_request_collections SET
      status = CASE WHEN $2::text IS NULL THEN status ELSE 'blocked' END,
      blocked_reason = $2, revision = revision + 1, updated_at = NOW()
      WHERE media_request_id = $1 AND status = 'preparing'`, [mediaRequestId, blockedReason]);
  }
  return { advanceCollection, completeWork, failWork, getCollection, getWork, getWorkByKey,
    hasApprovedIntents, hasDecisions, hasOtherPreparation, initialize, insertItem, insertWork, isCancellationRequested,
    listItemKeys, listWork, lockRequest };
}
