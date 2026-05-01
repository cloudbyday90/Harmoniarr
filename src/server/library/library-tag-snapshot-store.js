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

function toNullableInteger(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function createLibraryTagSnapshotStore({
  getPoolFn = getPool,
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
    status,
    tagFormat = null,
  }) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
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

      await client.query(
        `
          UPDATE library_files
            SET audio_codec = $2,
              bitrate_kbps = $3,
              sample_rate_hz = $4,
              bit_depth = $5,
              channels = $6,
              duration_ms = $7,
              tag_payload = $8::jsonb,
              file_state = 'observed',
              updated_at = NOW()
          WHERE id = $1
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
        ],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    writeLibraryFileTagSnapshot,
  };
}