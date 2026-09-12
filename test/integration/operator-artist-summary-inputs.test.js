/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createMetadataReadService } from '../../src/server/metadata/metadata-read-service.js';
import { createOperatorArtistProjectionService } from '../../src/server/metadata/operator-artist-projection-service.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('compact artist projection inputs preserve complete multi-operator summaries without all-edition hydration', { timeout: 120_000 }, async (t) => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const mbid = randomUUID();
    const artistId = (await pool.query(`INSERT INTO metadata_artists
      (source_provider, source_artist_id, musicbrainz_artist_id, name, sort_name)
      VALUES ('musicbrainz', $1::text, $1::uuid, 'Summary Artist', 'Summary Artist') RETURNING id`, [mbid])).rows[0].id;
    await pool.query(`WITH groups AS (
      INSERT INTO metadata_release_groups
        (metadata_artist_id, source_provider, source_release_group_id, musicbrainz_release_group_id, title, primary_type)
      SELECT $1, 'musicbrainz', 'summary-group-' || number, gen_random_uuid(), 'Album ' || number,
        CASE WHEN number % 3 = 0 THEN 'Single' WHEN number % 3 = 1 THEN 'Album' ELSE 'EP' END
      FROM generate_series(1, 200) AS number RETURNING id, source_release_group_id
    ) INSERT INTO metadata_releases
      (metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id, title, status, is_canonical, track_count)
      SELECT groups.id, 'musicbrainz', gen_random_uuid()::text, gen_random_uuid(), 'Edition ' || edition, 'Official',
        edition = 1 AND groups.source_release_group_id <> 'summary-group-5', 10
      FROM groups CROSS JOIN generate_series(1, 5) AS edition`, [artistId]);
    const groups = (await pool.query('SELECT id, source_release_group_id FROM metadata_release_groups WHERE metadata_artist_id = $1', [artistId])).rows;
    const groupId = (number) => groups.find((group) => group.source_release_group_id === `summary-group-${number}`).id;
    const editionId = async (number, canonical) => (await pool.query(`SELECT id FROM metadata_releases
      WHERE metadata_release_group_id = $1 AND is_canonical = $2 ORDER BY id LIMIT 1`, [groupId(number), canonical])).rows[0]?.id;
    const alternate = await editionId(1, false);
    const actors = (await pool.query(`INSERT INTO app_users (username, password_hash, role, must_change_password)
      VALUES ('summary-a', 'test-hash', 'operator', FALSE), ('summary-b', 'test-hash', 'operator', FALSE) RETURNING id`)).rows.map(({ id }) => id);
    const selections = createOperatorReleaseGroupSelectionStore({ getPoolFn });
    const overrides = createOperatorTrackOverrideStore({ getPoolFn });
    for (const [index, actor] of actors.entries()) {
      await pool.query(`INSERT INTO operator_artist_monitoring (app_user_id, metadata_artist_id, is_monitored, monitored_release_group_types)
        VALUES ($1, $2, TRUE, $3)`, [actor, artistId, index === 0 ? ['album', 'ep'] : ['single']]);
      for (let number = 1; number <= 6; number += 1) {
        await selections.upsertOperatorReleaseGroupSelection({ appUserId: actor, metadataArtistId: artistId,
          metadataReleaseGroupId: groupId(number), selectionSource: 'manual',
          selectionState: index === 0 ? number === 6 ? 'unselected' : number === 2 ? 'partial' : 'selected'
            : number % 2 === 0 ? 'selected' : 'unselected',
          resolvedMetadataReleaseId: number === 1 ? alternate : null });
      }
      for (const [number, remapStatus] of [[1, 'resolved'], [2, 'review_needed'], [5, 'orphaned']]) {
        await overrides.upsertOperatorTrackOverride({ appUserId: actor, metadataArtistId: artistId,
          metadataReleaseGroupId: groupId(number), trackMbid: randomUUID(), isDesired: index === 0,
          remapStatus, queryable: pool });
      }
    }
    // A desired canonical edition without a reconciliation row represents missing coverage.
    for (const [number, status] of [[1, 'complete'], [2, 'partial'], [3, 'duplicate']]) {
      await pool.query(`INSERT INTO library_release_reconciliations
        (metadata_artist_id, metadata_release_group_id, metadata_release_id, reconciliation_status,
        expected_track_count, matched_track_count, missing_track_count, matched_file_count, duplicate_track_count, evidence, last_reconciled_at)
        VALUES ($1, $2, $3, $4, 10, 5, 5, 5, 0, '{}'::jsonb, NOW())`,
      [artistId, groupId(number), number === 1 ? alternate : await editionId(number, true), status]);
    }
    const queries = [];
    const trackedPool = { query: async (...args) => {
      const result = await pool.query(...args);
      queries.push({ sql: typeof args[0] === 'string' ? args[0] : args[0].text, rows: result.rows.length });
      return result;
    } };
    const metadata = createMetadataReadService({ pool: trackedPool, metadataReleaseDetectionService: {
      listDetectionEventsPageForArtist: async () => ({ entries: [], pageInfo: { hasMore: false, nextCursor: null } }),
    } });
    const fullInputs = await metadata.getArtist({ artistId });
    const fullQueries = queries.splice(0);
    const compactInputs = await metadata.getArtistProjectionInputs({ artistId });
    const compactQueries = queries.splice(0);
    assert.equal(fullInputs.releaseGroups.length, 200);
    assert.equal(fullInputs.releases.length, 1000);
    assert.equal(compactInputs.releaseGroups.length, 200);
    assert.equal(compactInputs.releases.length, 199);
    assert.ok(compactInputs.releaseGroups.every((group) => Object.keys(group).sort().join(',') === 'id,primaryType'));
    assert.ok(compactInputs.releases.every((release) => release.isCanonical === true
      && Object.keys(release).sort().join(',') === 'id,isCanonical,releaseGroupId'));
    assert.equal(Object.hasOwn(compactInputs, 'monitoring'), false);
    assert.ok(compactQueries.every(({ sql }) => !/COUNT\s*\(|(?:metadata|operator)_artist_monitoring/iu.test(sql)), 'Compact inputs avoid edition counts and legacy monitoring');
    const editionQueries = compactQueries.filter(({ sql }) => /metadata_releases/iu.test(sql));
    assert.equal(editionQueries.length, 1);
    assert.match(editionQueries[0].sql, /is_canonical/iu);
    assert.equal(editionQueries[0].rows, 200, 'Canonical join retains groups without any canonical edition');
    const explanation = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${editionQueries[0].sql}`, [artistId]);
    const plan = explanation.rows[0]['QUERY PLAN'][0].Plan;
    const nodes = [];
    function visit(node) {
      nodes.push(node);
      for (const child of node.Plans ?? []) visit(child);
    }
    visit(plan);
    assert.equal(plan['Actual Rows'], 200, 'Compact query retains the entire artist catalog');
    assert.ok(nodes.every((node) => !node['Node Type'].includes('Aggregate')), 'Compact query avoids edition count aggregation');
    t.diagnostic(`Compact query plan: ${plan['Actual Rows']} rows, estimated row width ${plan['Plan Width']} bytes, shared buffer hits ${plan['Shared Hit Blocks'] ?? 0}, shared buffer reads ${plan['Shared Read Blocks'] ?? 0}`);

    const fullBytes = Buffer.byteLength(JSON.stringify(fullInputs));
    const compactBytes = Buffer.byteLength(JSON.stringify(compactInputs));
    assert.ok(compactBytes < fullBytes / 5);
    t.diagnostic(`Inputs full: ${fullQueries.length} queries/${fullQueries.reduce((sum, query) => sum + query.rows, 0)} rows/${fullBytes} bytes; compact: ${compactQueries.length} queries/${compactQueries.reduce((sum, query) => sum + query.rows, 0)} rows/${compactBytes} bytes`);
    const monitoring = createOperatorArtistMonitoringStore({ getPoolFn });
    const reconciliation = createLibraryReleaseReconciliationStore({ getPoolFn });
    const projection = createOperatorArtistProjectionService({ metadataReadService: metadata,
      getOperatorArtistMonitoring: monitoring.getOperatorArtistMonitoring,
      listOperatorReleaseGroupSelections: selections.listOperatorReleaseGroupSelections,
      listOperatorTrackOverrides: overrides.listOperatorTrackOverrides,
      getLatestOperatorArtistReconciliationSnapshot: async () => ({ id: 'saved-snapshot', snapshotRevision: 8 }),
      getLatestRunByOperatorArtist: async () => null, getPendingRunByOperatorArtist: async () => null,
      getRunningRunByOperatorArtist: async () => null,
      listLibraryReleaseReconciliationsByMetadataReleaseIds: reconciliation.listReconciliationsByMetadataReleaseIds,
    });
    const summaries = [];
    for (const actor of actors) {
      const full = await projection.getOperatorArtistProjection({ appUserId: actor, metadataArtistId: artistId });
      queries.length = 0;
      const summary = await projection.getOperatorArtistProjection({ appUserId: actor, metadataArtistId: artistId, view: 'summary' });
      const { releaseGroups: _groups, releases: _releases, ...expected } = full;
      assert.deepEqual(summary, expected);
      assert.equal(summary.operator.releaseGroupSelections.length, 6);
      assert.equal(summary.operator.trackOverrides.length, 3);
      assert.ok(queries.every(({ sql }) => !/COUNT\s*\(|(?:metadata|operator)_artist_monitoring/iu.test(sql)), 'Summary selects compact path rather than full metadata hydration');
      summaries.push(summary);
    }
    const coverage = summaries[0].operator.coverage;
    assert.equal(coverage.acquiredReleaseCount, 2);
    assert.equal(coverage.duplicateReleaseCount, 1);
    assert.equal(coverage.partialReleaseCount, 1);
    assert.equal(coverage.unresolvedReleaseCount, 1);
    assert.ok(coverage.missingReleaseCount > 0);
    assert.notDeepEqual(summaries[0].operator.coverage, summaries[1].operator.coverage);
    assert.equal(summaries[0].operator.reconciliation.latestSnapshot.snapshotRevision, 8);
  } });
});
