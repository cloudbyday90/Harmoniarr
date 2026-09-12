/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { createMetadataReadService } from '../../src/server/metadata/metadata-read-service.js';
import { createMetadataReleaseDetectionService } from '../../src/server/metadata/metadata-release-detection-service.js';
import { createMetadataReleaseDetectionStore } from '../../src/server/metadata/metadata-release-detection-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

async function seedLargeArtist(pool) {
  const musicBrainzArtistId = randomUUID();
  const { rows: [artist] } = await pool.query(`
    INSERT INTO metadata_artists (source_provider, source_artist_id, musicbrainz_artist_id, name, sort_name)
    VALUES ('musicbrainz', $1::text, $1::uuid, 'Large Catalog Artist', 'Large Catalog Artist') RETURNING id
  `, [musicBrainzArtistId]);
  await pool.query(`
    WITH groups AS (
      INSERT INTO metadata_release_groups
        (metadata_artist_id, source_provider, source_release_group_id, musicbrainz_release_group_id, title, primary_type)
      SELECT $1, 'musicbrainz', gen_random_uuid()::text, gen_random_uuid(), 'Album ' || number, 'Album'
      FROM generate_series(1, 200) AS number
      RETURNING id, title
    )
    INSERT INTO metadata_releases
      (metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id, title, status, medium_count, track_count, is_canonical)
    SELECT groups.id, 'musicbrainz', gen_random_uuid()::text, gen_random_uuid(), groups.title || ' Edition ' || edition,
      'Official', 1, 10, edition = 1
    FROM groups CROSS JOIN generate_series(1, 5) AS edition
  `, [artist.id]);
  return { musicBrainzArtistId };
}

test('local artist summary avoids large PostgreSQL catalog reads while preserving full-route compatibility', { timeout: 120_000 }, async (t) => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const { musicBrainzArtistId } = await seedLargeArtist(pool);
    const queries = [];
    const trackedPool = {
      async query(...args) {
        const entry = { sql: typeof args[0] === 'string' ? args[0] : args[0].text, rows: 0 };
        queries.push(entry);
        const result = await pool.query(...args);
        entry.rows = result.rowCount ?? 0;
        return result;
      },
    };
    const detectionStore = createMetadataReleaseDetectionStore({ getPoolFn: () => trackedPool });
    const service = createMetadataReadService({
      pool: trackedPool,
      metadataReleaseDetectionService: createMetadataReleaseDetectionService({ metadataReleaseDetectionStore: detectionStore }),
    });
    async function measure(view) {
      queries.length = 0;
      const started = performance.now();
      const payload = await service.getArtistByMusicBrainzId({ musicBrainzArtistId, view });
      return { payload, queries: [...queries], milliseconds: performance.now() - started,
        bytes: Buffer.byteLength(JSON.stringify(payload)) };
    }
    const full = await measure('full');
    const summary = await measure('summary');
    assert.deepEqual(Object.keys(summary.payload).sort(), ['artist', 'monitoring']);
    assert.deepEqual(summary.payload.artist, full.payload.artist);
    assert.deepEqual(summary.payload.monitoring, full.payload.monitoring);
    assert.equal(full.payload.releaseGroups.length, 200);
    assert.equal(full.payload.releases.length, 1000);
    assert.ok(Array.isArray(full.payload.aliases));
    assert.ok(Array.isArray(full.payload.detectionEvents));
    assert.equal(summary.queries.length, 2, 'Summary only resolves artist identity and monitoring');
    assert.ok(full.queries.length > summary.queries.length);
    assert.ok(full.queries.some(({ sql }) => /metadata_release_groups/iu.test(sql)));
    assert.ok(full.queries.some(({ sql }) => /metadata_releases/iu.test(sql)));
    for (const { sql } of summary.queries) {
      assert.doesNotMatch(sql, /metadata_release_groups|metadata_releases|metadata_artist_aliases|metadata_release_detection_events/iu);
    }
    assert.ok(summary.bytes < full.bytes / 10, 'Summary omits the large catalog rather than serializing it again');
    for (const [view, result] of [['full', full], ['summary', summary]]) {
      t.diagnostic(`${view}: ${result.queries.length} SQL queries, ${result.queries.reduce((sum, query) => sum + query.rows, 0)} rows, ${result.bytes} JSON bytes, ${result.milliseconds.toFixed(2)} ms`);
    }

    for (const view of [['summary', 'full'], { mode: 'summary' }]) {
      queries.length = 0;
      await assert.rejects(service.getArtistByMusicBrainzId({ musicBrainzArtistId, view }), { status: 400 });
      assert.equal(queries.length, 0, 'Structured view values reject before database access');
    }

    const app = createJsonTestApp((server) => registerMetadataRoutes(server, {
      getMetadataArtistByMusicBrainzId: service.getArtistByMusicBrainzId,
      requireSession: async (request) => {
        if (request.headers['x-test-session'] !== 'reader') throw Object.assign(new Error('Session required'), { status: 401 });
        return { appUserId: 'test-reader' };
      },
    }));
    await withServer(app, async (baseUrl) => {
      const endpoint = `${baseUrl}/api/v1/metadata/musicbrainz/artists/${musicBrainzArtistId}/local`;
      const headers = { 'x-test-session': 'reader' };
      queries.length = 0;
      assert.equal((await fetch(`${endpoint}?view=summary`)).status, 401);
      assert.equal(queries.length, 0, 'Unauthenticated requests never reach metadata reads');
      const response = await fetch(`${endpoint}?view=summary`, { headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.deepEqual(Object.keys(body).sort(), ['artist', 'monitoring', 'ok']);
      assert.deepEqual(body.artist, JSON.parse(JSON.stringify(summary.payload.artist)));
      assert.deepEqual(body.monitoring, summary.payload.monitoring);
      const legacy = await fetch(endpoint, { headers });
      assert.equal(legacy.status, 200);
      const legacyBody = await legacy.json();
      assert.equal(legacyBody.releaseGroups.length, 200);
      assert.equal(legacyBody.releases.length, 1000);
      queries.length = 0;
      assert.equal((await fetch(`${endpoint}?view=invalid`, { headers })).status, 400);
      assert.equal(queries.length, 0, 'Invalid view rejects before database access');
      assert.equal((await fetch(`${endpoint}?view=summary&view=full`, { headers })).status, 400);
      assert.equal(queries.length, 0, 'Duplicate view query values reject before database access');
      assert.equal((await fetch(`${baseUrl}/api/v1/metadata/musicbrainz/artists/${randomUUID()}/local?view=summary`, { headers })).status, 404);
    });
  } });
});
