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
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createOperatorArtistDiscographyService } from '../../src/server/metadata/operator-artist-discography-service.js';
import { createOperatorArtistDiscographyStore } from '../../src/server/metadata/operator-artist-discography-store.js';
import { createMetadataReadService } from '../../src/server/metadata/metadata-read-service.js';
import { createOperatorArtistProjectionService } from '../../src/server/metadata/operator-artist-projection-service.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

test('operator display pages preserve full effective state while restricting hydration to the actor and page', { timeout: 120_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const firstFixture = await seedMetadataReleaseFixture({ queryable: pool });
    const secondFixture = await seedMetadataReleaseFixture({ queryable: pool, releaseTitle: 'Second album' });
    const artistId = firstFixture.metadataArtistId;
    await pool.query('UPDATE metadata_release_groups SET metadata_artist_id = $1 WHERE id = $2', [artistId, secondFixture.metadataReleaseGroupId]);
    const groups = (await pool.query('SELECT id FROM metadata_release_groups WHERE metadata_artist_id = $1 ORDER BY id', [artistId])).rows;
    const firstId = groups[0].id;
    const offPageId = groups[1].id;
    const canonicalId = (await pool.query('SELECT id FROM metadata_releases WHERE metadata_release_group_id = $1 AND is_canonical', [firstId])).rows[0].id;
    const { rows: [alternate] } = await pool.query(`INSERT INTO metadata_releases
      (metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id, title, status, is_canonical)
      VALUES ($1, 'musicbrainz', $2::text, $2::uuid, 'Operator alternate', 'Official', FALSE) RETURNING id`, [firstId, randomUUID()]);
    const users = (await pool.query(`INSERT INTO app_users (username, password_hash, role, must_change_password)
      VALUES ('page-owner-a', 'test-hash', 'operator', FALSE), ('page-owner-b', 'test-hash', 'operator', FALSE) RETURNING id`)).rows;
    const [actorA, actorB] = users.map(({ id }) => id);
    const selections = createOperatorReleaseGroupSelectionStore({ getPoolFn });
    const overrides = createOperatorTrackOverrideStore({ getPoolFn });
    for (const actor of [actorA, actorB]) {
      await pool.query(`INSERT INTO operator_artist_monitoring (app_user_id, metadata_artist_id, is_monitored, monitored_release_group_types)
        VALUES ($1, $2, TRUE, ARRAY['album','ep'])`, [actor, artistId]);
      await selections.upsertOperatorReleaseGroupSelection({ appUserId: actor, metadataArtistId: artistId,
        metadataReleaseGroupId: firstId, selectionSource: 'manual', selectionState: actor === actorA ? 'partial' : 'unselected',
        resolvedMetadataReleaseId: actor === actorA ? alternate.id : canonicalId });
      await selections.upsertOperatorReleaseGroupSelection({ appUserId: actor, metadataArtistId: artistId,
        metadataReleaseGroupId: offPageId, selectionSource: 'manual', selectionState: 'selected' });
      for (const groupId of [firstId, offPageId]) await overrides.upsertOperatorTrackOverride({
        appUserId: actor, metadataArtistId: artistId, metadataReleaseGroupId: groupId,
        trackMbid: randomUUID(), isDesired: actor === actorB, remapStatus: actor === actorA ? 'review_needed' : 'resolved', queryable: pool,
      });
    }
    const readService = createMetadataReadService({ pool, metadataReleaseDetectionService: {
      listDetectionEventsPageForArtist: async () => ({ entries: [], pageInfo: { hasMore: false, nextCursor: null } }),
    } });
    const monitoring = createOperatorArtistMonitoringStore({ getPoolFn });
    const projectionService = createOperatorArtistProjectionService({
      metadataReadService: readService,
      getOperatorArtistMonitoring: monitoring.getOperatorArtistMonitoring,
      listOperatorReleaseGroupSelections: selections.listOperatorReleaseGroupSelections,
      listOperatorTrackOverrides: overrides.listOperatorTrackOverrides,
      getLatestOperatorArtistReconciliationSnapshot: async () => ({ id: 'snapshot', snapshotRevision: 3 }),
      getLatestRunByOperatorArtist: async () => null, getPendingRunByOperatorArtist: async () => null,
      getRunningRunByOperatorArtist: async () => null, listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => [],
    });
    const queryLog = [];
    const trackedPool = { query: async (sql, values) => { const result = await pool.query(sql, values); queryLog.push({ sql, values, rows: result.rows }); return result; } };
    const stateStore = createOperatorArtistDiscographyStore({ getPoolFn: () => trackedPool });
    const pageService = createOperatorArtistDiscographyService({ getPoolFn: () => trackedPool, store: stateStore });
    for (const actor of [actorA, actorB]) {
      const full = await projectionService.getOperatorArtistProjection({ appUserId: actor, metadataArtistId: artistId });
      const summary = await projectionService.getOperatorArtistProjection({ appUserId: actor, metadataArtistId: artistId, view: 'summary' });
      assert.deepEqual(summary.operator, full.operator);
      assert.equal(summary.operator.releaseGroupSelections.length, 2);
      assert.equal(summary.operator.trackOverrides.length, 2);
      assert.equal(Object.hasOwn(summary, 'releaseGroups'), false);
      queryLog.length = 0;
      const page = await pageService.getOperatorArtistDiscography({ appUserId: actor, metadataArtistId: artistId, limit: 1 });
      assert.deepEqual(page.releaseGroups, full.releaseGroups.filter(({ id }) => id === firstId));
      assert.deepEqual(Object.keys(page).sort(), ['pageInfo', 'releaseGroups']);
      assert.equal(queryLog.length, 6, 'Page hydration reads catalog, policy, page overrides and selected editions without full projection');
      const state = await stateStore.readPageState({ appUserId: actor, metadataArtistId: artistId, releaseGroupIds: [firstId] });
      assert.equal(state.releaseGroupSelections.length, 1);
      assert.equal(state.trackOverrides.length, 1);
      assert.ok(state.releaseGroupSelections.every((entry) => entry.appUserId === actor && entry.metadataReleaseGroupId === firstId));
      assert.ok(state.trackOverrides.every((entry) => entry.appUserId === actor && entry.metadataReleaseGroupId === firstId));
      assert.deepEqual(new Set(state.releases.map(({ id }) => id)), new Set(actor === actorA ? [canonicalId, alternate.id] : [canonicalId]));
      assert.equal(page.releaseGroups[0].operatorState.resolvedRelease.id, actor === actorA ? alternate.id : canonicalId);
      const next = await pageService.getOperatorArtistDiscography({ appUserId: actor, metadataArtistId: artistId, limit: 1, cursor: page.pageInfo.nextCursor });
      assert.deepEqual(next.releaseGroups, full.releaseGroups.filter(({ id }) => id === offPageId));
    }
    await assert.rejects(pageService.getOperatorArtistDiscography({ metadataArtistId: artistId }), { status: 401 });
    const app = createJsonTestApp((server) => registerMetadataRoutes(server, {
      getOperatorArtistDiscography: pageService.getOperatorArtistDiscography,
      getOperatorArtistProjection: async () => { throw new Error('Page route must never compute global projection'); },
      requireSession: async (request) => {
        if (request.headers['x-test-actor'] !== actorA) throw Object.assign(new Error('Session required'), { status: 401 });
        return { appUserId: actorA };
      },
    }));
    await withServer(app, async (baseUrl) => {
      const endpoint = `${baseUrl}/api/v1/metadata/artists/${artistId}/operator/discography?limit=1&appUserId=${actorB}`;
      assert.equal((await fetch(endpoint)).status, 401);
      const response = await fetch(endpoint, { headers: { 'x-test-actor': actorA } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).releaseGroups[0].operatorState.selectionState, 'partial');
    });
  } });
});
