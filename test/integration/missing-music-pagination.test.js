/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { createMissingMusicPaginationService, seedMissingMusicPaginationRows, seedMissingMusicPaginationUser } from '../../testing/integration/missing-music-pagination-fixtures.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason = null;

suite('Missing Music bounded PostgreSQL pagination', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  async function scenario(t, run) {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
      await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
      await run({ getPoolFn, queryable: getPoolFn() });
    });
  }

  test('all-state pages traverse beyond 2,000 releases with microsecond precision and bounded enrichment', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async ({ getPoolFn, queryable }) => {
      const actorUser = await seedMissingMusicPaginationUser({ queryable });
      const fixture = await seedMissingMusicPaginationRows({ queryable, appUserId: actorUser.id, count: 2105 });
      const evidenceReads = [];
      const service = createMissingMusicPaginationService({ getPoolFn, onEvidenceRead: (options) => evidenceReads.push(options) });
      const ids = [];
      let cursor = null;
      do {
        const page = await service.listMissingMusicDecisions({ actorUser, state: 'all', limit: 100, cursor });
        assert.equal(page.page.total, null);
        assert.equal(page.page.sourceLimitReached, false);
        assert.ok(page.page.scannedCount <= 100);
        ids.push(...page.decisions.map((decision) => decision.decisionId));
        cursor = page.page.nextCursor;
        assert.equal(page.page.hasMore, Boolean(cursor));
      } while (cursor);
      assert.deepEqual(ids, fixture.rows.map((row) => row.id));
      assert.equal(new Set(ids).size, 2105);
      assert.ok(evidenceReads.every((read) => read.wantedReleaseIds.length <= 100 && read.appUserIds[0] === actorUser.id));
    });
  });

  test('equal timestamps, newer inserts, and deleted boundaries do not duplicate or skip retained source rows', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async ({ getPoolFn, queryable }) => {
      const actorUser = await seedMissingMusicPaginationUser({ queryable });
      const fixture = await seedMissingMusicPaginationRows({ queryable, appUserId: actorUser.id, count: 6, microsecondSteps: false });
      const service = createMissingMusicPaginationService({ getPoolFn });
      const first = await service.listMissingMusicDecisions({ actorUser, state: 'all', limit: 2 });
      assert.deepEqual(first.decisions.map((row) => row.decisionId), fixture.rows.slice(0, 2).map((row) => row.id));
      await queryable.query('DELETE FROM library_wanted_releases WHERE id = $1', [first.decisions[1].decisionId]);
      await seedMissingMusicPaginationRows({ queryable, appUserId: actorUser.id, count: 1, createdAt: '2026-09-12T00:00:00.000000Z' });
      const next = await service.listMissingMusicDecisions({ actorUser, state: 'all', limit: 2, cursor: first.page.nextCursor });
      assert.deepEqual(next.decisions.map((row) => row.decisionId), fixture.rows.slice(2, 4).map((row) => row.id));
    });
  });

  test('sparse state filters offer continuation after 200 nonmatching sources without counting them as decisions', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async ({ getPoolFn, queryable }) => {
      const actorUser = await seedMissingMusicPaginationUser({ queryable });
      const fixture = await seedMissingMusicPaginationRows({ queryable, appUserId: actorUser.id, count: 205 });
      const match = fixture.rows[202];
      await queryable.query(`INSERT INTO library_discovery_requests
        (metadata_artist_id, metadata_release_group_id, metadata_release_id, wanted_status, request_status, evidence)
        SELECT metadata_artist_id, metadata_release_group_id, metadata_release_id, 'missing', 'ready', '{"lastSearchId":"pagination-downloading"}'::jsonb
        FROM library_wanted_releases WHERE id = $1`, [match.id]);
      await seedImportCandidateFixture({ queryable, candidateOverrides: { sourceSearchId: 'pagination-downloading', status: 'downloading' } });
      const service = createMissingMusicPaginationService({ getPoolFn });
      const first = await service.listMissingMusicDecisions({ actorUser, state: 'downloading', limit: 50 });
      assert.deepEqual(first.decisions, []);
      assert.equal(first.page.scannedCount, 200);
      assert.equal(first.page.scanLimitReached, true);
      assert.equal(first.page.hasMore, true);
      const next = await service.listMissingMusicDecisions({ actorUser, state: 'downloading', limit: 50, cursor: first.page.nextCursor });
      assert.deepEqual(next.decisions.map((decision) => decision.decisionId), [match.id]);
      assert.equal(next.page.scannedCount, 5);
      assert.equal(next.page.hasMore, false);
      assert.equal(next.page.scanLimitReached, false);
    });
  });

  test('recipient scope, search, disabled history, and cursor binding remain authoritative before and after enrichment', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async ({ getPoolFn, queryable }) => {
      const actorUser = await seedMissingMusicPaginationUser({ queryable });
      const otherUser = await seedMissingMusicPaginationUser({ queryable });
      const disabledUser = await seedMissingMusicPaginationUser({ queryable, isDisabled: true });
      const admin = await seedMissingMusicPaginationUser({ queryable, role: 'admin' });
      const own = await seedMissingMusicPaginationRows({ queryable, appUserId: actorUser.id, count: 3, titlePrefix: 'Own match' });
      const other = await seedMissingMusicPaginationRows({ queryable, appUserId: otherUser.id, count: 3, titlePrefix: 'Other match' });
      await seedMissingMusicPaginationRows({ queryable, appUserId: disabledUser.id, count: 2, titlePrefix: 'Disabled history' });
      const service = createMissingMusicPaginationService({ getPoolFn });
      const first = await service.listMissingMusicDecisions({ actorUser, scope: 'all', state: 'all', limit: 1, q: 'own match' });
      assert.equal(first.decisions[0].requestedFor.id, actorUser.id);
      assert.deepEqual(first.users, []);
      for (const changes of [{ actorUser: otherUser }, { q: 'other' }, { state: 'action' }, { limit: 2 }]) {
        await assert.rejects(() => service.listMissingMusicDecisions({ actorUser, state: 'all', limit: 1, q: 'own match', cursor: first.page.nextCursor, ...changes }), { status: 400, code: 'missing_music_cursor_invalid' });
      }
      await assert.rejects(() => service.listMissingMusicDecisions({ actorUser, requestedForUserId: otherUser.id }), { status: 403 });
      await assert.rejects(() => service.listMissingMusicDecisions({ actorUser, offset: 1 }), { status: 400 });
      const history = await service.listMissingMusicDecisions({ actorUser: admin, accountStatus: 'disabled', state: 'all', q: 'disabled' });
      assert.equal(history.decisions.length, 2);
      assert.ok(history.decisions.every((row) => row.requestedFor.id === disabledUser.id && row.requestedFor.accountStatus === 'disabled'));
      const store = createLibraryWantedReleaseStore({ getPoolFn });
      assert.deepEqual(await store.listWantedReleasesWithMetadata({ appUserIds: [actorUser.id], wantedReleaseIds: other.rows.map((row) => row.id) }), []);
      assert.deepEqual(await store.listWantedReleasesWithMetadata({ appUserIds: [], wantedReleaseIds: own.rows.map((row) => row.id) }), []);
    });
  });
});
