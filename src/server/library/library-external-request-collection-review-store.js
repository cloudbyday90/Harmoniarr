/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';

const collectionSelect = `SELECT collection.*,
  (SELECT COUNT(*)::int FROM library_external_request_collection_items WHERE media_request_id = collection.media_request_id) AS leaf_count,
  (SELECT COUNT(*)::int FROM library_external_request_collection_items WHERE media_request_id = collection.media_request_id AND decision = 'included') AS included_count,
  (SELECT COUNT(*)::int FROM library_external_request_collection_items WHERE media_request_id = collection.media_request_id AND decision = 'excluded') AS excluded_count,
  (SELECT COUNT(*)::int FROM library_external_request_collection_items WHERE media_request_id = collection.media_request_id AND decision = 'pending') AS pending_count,
  ARRAY(SELECT DISTINCT release_intent_id FROM library_external_request_collection_items WHERE media_request_id = collection.media_request_id AND decision = 'included') AS included_intent_ids
  FROM library_external_request_collections collection`;

function mapCollection(row) {
  return row ? {
    mediaRequestId: row.media_request_id, requestedForUserId: row.requested_for_user_id,
    status: row.status, revision: Number(row.revision), pagesCompleted: row.pages_completed,
    itemsSeen: row.items_seen, leafCount: row.leaf_count, includedCount: row.included_count,
    excludedCount: row.excluded_count, pendingCount: row.pending_count,
    includedIntentIds: row.included_intent_ids, blockedReason: row.blocked_reason, reviewedAt: row.reviewed_at,
  } : null;
}

const itemSelect = `SELECT item.*, provider.source_resource_type, provider.ingest_target_type,
  provider.evidence AS provider_evidence, provider.status AS provider_status
  FROM library_external_request_collection_items item
  LEFT JOIN provider_ingest_requests provider ON provider.id = item.provider_ingest_request_id
    AND provider.media_request_id = item.media_request_id`;

function mapItem(row) {
  return row ? {
    id: row.id, mediaRequestId: row.media_request_id, providerIngestRequestId: row.provider_ingest_request_id,
    sourceProvider: row.source_provider, sourceIdentifier: row.source_identifier,
    itemKind: row.item_kind, title: row.title, artistName: row.artist_name,
    decision: row.decision, releaseIntentId: row.release_intent_id, exclusionReason: row.exclusion_reason,
    providerRow: row.provider_status ? {
      id: row.provider_ingest_request_id, sourceProvider: row.source_provider, sourceIdentifier: row.source_identifier,
      sourceResourceType: row.source_resource_type, ingestTargetType: row.ingest_target_type,
      evidence: row.provider_evidence, status: row.provider_status,
    } : null,
  } : null;
}

export function createLibraryExternalRequestCollectionReviewStore({ getPoolFn = getPool } = {}) {
  const db = (queryable) => queryable ?? getPoolFn();
  async function getCollection({ mediaRequestId, queryable = null }) {
    const result = await db(queryable).query(`${collectionSelect} WHERE collection.media_request_id = $1`, [mediaRequestId]);
    return mapCollection(result.rows[0]);
  }
  async function lockCollection({ mediaRequestId, queryable }) {
    if (!queryable) throw new Error('Collection locking requires a transaction client');
    await queryable.query('SELECT media_request_id FROM library_external_request_collections WHERE media_request_id = $1 FOR UPDATE', [mediaRequestId]);
    return getCollection({ mediaRequestId, queryable });
  }
  async function listItemsPage({ mediaRequestId, cursor = null, limit = 25, queryable = null }) {
    const result = await db(queryable).query(`${itemSelect}
      WHERE item.media_request_id = $1 AND ($2::uuid IS NULL OR item.id > $2)
      ORDER BY item.id LIMIT $3`, [mediaRequestId, cursor, limit + 1]);
    return { items: result.rows.slice(0, limit).map(mapItem), hasMore: result.rows.length > limit };
  }
  async function getItem({ mediaRequestId, collectionItemId = null, providerIngestRequestId = null, queryable }) {
    const result = await db(queryable).query(`${itemSelect} WHERE item.media_request_id = $1
      AND (($2::uuid IS NOT NULL AND item.id = $2) OR ($3::uuid IS NOT NULL AND item.provider_ingest_request_id = $3))`,
    [mediaRequestId, collectionItemId, providerIngestRequestId]);
    return mapItem(result.rows[0]);
  }
  async function recordDecision({ mediaRequestId, collectionItemId, decision, releaseIntentId = null, exclusionReason = null, actorUserId, queryable }) {
    if (!queryable) throw new Error('Collection decisions require a transaction client');
    const result = await queryable.query(`UPDATE library_external_request_collection_items
      SET decision = $3, release_intent_id = $4, exclusion_reason = $5, decided_by_user_id = $6, decided_at = NOW(), updated_at = NOW()
      WHERE media_request_id = $1 AND id = $2 AND decision = 'pending' RETURNING id`,
    [mediaRequestId, collectionItemId, decision, releaseIntentId, exclusionReason, actorUserId]);
    if (result.rowCount !== 1) throw new Error('Collection decision changed while locked');
    await queryable.query('UPDATE library_external_request_collections SET revision = revision + 1, updated_at = NOW() WHERE media_request_id = $1', [mediaRequestId]);
    return getCollection({ mediaRequestId, queryable });
  }
  async function hasUnfinishedWork({ mediaRequestId, queryable = null }) {
    const result = await db(queryable).query(`SELECT EXISTS(SELECT 1 FROM provider_ingest_requests
      WHERE media_request_id = $1 AND status <> 'completed') AS unfinished`, [mediaRequestId]);
    return result.rows[0].unfinished;
  }
  async function finalize({ mediaRequestId, actorUserId, queryable }) {
    if (!queryable) throw new Error('Collection finalization requires a transaction client');
    await queryable.query(`UPDATE library_external_request_collections SET status = 'reviewed', reviewed_at = NOW(),
      reviewed_by_user_id = $2, revision = revision + 1, updated_at = NOW() WHERE media_request_id = $1`, [mediaRequestId, actorUserId]);
    return getCollection({ mediaRequestId, queryable });
  }
  async function listCollectionsByMediaRequestIds({ mediaRequestIds }) {
    if (!mediaRequestIds.length) return [];
    const result = await getPoolFn().query(`${collectionSelect} WHERE collection.media_request_id = ANY($1::uuid[])`, [mediaRequestIds]);
    return result.rows.map(mapCollection);
  }
  return { getCollection, lockCollection, listItemsPage, getItem, recordDecision, hasUnfinishedWork, finalize, listCollectionsByMediaRequestIds };
}
