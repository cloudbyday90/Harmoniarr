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
import { createMetadataArtistDiscographyService } from '../../src/server/metadata/metadata-artist-discography-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

async function seedArtist(pool, withCatalog) {
  const mbid = randomUUID();
  const { rows: [artist] } = await pool.query(`
    INSERT INTO metadata_artists (source_provider, source_artist_id, musicbrainz_artist_id, name, sort_name)
    VALUES ('musicbrainz', $1::text, $1::uuid, 'Paging Artist', 'Paging Artist') RETURNING id
  `, [mbid]);
  if (withCatalog) await pool.query(`
    WITH groups AS (
      INSERT INTO metadata_release_groups
        (metadata_artist_id, source_provider, source_release_group_id, musicbrainz_release_group_id, title, primary_type, first_release_date)
      SELECT $1, 'musicbrainz', 'page-group-' || number, gen_random_uuid(), 'Same title', 'Album', '2020-01-01'
      FROM generate_series(1, 200) AS number
      RETURNING id, source_release_group_id
    )
    INSERT INTO metadata_releases
      (metadata_release_group_id, source_provider, source_release_id, musicbrainz_release_id, title, status, medium_count, track_count, is_canonical)
    SELECT groups.id, 'musicbrainz', gen_random_uuid()::text, gen_random_uuid(), 'Same edition title', 'Official', 1, 10, edition = 1
    FROM groups CROSS JOIN LATERAL generate_series(1, substring(groups.source_release_group_id FROM '[0-9]+$')::integer % 12) AS edition
  `, [artist.id]);
  return artist.id;
}

test('local discography keyset pages traverse tied catalogs and bound edition counting to each page', { timeout: 120_000 }, async (t) => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const artistId = await seedArtist(pool, true);
    const emptyArtistId = await seedArtist(pool, false);
    const expected = (await pool.query(`
      SELECT groups.id, count(releases.id)::integer AS count
      FROM metadata_release_groups groups LEFT JOIN metadata_releases releases ON releases.metadata_release_group_id = groups.id
      WHERE groups.metadata_artist_id = $1 GROUP BY groups.id ORDER BY groups.id
    `, [artistId])).rows;
    const queries = [];
    const trackedPool = { query: async (...args) => {
      queries.push({ sql: typeof args[0] === 'string' ? args[0] : args[0].text,
        values: args[1] ?? args[0]?.values });
      return pool.query(...args);
    } };
    const service = createMetadataArtistDiscographyService({ getPoolFn: () => trackedPool });
    const read = (options = {}) => service.getArtistDiscography({ metadataArtistId: artistId, ...options });
    const first = await read();
    assert.equal(first.releaseGroups.length, 25);
    assert.equal(first.pageInfo.hasMore, true);
    assert.equal(typeof first.pageInfo.nextCursor, 'string');
    const pageQuery = queries.find(({ sql }) => /metadata_releases/iu.test(sql));
    assert.ok(pageQuery, 'Capture the actual bounded page query for EXPLAIN evidence');
    const all = [...first.releaseGroups];
    let cursor = first.pageInfo.nextCursor;
    let pages = 1;
    let lastPageCursor;
    while (cursor) {
      assert.ok(pages < 20, 'Cursor traversal must terminate');
      lastPageCursor = cursor;
      const page = await read({ cursor });
      assert.ok(page.releaseGroups.length <= 25);
      all.push(...page.releaseGroups);
      assert.equal(page.pageInfo.hasMore, page.pageInfo.nextCursor !== null);
      cursor = page.pageInfo.nextCursor;
      pages += 1;
    }
    assert.equal(pages, 8);
    const single = await read({ limit: 1 });
    assert.deepEqual(single.releaseGroups.map(({ id }) => id), [expected[0].id]);
    assert.equal(single.pageInfo.hasMore, true);
    const secondSingle = await read({ limit: 1, cursor: single.pageInfo.nextCursor });
    assert.deepEqual(secondSingle.releaseGroups.map(({ id }) => id), [expected[1].id]);
    const almostLast = await read({ limit: 24, cursor: lastPageCursor });
    assert.equal(almostLast.releaseGroups.length, 24);
    const partialLast = await read({ limit: 24, cursor: almostLast.pageInfo.nextCursor });
    assert.deepEqual(partialLast.releaseGroups.map(({ id }) => id), [expected.at(-1).id]);
    assert.deepEqual(partialLast.pageInfo, { hasMore: false, nextCursor: null });
    t.diagnostic(`Release-group-only JSON: first page ${Buffer.byteLength(JSON.stringify(first.releaseGroups))} bytes; full catalog ${Buffer.byteLength(JSON.stringify(all))} bytes (edition arrays excluded from both).`);
    assert.deepEqual(all.map(({ id }) => id), expected.map(({ id }) => id));
    assert.equal(new Set(all.map(({ id }) => id)).size, 200);
    assert.deepEqual(all.map(({ releaseCount }) => releaseCount), expected.map(({ count }) => count));
    assert.ok(all.every((group) => group.artistId === artistId && group.title === 'Same title'
      && group.source.provider === 'musicbrainz' && group.source.musicbrainzReleaseGroupId));
    assert.deepEqual(await service.getArtistDiscography({ metadataArtistId: emptyArtistId }), {
      releaseGroups: [], pageInfo: { hasMore: false, nextCursor: null },
    });
    await assert.rejects(service.getArtistDiscography({ metadataArtistId: randomUUID() }), { status: 404 });
    for (const options of [
      { limit: 0 }, { limit: 26 }, { limit: 1.5 }, { limit: [] }, { limit: {} }, { limit: '1e1' },
      { metadataArtistId: 'not-a-uuid' },
      { cursor: 'a'.repeat(513) },
      { cursor: Buffer.from(JSON.stringify({ v: 1, artist: artistId, after: expected[24].id, extra: true })).toString('base64url') },
      { cursor: null }, { cursor: [] }, { cursor: {} }, { cursor: 'not-a-valid-cursor' },
      { cursor: Buffer.from(JSON.stringify({ v: 2, artist: artistId, after: expected[24].id })).toString('base64url') },
      { metadataArtistId: emptyArtistId, cursor: first.pageInfo.nextCursor },
    ]) {
      queries.length = 0;
      await assert.rejects(read(options), { status: 400 });
      assert.equal(queries.length, 0, 'Invalid pagination values reject before database access');
    }

    const explanation = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${pageQuery.sql}`, pageQuery.values);
    const plan = explanation.rows[0]['QUERY PLAN'][0];
    const nodes = [];
    function visit(node) {
      nodes.push(node);
      for (const child of node.Plans ?? []) visit(child);
    }
    visit(plan.Plan);
    const candidates = nodes.find((node) => node['Subplan Name'] === 'CTE candidates');
    const page = nodes.find((node) => node['Subplan Name'] === 'CTE page');
    assert.ok(candidates && candidates['Actual Rows'] <= 26, 'Lookahead materializes at most limit plus one IDs');
    assert.ok(page && page['Actual Rows'] === 25, 'Only page IDs reach edition counting');
    const editionScans = nodes.filter((node) => node['Relation Name'] === 'metadata_releases');
    assert.ok(editionScans.length > 0);
    for (const scan of editionScans) {
      assert.ok(scan['Actual Loops'] === 25, 'Edition counting must not execute for the lookahead group or the entire catalog');
    }
    t.diagnostic(`200 tied-title groups, ${expected.reduce((sum, group) => sum + group.count, 0)} editions, ${pages} pages; candidates ${candidates['Actual Rows']}, page IDs ${page['Actual Rows']}; edition plan nodes: ${JSON.stringify(editionScans.map((node) => ({ type: node['Node Type'], loops: node['Actual Loops'], rows: node['Actual Rows'] })))}; execution ${plan['Execution Time']} ms`);

    const app = createJsonTestApp((server) => registerMetadataRoutes(server, {
      getMetadataArtistDiscography: service.getArtistDiscography,
      requireSession: async (request) => {
        if (request.headers['x-test-session'] !== 'reader') throw Object.assign(new Error('Session required'), { status: 401 });
        return { appUserId: 'test-reader' };
      },
    }));
    await withServer(app, async (baseUrl) => {
      const endpoint = `${baseUrl}/api/v1/metadata/artists/${artistId}/discography`;
      const headers = { 'x-test-session': 'reader' };
      queries.length = 0;
      assert.equal((await fetch(endpoint)).status, 401);
      assert.equal(queries.length, 0);
      const response = await fetch(`${endpoint}?limit=25`, { headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.deepEqual(body.releaseGroups.map(({ id }) => id), expected.slice(0, 25).map(({ id }) => id));
      const nextResponse = await fetch(`${endpoint}?limit=25&cursor=${encodeURIComponent(body.pageInfo.nextCursor)}`, { headers });
      assert.equal(nextResponse.status, 200);
      assert.deepEqual((await nextResponse.json()).releaseGroups.map(({ id }) => id), expected.slice(25, 50).map(({ id }) => id));
      for (const query of ['limit=26', 'limit=2&limit=3', 'cursor=invalid', 'cursor=a&cursor=b']) {
        queries.length = 0;
        assert.equal((await fetch(`${endpoint}?${query}`, { headers })).status, 400);
        assert.equal(queries.length, 0);
      }
    });
    const boundaryId = first.releaseGroups.at(-1).id;
    await pool.query('DELETE FROM metadata_releases WHERE metadata_release_group_id = $1', [boundaryId]);
    await pool.query('DELETE FROM metadata_release_groups WHERE id = $1', [boundaryId]);
    const afterBoundaryDeletion = await read({ cursor: first.pageInfo.nextCursor });
    assert.deepEqual(afterBoundaryDeletion.releaseGroups.map(({ id }) => id), expected.slice(25, 50).map(({ id }) => id),
      'Deleting the cursor boundary must not skip or repeat the next page');
  } });
});
