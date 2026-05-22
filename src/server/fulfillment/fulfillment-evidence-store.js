/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from '../database.js';

function mapFulfillmentEvidenceRow(row) {
  return {
    correlationKey: row.correlation_key,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
    id: row.id,
    matchedActivityEventId: row.matched_activity_event_id ?? null,
    matchedAt: row.matched_at instanceof Date ? row.matched_at.toISOString() : row.matched_at ?? null,
    metadataAlbum: row.metadata_album ?? null,
    metadataArtist: row.metadata_artist ?? null,
    metadataTitle: row.metadata_title ?? null,
    metadataType: row.metadata_type ?? null,
    rawPayload: row.raw_payload ?? null,
    receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at,
    sourceEvent: row.source_event,
    sourceServerUuid: row.source_server_uuid ?? null,
    sourceType: row.source_type,
  };
}

export function createFulfillmentEvidenceStore({ getPoolFn = getPool } = {}) {
  async function insertFulfillmentEvidence({
    correlationKey,
    expiresAt,
    metadataAlbum = null,
    metadataArtist = null,
    metadataTitle = null,
    metadataType = null,
    rawPayload = null,
    sourceEvent,
    sourceServerUuid = null,
    sourceType = 'plex_webhook',
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `INSERT INTO fulfillment_evidence
         (correlation_key, expires_at, metadata_album, metadata_artist, metadata_title,
          metadata_type, raw_payload, source_event, source_server_uuid, source_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        correlationKey,
        expiresAt,
        metadataAlbum,
        metadataArtist,
        metadataTitle,
        metadataType,
        rawPayload ? JSON.stringify(rawPayload) : null,
        sourceEvent,
        sourceServerUuid,
        sourceType,
      ],
    );
    return mapFulfillmentEvidenceRow(result.rows[0]);
  }

  async function listUnmatchedEvidence({ limit = 100 } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `SELECT * FROM fulfillment_evidence
       WHERE matched_activity_event_id IS NULL
         AND expires_at > NOW()
       ORDER BY received_at ASC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapFulfillmentEvidenceRow);
  }

  async function findMatchingReleaseEvent({ correlationKey, receivedAfter }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `SELECT id, entity_artist, entity_title, occurred_at
       FROM activity_events
       WHERE event_type = 'release_added'
         AND occurred_at >= $1
       ORDER BY occurred_at DESC
       LIMIT 50`,
      [receivedAfter],
    );

    for (const row of result.rows) {
      const entityKey = buildEntityCorrelationKey(row.entity_artist, row.entity_title);
      if (entityKey === correlationKey) {
        return {
          entityId: row.id,
          entityTitle: row.entity_title,
          occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
        };
      }
    }

    return null;
  }

  async function markEvidenceMatched({ evidenceId, activityEventId, matchedAt }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `UPDATE fulfillment_evidence
       SET matched_activity_event_id = $1, matched_at = $2
       WHERE id = $3
       RETURNING *`,
      [activityEventId, matchedAt, evidenceId],
    );
    return result.rows.length > 0 ? mapFulfillmentEvidenceRow(result.rows[0]) : null;
  }

  async function listEvidenceForActivityEvent({ activityEventId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `SELECT * FROM fulfillment_evidence
       WHERE matched_activity_event_id = $1
       ORDER BY received_at DESC`,
      [activityEventId],
    );
    return result.rows.map(mapFulfillmentEvidenceRow);
  }

  async function deleteExpiredEvidence({ batchSize = 500 } = {}) {
    const pool = getPoolFn();
    const result = await pool.query(
      `DELETE FROM fulfillment_evidence
       WHERE id IN (
         SELECT id FROM fulfillment_evidence
         WHERE expires_at < NOW()
         ORDER BY expires_at ASC
         LIMIT $1
       )`,
      [batchSize],
    );
    return result.rowCount ?? 0;
  }

  async function getEvidenceSummary() {
    const pool = getPoolFn();
    const [totalResult, matchedResult, unmatchedResult, recentResult] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM fulfillment_evidence WHERE expires_at > NOW()'),
      pool.query('SELECT COUNT(*) AS count FROM fulfillment_evidence WHERE matched_activity_event_id IS NOT NULL AND expires_at > NOW()'),
      pool.query('SELECT COUNT(*) AS count FROM fulfillment_evidence WHERE matched_activity_event_id IS NULL AND expires_at > NOW()'),
      pool.query(
        `SELECT source_event, COUNT(*) AS count
         FROM fulfillment_evidence
         WHERE received_at > NOW() - INTERVAL '24 hours'
         GROUP BY source_event
         ORDER BY count DESC`,
      ),
    ]);

    return {
      matched: Number(matchedResult.rows[0]?.count ?? 0),
      recentByEvent: Object.fromEntries(
        recentResult.rows.map((row) => [row.source_event, Number(row.count)]),
      ),
      total: Number(totalResult.rows[0]?.count ?? 0),
      unmatched: Number(unmatchedResult.rows[0]?.count ?? 0),
    };
  }

  return {
    deleteExpiredEvidence,
    findMatchingReleaseEvent,
    getEvidenceSummary,
    insertFulfillmentEvidence,
    listEvidenceForActivityEvent,
    listUnmatchedEvidence,
    markEvidenceMatched,
  };
}

function buildEntityCorrelationKey(artist, title) {
  const parts = [];
  if (typeof artist === 'string') {
    const normalized = artist.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized) parts.push(normalized);
  }
  if (typeof title === 'string') {
    const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalized) parts.push(normalized);
  }
  return parts.join('::');
}
