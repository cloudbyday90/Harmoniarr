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
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
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
    [`${usernamePrefix}-${randomUUID()}`, `integration-password-${randomUUID()}`],
  );

  return result.rows[0].id;
}

function buildWantedRelease({ appUserId, metadata }) {
  return {
    appUserId,
    evidence: { source: 'music_queue_selection_concurrency_test' },
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

function buildDiscoveryRequest({ metadata, sourceSearchId }) {
  return {
    blockedReason: null,
    evidence: {
      lastSearchId: sourceSearchId,
      strategy: 'music_queue_selection_concurrency_test',
    },
    lastSearchAt: '2026-01-01T00:00:00.000Z',
    manualRequestedAt: null,
    metadataArtistId: metadata.metadataArtistId,
    metadataReleaseGroupId: metadata.metadataReleaseGroupId,
    metadataReleaseId: metadata.metadataReleaseId,
    nextSearchAfter: '2026-01-01T06:00:00.000Z',
    releaseDate: '2026-01-01',
    requestStatus: 'ready',
    researchAttemptCount: 0,
    searchAttemptCount: 1,
    searchMode: 'automatic',
    wantedStatus: 'missing',
  };
}

async function seedCandidate(pool, { sourceSearchId }) {
  const result = await pool.query(
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
      VALUES ($1, $2, $3, $4, $5, 'manual_search', 'pending', 1, 0, 123, '{}'::jsonb, '{}'::jsonb, NOW())
      RETURNING id
    `,
    [
      'slskd',
      sourceSearchId,
      randomUUID(),
      `source-user-${randomUUID()}`,
      `Artist${String.fromCharCode(92)}Release-${randomUUID()}`,
    ],
  );

  return result.rows[0].id;
}

test('Music Queue selection yields one active candidate for a shared discovery request without blocking another release', {
  timeout: 60_000,
}, async () => {
  await withDockerizedPostgresDatabase({
    run: async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });

      const pool = getPoolFn();
      const sharedMetadata = await seedMetadataReleaseFixture({
        artistName: 'Shared Selection Artist',
        queryable: pool,
        releaseDate: '2026-01-01',
        releaseTitle: 'Shared Selection Release',
      });
      const isolatedMetadata = await seedMetadataReleaseFixture({
        artistName: 'Isolated Selection Artist',
        queryable: pool,
        releaseDate: '2026-01-02',
        releaseTitle: 'Isolated Selection Release',
      });
      const firstOperatorId = await seedOperator(pool, 'selection-first');
      const secondOperatorId = await seedOperator(pool, 'selection-second');
      const thirdOperatorId = await seedOperator(pool, 'selection-third');
      const wantedReleaseStore = createLibraryWantedReleaseStore({ getPoolFn });
      const discoveryRequestStore = createLibraryDiscoveryRequestStore({ getPoolFn });
      const sharedSearchId = `shared-search-${randomUUID()}`;
      const isolatedSearchId = `isolated-search-${randomUUID()}`;

      await wantedReleaseStore.replaceLibraryWantedReleases({
        wantedReleases: [
          buildWantedRelease({ appUserId: firstOperatorId, metadata: sharedMetadata }),
          buildWantedRelease({ appUserId: secondOperatorId, metadata: sharedMetadata }),
          buildWantedRelease({ appUserId: thirdOperatorId, metadata: isolatedMetadata }),
        ],
      });
      await discoveryRequestStore.replaceLibraryDiscoveryRequests({
        discoveryRequests: [
          buildDiscoveryRequest({ metadata: sharedMetadata, sourceSearchId: sharedSearchId }),
          buildDiscoveryRequest({ metadata: isolatedMetadata, sourceSearchId: isolatedSearchId }),
        ],
      });

      const [firstSharedCandidateId, secondSharedCandidateId, isolatedCandidateId] = await Promise.all([
        seedCandidate(pool, { sourceSearchId: sharedSearchId }),
        seedCandidate(pool, { sourceSearchId: sharedSearchId }),
        seedCandidate(pool, { sourceSearchId: isolatedSearchId }),
      ]);
      const service = createImportCandidateService({
        pool,
        recordAuditEventFn: async () => {},
        slskdService: {
          getSearchResponses: async () => ({ responses: [], searchId: 'unused' }),
        },
      });

      const selections = await Promise.allSettled([
        service.selectImportCandidate({
          actorUserId: firstOperatorId,
          importCandidateId: firstSharedCandidateId,
          reason: 'First operator chose this match',
        }),
        service.selectImportCandidate({
          actorUserId: secondOperatorId,
          importCandidateId: secondSharedCandidateId,
          reason: 'Second operator chose another match',
        }),
        service.selectImportCandidate({
          actorUserId: thirdOperatorId,
          importCandidateId: isolatedCandidateId,
          reason: 'Unrelated release chose this match',
        }),
      ]);

      const sharedResults = selections.slice(0, 2);
      assert.equal(sharedResults.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(sharedResults.filter((result) => result.status === 'rejected').length, 1);
      const sharedConflict = sharedResults.find((result) => result.status === 'rejected');
      assert.equal(sharedConflict.reason.status, 409);
      assert.equal(sharedConflict.reason.code, 'music_queue_candidate_already_active');
      assert.equal(selections[2].status, 'fulfilled');

      const candidates = await pool.query(
        `
          SELECT id, status
          FROM import_candidates
          WHERE id = ANY($1::uuid[])
          ORDER BY id ASC
        `,
        [[firstSharedCandidateId, secondSharedCandidateId, isolatedCandidateId]],
      );
      const selectedCandidateIds = candidates.rows
        .filter((candidate) => candidate.status === 'selected')
        .map((candidate) => candidate.id);
      assert.equal(selectedCandidateIds.filter((id) => (
        id === firstSharedCandidateId || id === secondSharedCandidateId
      )).length, 1);
      assert.ok(selectedCandidateIds.includes(isolatedCandidateId));

      const selectionEvents = await pool.query(
        `
          SELECT import_candidate_id
          FROM import_candidate_events
          WHERE import_candidate_id = ANY($1::uuid[])
            AND event_type = 'import_candidate_selected'
          ORDER BY import_candidate_id ASC
        `,
        [[firstSharedCandidateId, secondSharedCandidateId, isolatedCandidateId]],
      );
      assert.equal(selectionEvents.rowCount, 2);
      assert.equal(
        selectionEvents.rows.filter((event) => (
          event.import_candidate_id === firstSharedCandidateId
          || event.import_candidate_id === secondSharedCandidateId
        )).length,
        1,
      );
    },
  });
});
