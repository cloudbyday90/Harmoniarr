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
import {
  buildTimelinePage,
  decodeTimelineCursor,
  normalizeTimelinePageLimit,
  resolveTimelineCursorId,
  resolveTimelineCursorOccurredAt,
} from '../timeline-pagination.js';

function toDetectionEvent(row) {
  return {
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    details: row.details ?? {},
    detectionType: row.detection_type,
    firstReleaseDate: row.first_release_date?.toISOString?.()?.slice(0, 10) ?? row.first_release_date ?? null,
    id: row.id,
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    monitoringDecision: row.monitoring_decision,
    musicBrainzReleaseGroupId: row.musicbrainz_release_group_id ?? null,
    occurredAt: row.occurred_at?.toISOString?.() ?? row.occurred_at,
    operationRunId: row.operation_run_id ?? null,
    primaryType: row.primary_type ?? null,
    provider: row.provider,
    resultingWantedStatus: row.resulting_wanted_status ?? null,
    title: row.title,
    triggerSource: row.trigger_source,
  };
}

export function createMetadataReleaseDetectionStore({
  getPoolFn = getPool,
} = {}) {
  async function recordDetectionEvents({ events }) {
    if (!Array.isArray(events) || events.length < 1) {
      return [];
    }

    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const recorded = [];
      for (const event of events) {
        const result = await client.query(
          `
            INSERT INTO metadata_release_detection_events (
              metadata_artist_id,
              metadata_release_group_id,
              musicbrainz_release_group_id,
              provider,
              occurred_at,
              detection_type,
              trigger_source,
              monitoring_decision,
              resulting_wanted_status,
              title,
              primary_type,
              first_release_date,
              operation_run_id,
              details
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14::jsonb
            )
            RETURNING
              id,
              metadata_artist_id,
              metadata_release_group_id,
              musicbrainz_release_group_id,
              provider,
              occurred_at,
              detection_type,
              trigger_source,
              monitoring_decision,
              resulting_wanted_status,
              title,
              primary_type,
              first_release_date,
              operation_run_id,
              details,
              created_at
          `,
          [
            event.metadataArtistId,
            event.metadataReleaseGroupId,
            event.musicBrainzReleaseGroupId ?? null,
            event.provider,
            event.occurredAt,
            event.detectionType,
            event.triggerSource,
            event.monitoringDecision,
            event.resultingWantedStatus ?? null,
            event.title,
            event.primaryType ?? null,
            event.firstReleaseDate ?? null,
            event.operationRunId ?? null,
            JSON.stringify(event.details ?? {}),
          ],
        );
        recorded.push(toDetectionEvent(result.rows[0]));
      }

      await client.query('COMMIT');
      return recorded;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listRecentEventsForArtist({ limit = 10, metadataArtistId } = {}) {
    const page = await listEventsPageForArtist({
      limit,
      metadataArtistId,
    });

    return page.entries;
  }

  async function listEventsPageForArtist({ before = null, limit = 10, metadataArtistId } = {}) {
    const normalizedLimit = normalizeTimelinePageLimit(limit, { defaultLimit: 10, maxLimit: 25 });
    const beforeCursor = decodeTimelineCursor(before);
    const values = [metadataArtistId];
    const whereClauses = ['metadata_artist_id = $1'];

    if (beforeCursor) {
      values.push(resolveTimelineCursorOccurredAt(beforeCursor));
      values.push(resolveTimelineCursorId(beforeCursor));
      whereClauses.push(`(
        occurred_at < $${values.length - 1}::timestamptz
        OR (
          occurred_at = $${values.length - 1}::timestamptz
          AND id < $${values.length}::uuid
        )
      )`);
    }

    values.push(normalizedLimit + 1);
    const result = await getPoolFn().query(
      `
        SELECT
          id,
          metadata_artist_id,
          metadata_release_group_id,
          musicbrainz_release_group_id,
          provider,
          occurred_at,
          detection_type,
          trigger_source,
          monitoring_decision,
          resulting_wanted_status,
          title,
          primary_type,
          first_release_date,
          operation_run_id,
          details,
          created_at
        FROM metadata_release_detection_events
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${values.length}
      `,
      values,
    );

    return buildTimelinePage({
      cursorPayload: (entry) => ({
        id: entry.id,
        occurredAt: entry.occurredAt,
      }),
      entries: result.rows.map(toDetectionEvent),
      limit: normalizedLimit,
    });
  }

  async function deleteEventsOlderThan({ olderThan }) {
    const result = await getPoolFn().query(
      `
        DELETE FROM metadata_release_detection_events
        WHERE occurred_at < $1::timestamptz
      `,
      [olderThan],
    );

    return result.rowCount ?? 0;
  }

  async function trimEventsForArtist({ metadataArtistId, retainCount }) {
    const result = await getPoolFn().query(
      `
        DELETE FROM metadata_release_detection_events
        WHERE id IN (
          SELECT id
          FROM metadata_release_detection_events
          WHERE metadata_artist_id = $1
          ORDER BY occurred_at DESC, id DESC
          OFFSET $2
        )
      `,
      [metadataArtistId, retainCount],
    );

    return result.rowCount ?? 0;
  }

  return {
    deleteEventsOlderThan,
    listEventsPageForArtist,
    listRecentEventsForArtist,
    recordDetectionEvents,
    trimEventsForArtist,
  };
}