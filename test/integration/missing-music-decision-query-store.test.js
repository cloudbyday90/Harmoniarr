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

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

async function seedAppUser(pool, usernamePrefix) {
  const result = await pool.query(
    `
      INSERT INTO app_users (username, password_hash, role, must_change_password)
      VALUES ($1, $2, 'requester', FALSE)
      RETURNING id
    `,
    [`${usernamePrefix}-${randomUUID()}`, `integration-password-${randomUUID()}`],
  );

  return result.rows[0].id;
}

function buildWantedRelease({ appUserId, metadata }) {
  return {
    appUserId,
    evidence: { source: 'missing_music_multi_user_query_store_test' },
    expectedTrackCount: 1,
    matchedTrackCount: 0,
    metadataArtistId: metadata.metadataArtistId,
    metadataReleaseGroupId: metadata.metadataReleaseGroupId,
    metadataReleaseId: metadata.metadataReleaseId,
    missingTrackCount: 1,
    releaseDate: '2026-08-26',
    releaseStatus: 'Official',
    wantedStatus: 'missing',
  };
}

test('wanted-release metadata query applies multi-user and text filters in PostgreSQL', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });

      const pool = getPoolFn();
      const metadata = await seedMetadataReleaseFixture({
        artistName: 'Multi-user Query Artist',
        queryable: pool,
        releaseDate: '2026-08-26',
        releaseTitle: 'Retained Request History',
      });
      const firstUserId = await seedAppUser(pool, 'decision-query-first');
      const secondUserId = await seedAppUser(pool, 'decision-query-second');
      const wantedReleaseStore = createLibraryWantedReleaseStore({ getPoolFn });

      await wantedReleaseStore.replaceLibraryWantedReleases({
        wantedReleases: [
          buildWantedRelease({ appUserId: firstUserId, metadata }),
          buildWantedRelease({ appUserId: secondUserId, metadata }),
        ],
      });

      const releases = await wantedReleaseStore.listWantedReleasesWithMetadata({
        appUserIds: [firstUserId],
        search: 'retained request',
      });

      assert.equal(releases.length, 1);
      assert.equal(releases[0].appUserId, firstUserId);
      assert.equal(releases[0].releaseTitle, 'Retained Request History');
    },
  });
});
