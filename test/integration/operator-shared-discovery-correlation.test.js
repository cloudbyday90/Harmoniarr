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
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

async function seedOperator(pool, usernamePrefix) {
  const result = await pool.query(
    `
      INSERT INTO app_users (username, password_hash, role, must_change_password)
      VALUES ($1, $2, 'admin', FALSE)
      RETURNING id
    `,
    [
      `${usernamePrefix}-${randomUUID()}`,
      `integration-password-${randomUUID()}`,
    ],
  );

  return result.rows[0].id;
}

function buildWantedRelease({ appUserId, metadata }) {
  return {
    appUserId,
    evidence: { source: 'operator_shared_discovery_correlation_test' },
    expectedTrackCount: 1,
    matchedTrackCount: 0,
    metadataArtistId: metadata.metadataArtistId,
    metadataReleaseGroupId: metadata.metadataReleaseGroupId,
    metadataReleaseId: metadata.metadataReleaseId,
    missingTrackCount: 1,
    releaseDate: '2026-01-01',
    releaseStatus: 'Official',
    wantedStatus: 'missing',
  };
}

test('shared discovery claim retains one request and all active operator release links in PostgreSQL', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });

      const pool = getPoolFn();
      const metadata = await seedMetadataReleaseFixture({
        artistName: 'Shared Discovery Artist',
        queryable: pool,
        releaseDate: '2026-01-01',
        releaseTitle: 'Shared Discovery Release',
      });
      const firstOperatorId = await seedOperator(pool, 'shared-discovery-first');
      const secondOperatorId = await seedOperator(pool, 'shared-discovery-second');
      const wantedReleaseStore = createLibraryWantedReleaseStore({ getPoolFn });
      const discoveryRequestStore = createLibraryDiscoveryRequestStore({ getPoolFn });
      const wantedReleases = [
        buildWantedRelease({ appUserId: firstOperatorId, metadata }),
        buildWantedRelease({ appUserId: secondOperatorId, metadata }),
      ];

      await wantedReleaseStore.replaceLibraryWantedReleases({ wantedReleases });
      await discoveryRequestStore.replaceLibraryDiscoveryRequests({
        discoveryRequests: [{
          blockedReason: null,
          evidence: { strategy: 'operator_shared_discovery_correlation_test' },
          lastSearchAt: null,
          manualRequestedAt: null,
          metadataArtistId: metadata.metadataArtistId,
          metadataReleaseGroupId: metadata.metadataReleaseGroupId,
          metadataReleaseId: metadata.metadataReleaseId,
          nextSearchAfter: '2026-01-01T00:00:00.000Z',
          releaseDate: '2026-01-01',
          requestStatus: 'ready',
          researchAttemptCount: 0,
          searchAttemptCount: 0,
          searchMode: 'automatic',
          wantedStatus: 'missing',
        }],
      });

      const links = await pool.query(
        `
          SELECT
            library_wanted_releases.app_user_id,
            library_wanted_releases.id AS wanted_release_id
          FROM library_discovery_request_wanted_release_links
          JOIN library_wanted_releases
            ON library_wanted_releases.id = library_discovery_request_wanted_release_links.wanted_release_id
          WHERE library_wanted_releases.metadata_release_id = $1
          ORDER BY library_wanted_releases.app_user_id ASC
        `,
        [metadata.metadataReleaseId],
      );
      assert.equal(links.rowCount, 2);

      const claimedRequest = await discoveryRequestStore.claimNextReadyAutomaticDiscoveryRequest({
        dispatchedAt: '2026-01-01T00:00:00.000Z',
        nextSearchAfter: '2026-01-01T06:00:00.000Z',
      });

      assert.ok(claimedRequest);
      assert.deepEqual(
        claimedRequest.operatorLinks.map((link) => link.appUserId),
        [firstOperatorId, secondOperatorId].sort(),
      );
      assert.deepEqual(
        claimedRequest.wantedReleaseIds,
        links.rows.map((link) => link.wanted_release_id),
      );
      assert.equal(claimedRequest.wantedReleaseId, links.rows[0].wanted_release_id);
      assert.equal(claimedRequest.requestStatus, 'cooldown');
    },
  });
});
