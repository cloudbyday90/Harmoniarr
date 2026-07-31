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

import { randomUUID } from 'node:crypto';
import { seedMetadataReleaseFixture } from '../integration/metadata-fixtures.js';

async function insertWantedRelease(pool, {
  appUserId,
  evidence,
  metadata,
}) {
  const result = await pool.query(
    `
      INSERT INTO library_wanted_releases (
        app_user_id,
        metadata_artist_id,
        metadata_release_group_id,
        metadata_release_id,
        wanted_status,
        expected_track_count,
        matched_track_count,
        missing_track_count,
        release_date,
        release_status,
        evidence
      )
      VALUES ($1, $2, $3, $4, 'missing', 12, 0, 12, '2026-07-31', 'Official', $5::jsonb)
      RETURNING id
    `,
    [
      appUserId,
      metadata.metadataArtistId,
      metadata.metadataReleaseGroupId,
      metadata.metadataReleaseId,
      JSON.stringify(evidence),
    ],
  );

  return result.rows[0].id;
}

async function insertSharedQualityStop(pool, {
  appUserId,
  privateMarkers,
  wantedReleaseIds,
}) {
  const musicQueueContext = { wantedReleaseIds };
  const candidateResult = await pool.query(
    `
      INSERT INTO import_candidates (
        source_provider,
        source_search_id,
        source_response_key,
        username,
        folder_path,
        candidate_type,
        status,
        file_count,
        locked_file_count,
        total_size_bytes,
        raw_payload,
        normalized_payload,
        discovered_at
      )
      VALUES (
        'browser_acceptance',
        $1,
        $2,
        $3,
        $4,
        'automatic_discovery',
        'applied',
        12,
        0,
        123456,
        $5::jsonb,
        $6::jsonb,
        NOW()
      )
      RETURNING id
    `,
    [
      `release-add-diagnostics-search-${randomUUID()}`,
      `release-add-diagnostics-response-${randomUUID()}`,
      `private-source-user-${randomUUID()}`,
      `/downloads/private/${randomUUID()}`,
      JSON.stringify({ privateMarkers }),
      JSON.stringify({
        musicQueueContext,
        privateMarkers,
      }),
    ],
  );
  const importCandidateId = candidateResult.rows[0].id;
  const operationRunResult = await pool.query(
    `
      INSERT INTO operation_runs (
        operation_type,
        status,
        started_at,
        finished_at,
        triggered_by_user_id,
        summary
      )
      VALUES ('import_candidate_apply', 'completed', NOW(), NOW(), $1, '{}'::jsonb)
      RETURNING id
    `,
    [appUserId],
  );

  await pool.query(
    `
      INSERT INTO import_apply_run_items (
        operation_run_id,
        import_candidate_id,
        position,
        item_status,
        status_message,
        apply_snapshot
      )
      VALUES ($1, $2, 1, 'blocked', $3, $4::jsonb)
    `,
    [
      operationRunResult.rows[0].id,
      importCandidateId,
      `private add failure ${privateMarkers.join(' ')}`,
      JSON.stringify({
        apply: { outcome: 'quality_blocked' },
        candidate: {
          musicQueueContext,
          privateMarkers,
          sourceFolderPath: `/downloads/private/${randomUUID()}`,
          username: `private-source-user-${randomUUID()}`,
        },
      }),
    ],
  );

  return importCandidateId;
}

/**
 * Seeds two owner-specific wanted-release records linked to one durable,
 * shared quality stop. Browser acceptance tests use the real API boundary to
 * prove each account can read only its own release identity.
 *
 * @param {{ adminUserId: string, getPoolFn: () => import('pg').Pool, operatorUserId: string }} options
 * @returns {Promise<{ adminWantedReleaseId: string, importCandidateId: string, operatorWantedReleaseId: string, privateMarkers: string[] }>}
 */
export async function seedReleaseAddDiagnosticsAcceptanceFixture({
  adminUserId,
  getPoolFn,
  operatorUserId,
}) {
  const pool = getPoolFn();
  const privateMarkers = [
    `private-admin-policy-${randomUUID()}`,
    `private-operator-policy-${randomUUID()}`,
  ];
  const metadata = await seedMetadataReleaseFixture({
    artistName: 'Release Diagnostics Browser Artist',
    queryable: pool,
    releaseDate: '2026-07-31',
    releaseTitle: 'Release Diagnostics Browser Album',
  });
  const adminWantedReleaseId = await insertWantedRelease(pool, {
    appUserId: adminUserId,
    evidence: { privatePolicyMarker: privateMarkers[0] },
    metadata,
  });
  const operatorWantedReleaseId = await insertWantedRelease(pool, {
    appUserId: operatorUserId,
    evidence: { privatePolicyMarker: privateMarkers[1] },
    metadata,
  });
  const importCandidateId = await insertSharedQualityStop(pool, {
    appUserId: adminUserId,
    privateMarkers,
    wantedReleaseIds: [adminWantedReleaseId, operatorWantedReleaseId],
  });

  return {
    adminWantedReleaseId,
    importCandidateId,
    operatorWantedReleaseId,
    privateMarkers,
  };
}
