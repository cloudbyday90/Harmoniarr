/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomUUID } from 'node:crypto';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createMissingMusicDecisionService } from '../../src/server/missing-music/missing-music-decision-service.js';
import { seedMetadataReleaseFixture } from './metadata-fixtures.js';

export async function seedMissingMusicPaginationUser({ queryable, role = 'requester', isDisabled = false }) {
  const result = await queryable.query(`INSERT INTO app_users (username, password_hash, role, is_disabled)
    VALUES ($1, 'unused-synthetic-password', $2, $3) RETURNING id, username, role, is_disabled`,
  [`pagination-${randomUUID()}`, role, isDisabled]);
  const row = result.rows[0];
  return { id: row.id, username: row.username, role: row.role, isDisabled: row.is_disabled };
}

export async function seedMissingMusicPaginationRows({ queryable, appUserId, count = 5, titlePrefix = 'Pagination release', createdAt = '2026-09-11T00:00:00.000000Z', microsecondSteps = true }) {
  const metadata = await seedMetadataReleaseFixture({ queryable, artistName: titlePrefix, releaseTitle: `${titlePrefix} group` });
  const prefix = randomUUID();
  await queryable.query(`WITH releases AS (
    INSERT INTO metadata_releases (metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id, title, status, track_count, medium_count)
    SELECT $1, 'musicbrainz', $2 || ':' || ordinal, harmoniarr_generate_uuid(), $3 || ' ' || ordinal, 'Official', 1, 1
    FROM generate_series(1, $4::int) ordinal RETURNING id, source_release_id
  ) INSERT INTO library_wanted_releases (app_user_id, metadata_artist_id, metadata_release_group_id, metadata_release_id,
      wanted_status, expected_track_count, matched_track_count, missing_track_count, created_at)
    SELECT $5, $6, $1, id, 'missing', 1, 0, 1,
      $7::timestamptz + CASE WHEN $8 THEN split_part(source_release_id, ':', 2)::int * INTERVAL '1 microsecond' ELSE INTERVAL '0' END
    FROM releases`, [metadata.metadataReleaseGroupId, prefix, titlePrefix, count, appUserId, metadata.metadataArtistId, createdAt, microsecondSteps]);
  const rows = await queryable.query(`SELECT id, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at_key
    FROM library_wanted_releases WHERE app_user_id = $1 AND metadata_release_group_id = $2 ORDER BY created_at DESC, id DESC`,
  [appUserId, metadata.metadataReleaseGroupId]);
  return { ...metadata, rows: rows.rows.map((row) => ({ id: row.id, createdAtKey: row.created_at_key })) };
}

export function createMissingMusicPaginationService({ getPoolFn, onEvidenceRead = () => {} }) {
  const store = createLibraryWantedReleaseStore({ getPoolFn });
  return createMissingMusicDecisionService({
    listAppUsers: async () => (await getPoolFn().query('SELECT id, username, role, is_disabled FROM app_users ORDER BY username')).rows
      .map((row) => ({ id: row.id, username: row.username, role: row.role, isDisabled: row.is_disabled })),
    listWantedReleaseIdentityPage: store.listWantedReleaseIdentityPage,
    listWantedReleasesWithMetadata: (options) => {
      onEvidenceRead(options);
      return store.listWantedReleasesWithMetadata(options);
    },
  });
}
