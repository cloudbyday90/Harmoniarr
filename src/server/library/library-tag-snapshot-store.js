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
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';

function toNullableInteger(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function createLibraryTagSnapshotStore({
  getPoolFn = getPool,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
} = {}) {
  async function writeLibraryFileTagSnapshot({
    audioCodec = null,
    bitrateKbps = null,
    bitDepth = null,
    channels = null,
    durationMs = null,
    embeddedArtworkCount = null,
    extractor,
    extractorVersion = null,
    libraryFileId,
    normalizedTags = null,
    rawTags = null,
    sampleRateHz = null,
    sourceModifiedAt = null,
    sourceSizeBytes = null,
    status,
    tagFormat = null,
    queryable = null,
    expectedSource = null,
    beforeWrite = null,
  }) {
    if (queryable != null && typeof queryable.query !== 'function') throw new TypeError('Tag snapshot queryable must supply query');
    if (beforeWrite != null && typeof beforeWrite !== 'function') throw new TypeError('Tag snapshot beforeWrite must be a function');
    if (expectedSource != null && expectedSource.id !== libraryFileId) throw new TypeError('Tag snapshot source must match its file');
    async function writeSnapshot(client) {
      await beforeWrite?.({ queryable: client, stage: 'snapshot' });
      const snapshot = await client.query(
        `
          INSERT INTO file_tag_snapshots (
            library_file_id,
            extractor,
            extractor_version,
            tag_format,
            status,
            embedded_artwork_count,
            raw_tags,
            normalized_tags,
            extracted_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW())
          RETURNING id
        `,
        [
          libraryFileId,
          extractor,
          extractorVersion,
          tagFormat,
          status,
          embeddedArtworkCount,
          rawTags ? JSON.stringify(rawTags) : null,
          normalizedTags ? JSON.stringify(normalizedTags) : null,
        ],
      );
      if (snapshot.rowCount !== 1 || snapshot.rows.length !== 1) {
        throw createApiError(409, 'library_tag_snapshot_incomplete', 'The tag snapshot was not inserted');
      }
      await beforeWrite?.({ queryable: client, stage: 'file_update' });
      const result = await client.query(
        `
          UPDATE library_files
            SET audio_codec = $2,
              bitrate_kbps = $3,
              sample_rate_hz = $4,
              bit_depth = $5,
              channels = $6,
              duration_ms = $7,
              tag_payload = $8::jsonb,
              tag_extracted_size_bytes = CASE
                WHEN $9 = 'extracted' AND $10::bigint IS NOT NULL AND $11::timestamptz IS NOT NULL
                  THEN $10::bigint
                ELSE tag_extracted_size_bytes
              END,
              tag_extracted_modified_at = CASE
                WHEN $9 = 'extracted' AND $10::bigint IS NOT NULL AND $11::timestamptz IS NOT NULL
                  THEN $11::timestamptz
                ELSE tag_extracted_modified_at
              END,
              file_state = 'observed',
              updated_at = NOW()
          WHERE id = $1
          ${expectedSource ? `AND library_root_id = $12::uuid AND canonical_path = $13
            AND size_bytes = $14::bigint AND modified_at IS NOT DISTINCT FROM $15::timestamptz
            AND file_state = 'observed' AND deleted_at IS NULL` : ''}
          RETURNING id
        `,
        [
          libraryFileId,
          audioCodec,
          toNullableInteger(bitrateKbps),
          toNullableInteger(sampleRateHz),
          toNullableInteger(bitDepth),
          toNullableInteger(channels),
          toNullableInteger(durationMs),
          normalizedTags ? JSON.stringify(normalizedTags) : null,
          status,
          toNullableInteger(sourceSizeBytes),
          sourceModifiedAt,
          ...(expectedSource ? [expectedSource.libraryRootId, expectedSource.canonicalPath,
            expectedSource.sizeBytes, expectedSource.modifiedAt] : []),
        ],
      );
      if (result.rowCount !== 1 || result.rows.length !== 1 || result.rows[0].id !== libraryFileId) {
        throw createApiError(409, 'library_tag_snapshot_stale', 'The library file changed before the tag update');
      }
      return { snapshotId: snapshot.rows[0].id, libraryFileId: result.rows[0].id };
    }
    return queryable ? writeSnapshot(queryable) : withTransaction(writeSnapshot);
  }

  return {
    writeLibraryFileTagSnapshot,
  };
}
