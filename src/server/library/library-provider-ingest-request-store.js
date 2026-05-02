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

function mapProviderIngestRequest(row) {
  if (!row) {
    return null;
  }

  return {
    canonicalUrl: row.canonical_url,
    evidence: row.evidence ?? {},
    id: row.id,
    ingestTargetType: row.ingest_target_type,
    mediaRequestId: row.media_request_id,
    pageCursor: row.page_cursor ?? null,
    pageNumber: Number.parseInt(String(row.page_number ?? 1), 10) || 1,
    sourceIdentifier: row.source_identifier,
    sourceProvider: row.source_provider,
    sourceResourceType: row.source_resource_type,
    status: row.status,
  };
}

export function createLibraryProviderIngestRequestStore({
  getPoolFn = getPool,
} = {}) {
  async function replaceProviderIngestRequests({ mediaRequestId, providerIngestRequests }) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM provider_ingest_requests WHERE media_request_id = $1', [mediaRequestId]);

      const inserted = [];
      for (const request of providerIngestRequests) {
        const result = await client.query(
          `
            INSERT INTO provider_ingest_requests (
              media_request_id,
              source_provider,
              source_resource_type,
              ingest_target_type,
              source_identifier,
              canonical_url,
              page_number,
              page_cursor,
              status,
              evidence,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
            RETURNING
              id,
              media_request_id,
              source_provider,
              source_resource_type,
              ingest_target_type,
              source_identifier,
              canonical_url,
              page_number,
              page_cursor,
              status,
              evidence
          `,
          [
            mediaRequestId,
            request.sourceProvider,
            request.sourceResourceType,
            request.ingestTargetType,
            request.sourceIdentifier,
            request.canonicalUrl,
            request.pageNumber ?? 1,
            request.pageCursor,
            request.status ?? 'planned',
            JSON.stringify(request.evidence ?? {}),
          ],
        );

        inserted.push(mapProviderIngestRequest(result.rows[0]));
      }

      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listProviderIngestRequests({ mediaRequestId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          id,
          media_request_id,
          source_provider,
          source_resource_type,
          ingest_target_type,
          source_identifier,
          canonical_url,
          page_number,
          page_cursor,
          status,
          evidence
        FROM provider_ingest_requests
        WHERE media_request_id = $1
        ORDER BY page_number ASC, created_at ASC, id ASC
      `,
      [mediaRequestId],
    );

    return result.rows.map(mapProviderIngestRequest);
  }

  async function listPlannedProviderIngestRequests({ mediaRequestId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          id,
          media_request_id,
          source_provider,
          source_resource_type,
          ingest_target_type,
          source_identifier,
          canonical_url,
          page_number,
          page_cursor,
          status,
          evidence
        FROM provider_ingest_requests
        WHERE media_request_id = $1
          AND status = 'planned'
        ORDER BY page_number ASC, created_at ASC, id ASC
      `,
      [mediaRequestId],
    );

    return result.rows.map(mapProviderIngestRequest);
  }

  async function updateProviderIngestRequestStatus({ id, status, evidence = null, pageCursor = undefined }) {
    const pool = getPoolFn();
    const fields = ['status = $2', 'updated_at = NOW()'];
    const params = [id, status];

    if (evidence !== null) {
      params.push(JSON.stringify(evidence));
      fields.push(`evidence = $${params.length}::jsonb`);
    }

    if (pageCursor !== undefined) {
      params.push(pageCursor);
      fields.push(`page_cursor = $${params.length}`);
    }

    const result = await pool.query(
      `
        UPDATE provider_ingest_requests
        SET ${fields.join(', ')}
        WHERE id = $1
        RETURNING
          id,
          media_request_id,
          source_provider,
          source_resource_type,
          ingest_target_type,
          source_identifier,
          canonical_url,
          page_number,
          page_cursor,
          status,
          evidence
      `,
      params,
    );

    return mapProviderIngestRequest(result.rows[0] ?? null);
  }

  async function insertProviderIngestRequests({ providerIngestRequests }) {
    if (!providerIngestRequests || providerIngestRequests.length === 0) {
      return [];
    }

    const pool = getPoolFn();
    const inserted = [];

    for (const request of providerIngestRequests) {
      const result = await pool.query(
        `
          INSERT INTO provider_ingest_requests (
            media_request_id,
            source_provider,
            source_resource_type,
            ingest_target_type,
            source_identifier,
            canonical_url,
            page_number,
            page_cursor,
            status,
            evidence,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
          RETURNING
            id,
            media_request_id,
            source_provider,
            source_resource_type,
            ingest_target_type,
            source_identifier,
            canonical_url,
            page_number,
            page_cursor,
            status,
            evidence
        `,
        [
          request.mediaRequestId,
          request.sourceProvider,
          request.sourceResourceType,
          request.ingestTargetType,
          request.sourceIdentifier,
          request.canonicalUrl,
          request.pageNumber ?? 1,
          request.pageCursor ?? null,
          request.status ?? 'planned',
          JSON.stringify(request.evidence ?? {}),
        ],
      );

      inserted.push(mapProviderIngestRequest(result.rows[0]));
    }

    return inserted;
  }

  return {
    insertProviderIngestRequests,
    listPlannedProviderIngestRequests,
    listProviderIngestRequests,
    replaceProviderIngestRequests,
    updateProviderIngestRequestStatus,
  };
}