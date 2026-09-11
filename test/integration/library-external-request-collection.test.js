/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { createAppUserService } from '../../src/server/app-user-service.js';
import { createLibraryExternalRequestCollectionIntakeService } from '../../src/server/library/library-external-request-collection-intake-service.js';
import { createLibraryExternalRequestCollectionProgressStore } from '../../src/server/library/library-external-request-collection-progress-store.js';
import { createLibraryModule } from '../../src/server/library/library-module.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const password = 'CollectionReviewPass123!';
const requestPath = '/api/v1/library/media-requests';
const planningType = 'library_external_intake_planning';
const executionType = 'library_external_intake_execution';
const sourceUrl = 'https://open.spotify.com/playlist/collection123';
let runtime;
let unavailableReason = null;

async function createFamily(context, { count = 1, url = sourceUrl, finishRuns = true } = {}) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const created = await context.client.requestJson('/api/v1/users', {
      csrf: true,
      json: { password, role: 'requester', username: `collection-listener-${index + 1}` },
      method: 'POST',
    });
    assert.equal(created.response.status, 201);
    users.push(created.payload.user);
  }
  const created = await context.client.requestJson(requestPath, {
    csrf: true,
    json: { requestKind: 'external_url', requestedForUserIds: users.map((user) => user.id), sourceUrl: url },
    method: 'POST',
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  const requests = await context.pool.query('SELECT id, requested_for_user_id FROM media_requests');
  if (finishRuns) await finishPreparationRuns(context.pool);
  return { users, requests: users.map((user) => requests.rows.find((row) => row.requested_for_user_id === user.id)) };
}

async function finishPreparationRuns(pool) {
  await pool.query("UPDATE operation_runs SET status = 'completed', finished_at = NOW() WHERE operation_type = ANY($1::text[]) AND status IN ('pending', 'running')", [[planningType, executionType]]);
}

function reviewPath(mediaRequestId) {
  return `${requestPath}/${mediaRequestId}/external-review`;
}

function album(id, name = `Album ${id}`) {
  return {
    id, name, album_type: 'album', type: 'album',
    artists: [{ id: 'artist123', name: 'Collection Artist' }],
    release_date: '2026-01-01', total_tracks: 1,
    tracks: { items: [{ id: `track${id}`, name: 'One Track', type: 'track' }], next: null },
  };
}

function playlistPage(albumIds, { offset = 0, next = null, total = albumIds.length } = {}) {
  return {
    items: albumIds.map((id) => ({ item: {
      id: `track${id}`, type: 'track', name: `Track ${id}`,
      album: album(id), artists: [{ id: 'artist123', name: 'Collection Artist' }],
    } })),
    offset, next, total, limit: 100,
  };
}

function createIntake({ pages = [playlistPage(['album1'])], spotifyOverrides = {}, beforePage = null } = {}) {
  const calls = [];
  const service = createLibraryExternalRequestCollectionIntakeService({
    resolveProviderClients: () => ({
      spotify: {
        async getPlaylistSnapshot(id) { calls.push(['snapshot', id]); return { id, snapshot_id: 'snapshot1' }; },
        async getPlaylistItems(id, { offset }) {
          calls.push(['page', id, offset]);
          await beforePage?.({ offset });
          const page = pages.find((item) => item.offset === offset);
          assert.ok(page, `Unexpected Spotify offset ${offset}`);
          return page;
        },
        async getAlbum(id) { calls.push(['album', id]); return album(id); },
        ...spotifyOverrides,
      },
    }),
  });
  return { calls, service };
}

async function startCollection(context, mediaRequestId) {
  const response = await postReview(context, mediaRequestId, '/collection/start', { restart: false });
  assert.equal(response.response.status, 202, JSON.stringify(response.payload));
  assert.equal(response.payload.accepted, true);
  return response.payload;
}

async function getReview(context, mediaRequestId, query = '') {
  const response = await context.client.requestJson(`${reviewPath(mediaRequestId)}${query}`);
  assert.equal(response.response.status, 200, JSON.stringify(response.payload));
  return response.payload;
}

async function prepareCollection(context, mediaRequestId, intake = createIntake()) {
  const started = await startCollection(context, mediaRequestId);
  const result = await drainPreparation(context, mediaRequestId, intake, started.run.id);
  return { ...intake, result, started };
}

async function drainPreparation(context, mediaRequestId, intake, initialRunId = null) {
  let operationRunId = initialRunId;
  for (let batch = 0; batch < 6; batch += 1) {
    if (!operationRunId) {
      const recovered = await postReview(context, mediaRequestId, '/recover', {});
      assert.equal(recovered.response.status, 202, JSON.stringify(recovered.payload));
      operationRunId = recovered.payload.run.id;
    }
    const result = await intake.service.executeCollection({ mediaRequestId, operationRunId, triggeredByUserId: context.adminId });
    assert.equal(result.failedCount, 0);
    await finishPreparationRuns(context.pool);
    const state = await context.pool.query('SELECT status FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId]);
    if (state.rows[0].status === 'ready') return result;
    assert.equal(state.rows[0].status, 'preparing');
    operationRunId = null;
  }
  assert.fail('Fixture preparation did not finish in six explicit batches');
}

async function postReview(context, mediaRequestId, suffix, json) {
  return context.client.requestJson(`${reviewPath(mediaRequestId)}${suffix}`, { csrf: true, json, method: 'POST' });
}

async function persistAppliedCandidate(context, { mediaRequestId, requestedForUserId, intentId, metadataReleaseId }) {
  return seedImportCandidateFixture({
    queryable: context.pool,
    candidateOverrides: {
      status: 'applied',
      normalizedPayload: { requestOwnership: {
        sourceMediaRequestId: mediaRequestId, sourceRequestedForUserId: requestedForUserId,
        sourceRequestedByUserId: context.adminId, sourceRequestKind: 'external_url', sourceType: 'media_request',
        externalRequestReleaseIntentId: intentId, metadataReleaseId,
      } },
    },
  });
}

async function runScenario(t, run) {
  if (unavailableReason) {
    t.skip(unavailableReason);
    return;
  }
  await runtime.runScenario(async (context) => {
    const bootstrap = await bootstrapAdminSession(context.client);
    assert.equal(bootstrap.response.status, 201);
    await run({ ...context, adminId: bootstrap.payload.user.id, pool: context.getPoolFn() });
  });
}

suite('integration external request collections', () => {
  before(async () => {
    try {
      runtime = await createIntegrationAppRuntime({ config });
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('reports request-scoped preparation counts, unknown traversal totals, and eligible running batches from one revision', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { count: 2 });
    const [request, sibling] = fixture.requests;
    const started = await startCollection(context, request.id);
    await startCollection(context, sibling.id);
    const store = createLibraryExternalRequestCollectionProgressStore({ getPoolFn: () => context.pool });
    let review = await getReview(context, request.id, '?limit=1');
    assert.deepEqual(review.preparation.progress.work, { total: 1, completed: 0, pending: 1, failed: 0, processing: 0, unsupported: 0 });
    assert.deepEqual(review.preparation.progress.operations, { queued: 1, running: 0 });
    assert.equal(review.preparation.progress.pages.total, null);
    assert.equal(review.preparation.progress.revision, review.collection.revision);
    assert.equal(await store.getPreparationProgress({ mediaRequestId: request.id, requestedForUserId: request.requested_for_user_id,
      revision: review.collection.revision + 1 }), null);
    assert.equal(await store.getPreparationProgress({ mediaRequestId: request.id, requestedForUserId: sibling.requested_for_user_id,
      revision: review.collection.revision }), null);
    await context.pool.query("UPDATE operation_runs SET status = 'running' WHERE id = $1", [started.run.id]);
    const pages = [playlistPage(['album1', 'album2'], { next: 'https://api.spotify.com/v1/playlists/collection123/items?offset=2&limit=100', total: 3 }),
      playlistPage(['album3'], { offset: 2, total: 3 })];
    const intake = createIntake({ pages, spotifyOverrides: { async getAlbum(id) {
      if (id === 'album1') throw new Error('Fixture metadata preparation failure');
      return album(id);
    } } });
    await intake.service.executeCollection({ mediaRequestId: request.id, operationRunId: started.run.id });
    review = await getReview(context, request.id, '?limit=1');
    assert.equal(review.items.length, 1);
    assert.equal(review.preparation.progress.leavesCaptured, 2);
    assert.deepEqual(review.preparation.progress.work, { total: 4, completed: 1, pending: 3, failed: 0, processing: 0, unsupported: 0 });
    assert.deepEqual(review.preparation.progress.operations, { queued: 0, running: 1 });
    assert.deepEqual(review.preparation.progress.pages, { completed: 1, pending: 1, failed: 0, total: null, traversalComplete: false });
    await finishPreparationRuns(context.pool);
    const recovered = await postReview(context, request.id, '/recover', {});
    await intake.service.executeCollection({ mediaRequestId: request.id, operationRunId: recovered.payload.run.id });
    await finishPreparationRuns(context.pool);
    review = await getReview(context, request.id);
    assert.deepEqual(review.preparation.progress.work, { total: 5, completed: 3, pending: 1, failed: 1, processing: 0, unsupported: 0 });
    assert.deepEqual(review.preparation.progress.pages, { completed: 2, pending: 0, failed: 0, total: 2, traversalComplete: true });
    assert.equal(review.collection.status, 'preparing');
    assert.equal(review.preparation.canRecover, true);
    const detail = await context.client.requestJson(`${requestPath}/${request.id}`);
    assert.equal(detail.payload.mediaRequest.fulfillmentStatus.code, 'under_review');
    assert.match(detail.payload.mediaRequest.fulfillmentStatus.detail, /2 provider pages prepared; 3 collection items captured/);
    await context.pool.query('UPDATE media_requests SET requested_for_user_id = $2 WHERE id = $1', [request.id, sibling.requested_for_user_id]);
    review = await getReview(context, request.id);
    assert.equal(review.collection.targetMatches, false);
    assert.equal(review.preparation.progress, null);
    const cancelled = await context.client.requestJson(`${requestPath}/${request.id}/cancel`, {
      method: 'POST', csrf: true, json: { reason: 'Preparation is no longer wanted' },
    });
    assert.equal(cancelled.response.status, 200);
    const inactive = await context.client.requestJson(reviewPath(request.id));
    assert.equal(inactive.response.status, 409);
    assert.equal(inactive.payload.error.code, 'external_request_inactive');
  }));

  test('blocked page preparation keeps its total unknown and suppresses stale active batch labels', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    const started = await startCollection(context, mediaRequestId);
    const intake = createIntake({ spotifyOverrides: { async getPlaylistItems() { return { items: [] }; } } });
    await intake.service.executeCollection({ mediaRequestId, operationRunId: started.run.id });
    const review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.status, 'blocked');
    assert.deepEqual(review.preparation.progress.work, { total: 1, completed: 0, pending: 0, failed: 1, processing: 0, unsupported: 0 });
    assert.equal(review.preparation.progress.pages.total, null);
    assert.equal(review.preparation.progress.pages.failed, 1);
    assert.deepEqual(review.preparation.progress.operations, { queued: 0, running: 0 });
  }));

  test('automatically creates tracked collections through the module planning service and resumes without resetting committed evidence', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { count: 3, finishRuns: false });
    assert.equal((await context.pool.query('SELECT media_request_id FROM library_external_request_collections')).rowCount, 0);
    const queuedReview = await getReview(context, fixture.requests[0].id);
    assert.equal(queuedReview.collection, null);
    assert.equal(queuedReview.canStartCollection, false, 'queued automatic planning owns collection initialization');
    const module = createLibraryModule({ getAppUserById: createAppUserService().getAppUserById });
    const planningRuns = await context.pool.query('SELECT id, status, summary FROM operation_runs WHERE operation_type = $1', [planningType]);
    assert.equal(planningRuns.rows.length, 3);
    for (const request of fixture.requests.slice(0, 2)) {
      const run = planningRuns.rows.find((row) => row.summary.mediaRequestId === request.id);
      assert.equal(run.status, 'pending');
      const input = { mediaRequestId: request.id, operationRunId: run.id, triggeredByUserId: context.adminId };
      const planned = await module.libraryProviderIngestPlanningService.planExternalMediaRequest(input);
      assert.equal(planned.collection.status, 'preparing');
      assert.equal(planned.collection.requestedForUserId, request.requested_for_user_id);
      assert.equal(planned.providerIngestRequests.length, 1);
      assert.ok(planned.providerIngestRequests[0].ingestKey);
      const repeated = await module.libraryProviderIngestPlanningService.planExternalMediaRequest(input);
      assert.equal(repeated.collection.revision, planned.collection.revision);
      assert.equal(repeated.providerIngestRequests[0].id, planned.providerIngestRequests[0].id);
    }
    const request = fixture.requests[0];
    const run = planningRuns.rows.find((row) => row.summary.mediaRequestId === request.id);
    const intake = createIntake();
    const executed = await intake.service.executeCollection({ mediaRequestId: request.id, operationRunId: run.id, triggeredByUserId: context.adminId });
    assert.equal(executed.executedCount, 1);
    const originalWork = await context.pool.query('SELECT id, status, evidence FROM provider_ingest_requests WHERE media_request_id = $1 ORDER BY id', [request.id]);
    const resumed = await module.libraryProviderIngestPlanningService.planExternalMediaRequest({
      mediaRequestId: request.id, operationRunId: run.id, triggeredByUserId: context.adminId,
    });
    assert.equal(resumed.collection.revision, executed.collection.revision);
    assert.equal(resumed.collection.pagesCompleted, 1);
    assert.equal(resumed.providerIngestRequests.length, 1);
    assert.equal(resumed.providerIngestRequests[0].ingestTargetType, 'release');
    const retainedWork = await context.pool.query('SELECT id, status, evidence FROM provider_ingest_requests WHERE media_request_id = $1 ORDER BY id', [request.id]);
    assert.deepEqual(retainedWork.rows, originalWork.rows);
    const audits = await context.pool.query("SELECT id FROM audit_events WHERE event_type = 'provider_collection_preparation_started'");
    assert.equal(audits.rowCount, 2, 'planning replay must not publish a second collection initialization');

    const legacyRequest = fixture.requests[2];
    const legacyRun = planningRuns.rows.find((row) => row.summary.mediaRequestId === legacyRequest.id);
    const metadata = await seedMetadataReleaseFixture({ queryable: context.pool });
    const legacyWork = await context.pool.query(`
      INSERT INTO provider_ingest_requests
        (media_request_id, source_provider, source_resource_type, ingest_target_type, source_identifier, canonical_url, status, evidence)
      VALUES ($1, 'spotify', 'release', 'release', 'legacyalbum', 'https://open.spotify.com/album/legacyalbum', 'completed', $2::jsonb)
      RETURNING id, status, evidence
    `, [legacyRequest.id, JSON.stringify({ response: album('legacyalbum'), fetchedAt: '2026-09-10T00:00:00.000Z' })]);
    await context.pool.query(`
      INSERT INTO library_external_request_release_intents
        (media_request_id, metadata_release_id, requested_for_user_id, provider_key, provider_evidence, approved_by_user_id)
      VALUES ($1, $2, $3, 'spotify:release:legacyalbum', '{}'::jsonb, $4)
    `, [legacyRequest.id, metadata.metadataReleaseId, legacyRequest.requested_for_user_id, context.adminId]);
    await assert.rejects(module.libraryProviderIngestPlanningService.planExternalMediaRequest({
      mediaRequestId: legacyRequest.id, operationRunId: legacyRun.id, triggeredByUserId: context.adminId,
    }), { status: 409, code: 'external_collection_legacy_approvals' });
    const preserved = await context.pool.query('SELECT id, status, evidence FROM provider_ingest_requests WHERE media_request_id = $1', [legacyRequest.id]);
    assert.deepEqual(preserved.rows, legacyWork.rows);
    assert.equal((await context.pool.query('SELECT media_request_id FROM library_external_request_collections WHERE media_request_id = $1', [legacyRequest.id])).rowCount, 0);
  }));

  test('commits page evidence, derived work, review leaves, and the next checkpoint atomically', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    const started = await startCollection(context, mediaRequestId);
    const intake = createIntake({ pages: [playlistPage(['album1', 'album2'], {
      next: 'https://api.spotify.com/v1/playlists/collection123/items?offset=2&limit=100', total: 3,
    })] });
    await context.pool.query(`
      CREATE FUNCTION integration_reject_collection_leaf() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.source_identifier = 'album2' THEN RAISE EXCEPTION 'integration collection leaf failure'; END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER integration_reject_collection_leaf BEFORE INSERT ON library_external_request_collection_items
        FOR EACH ROW EXECUTE FUNCTION integration_reject_collection_leaf();
    `);
    try {
      const result = await intake.service.executeCollection({ mediaRequestId, operationRunId: started.run.id, triggeredByUserId: context.adminId });
      assert.equal(result.failedCount, 1);
      const leaves = await context.pool.query('SELECT id FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId]);
      assert.deepEqual(leaves.rows, []);
      const work = await context.pool.query('SELECT page_cursor, next_page_cursor, status, evidence FROM provider_ingest_requests WHERE media_request_id = $1', [mediaRequestId]);
      assert.equal(work.rows.length, 1);
      assert.equal(work.rows[0].page_cursor, null);
      assert.equal(work.rows[0].next_page_cursor, null);
      assert.equal(work.rows[0].status, 'failed');
      assert.equal('response' in work.rows[0].evidence, false);
      const state = await context.pool.query('SELECT status, pages_completed, items_seen FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId]);
      assert.equal(state.rows[0].status, 'preparing');
      assert.equal(state.rows[0].pages_completed, 0);
      assert.equal(state.rows[0].items_seen, 0);
    } finally {
      await context.pool.query('DROP TRIGGER integration_reject_collection_leaf ON library_external_request_collection_items');
      await context.pool.query('DROP FUNCTION integration_reject_collection_leaf()');
    }
  }));

  test('coalesces duplicate page execution while retaining input cursors and one review leaf per album', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    const started = await startCollection(context, mediaRequestId);
    let firstPageFetchCount = 0;
    let releaseFirstPage;
    const firstPageBarrier = new Promise((resolve) => { releaseFirstPage = resolve; });
    const intake = createIntake({ pages: [
      playlistPage(['album1'], { total: 3, next: 'https://api.spotify.com/v1/playlists/collection123/items?offset=1&limit=100' }),
      playlistPage(['album1', 'album2'], { offset: 1, total: 3 }),
    ], async beforePage({ offset }) {
      if (offset !== 0) return;
      firstPageFetchCount += 1;
      if (firstPageFetchCount === 2) releaseFirstPage();
      await firstPageBarrier;
    } });
    const input = { mediaRequestId, operationRunId: started.run.id, triggeredByUserId: context.adminId };
    const results = await Promise.all([intake.service.executeCollection(input), intake.service.executeCollection(input)]);
    assert.ok(results.every((result) => result.failedCount === 0));
    assert.equal(firstPageFetchCount, 2);
    assert.equal(results.reduce((sum, result) => sum + result.executedCount, 0), 1, 'concurrent fetches must commit the initial page once');
    const initialState = await context.pool.query('SELECT pages_completed, items_seen FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId]);
    assert.deepEqual(initialState.rows, [{ pages_completed: 1, items_seen: 1 }]);
    await finishPreparationRuns(context.pool);
    await drainPreparation(context, mediaRequestId, intake);
    const work = await context.pool.query('SELECT ingest_target_type, page_cursor, next_page_cursor, status FROM provider_ingest_requests WHERE media_request_id = $1 ORDER BY page_number', [mediaRequestId]);
    assert.equal(work.rows.length, 4);
    const pages = work.rows.filter((row) => row.ingest_target_type === 'playlist_page');
    assert.deepEqual(pages.map((row) => [row.page_cursor, row.next_page_cursor]), [[null, '1'], ['1', null]]);
    assert.ok(work.rows.every((row) => row.status === 'completed'));
    const state = await context.pool.query('SELECT status, pages_completed, items_seen FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId]);
    assert.equal(state.rows[0].status, 'ready');
    assert.equal(state.rows[0].pages_completed, 2);
    assert.equal(state.rows[0].items_seen, 3, 'source entries are counted once even when albums repeat across tracks');
    const leaves = await context.pool.query('SELECT item_key FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId]);
    assert.equal(leaves.rows.length, 2);
    assert.equal(new Set(leaves.rows.map((row) => row.item_key)).size, 2);
    const replay = await intake.service.executeCollection(input);
    assert.equal(replay.executedCount, 0);
    assert.equal((await context.pool.query('SELECT pages_completed FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId])).rows[0].pages_completed, 2);
  }));

  test('stops at the work batch limit and resumes only after explicit preparation recovery', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    const started = await startCollection(context, mediaRequestId);
    const intake = createIntake({ pages: [playlistPage(Array.from({ length: 11 }, (_, index) => `album${index + 1}`))] });
    const enumerated = await intake.service.executeCollection({ mediaRequestId, operationRunId: started.run.id, triggeredByUserId: context.adminId });
    assert.equal(enumerated.executedCount, 1);
    await finishPreparationRuns(context.pool);
    const firstRecovery = await postReview(context, mediaRequestId, '/recover', {});
    assert.equal(firstRecovery.response.status, 202);
    const first = await intake.service.executeCollection({ mediaRequestId, operationRunId: firstRecovery.payload.run.id, triggeredByUserId: context.adminId });
    assert.equal(first.executedCount, 10);
    assert.equal(first.failedCount, 0);
    await finishPreparationRuns(context.pool);
    let review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.status, 'preparing');
    assert.equal(review.collection.canFinalize, false);
    assert.equal(review.preparation.canRecover, true);
    const recovery = await postReview(context, mediaRequestId, '/recover', {});
    assert.equal(recovery.response.status, 202, JSON.stringify(recovery.payload));
    const second = await intake.service.executeCollection({ mediaRequestId, operationRunId: recovery.payload.run.id, triggeredByUserId: context.adminId });
    assert.equal(second.executedCount, 1);
    assert.equal(second.failedCount, 0);
    await finishPreparationRuns(context.pool);
    review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.status, 'ready');
    assert.equal(review.collection.leafCount, 11);
    assert.equal(review.collection.pendingCount, 11);
    assert.equal(intake.calls.filter(([kind]) => kind === 'page').length, 1);
    assert.equal(intake.calls.filter(([kind]) => kind === 'album').length, 11);
  }));

  for (const invalidPage of ['cycle', 'foreign_origin', 'missing_next', 'invalid_items']) {
    test(`blocks ${invalidPage} provider pages without publishing leaves or continuation work`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => runScenario(t, async (context) => {
      const fixture = await createFamily(context);
      const mediaRequestId = fixture.requests[0].id;
      const started = await startCollection(context, mediaRequestId);
      const page = playlistPage(['album1']);
      if (invalidPage === 'cycle') page.next = 'https://api.spotify.com/v1/playlists/collection123/items?offset=0';
      if (invalidPage === 'foreign_origin') page.next = 'https://untrusted.example/v1/playlists/collection123/items?offset=1';
      if (invalidPage === 'missing_next') delete page.next;
      if (invalidPage === 'invalid_items') page.items = {};
      const intake = createIntake({ pages: [page] });
      const result = await intake.service.executeCollection({ mediaRequestId, operationRunId: started.run.id, triggeredByUserId: context.adminId });
      assert.equal(result.failedCount, 1);
      const state = await context.pool.query('SELECT status, pages_completed, items_seen FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId]);
      assert.deepEqual(state.rows, [{ status: 'blocked', pages_completed: 0, items_seen: 0 }]);
      assert.equal((await context.pool.query('SELECT id FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId])).rowCount, 0);
      assert.equal((await context.pool.query('SELECT id FROM provider_ingest_requests WHERE media_request_id = $1', [mediaRequestId])).rowCount, 1);
    }));
  }

  for (const change of ['cancellation', 'reassignment']) {
    test(`rejects page results after request ${change} while a provider fetch is in progress`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => runScenario(t, async (context) => {
      const fixture = await createFamily(context, { count: 2 });
      const mediaRequestId = fixture.requests[0].id;
      const started = await startCollection(context, mediaRequestId);
      const intake = createIntake({ spotifyOverrides: {
        async getPlaylistItems() {
          if (change === 'cancellation') await context.pool.query("UPDATE media_requests SET request_state = 'cancelled' WHERE id = $1", [mediaRequestId]);
          else await context.pool.query('UPDATE media_requests SET requested_for_user_id = $2 WHERE id = $1', [mediaRequestId, fixture.users[1].id]);
          return playlistPage(['album1']);
        },
      } });
      await assert.rejects(intake.service.executeCollection({ mediaRequestId, operationRunId: started.run.id, triggeredByUserId: context.adminId }), { code: 'operation_run_cancelled' });
      const leaves = await context.pool.query('SELECT id FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId]);
      assert.deepEqual(leaves.rows, []);
      const work = await context.pool.query('SELECT status, evidence FROM provider_ingest_requests WHERE media_request_id = $1', [mediaRequestId]);
      assert.equal(work.rows.length, 1);
      assert.equal(work.rows[0].status, 'planned');
      assert.equal('response' in work.rows[0].evidence, false);
    }));
  }

  test('rejects a changing Spotify snapshot without committing the fetched page', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    const started = await startCollection(context, mediaRequestId);
    let snapshot = 0;
    const intake = createIntake({ spotifyOverrides: {
      async getPlaylistSnapshot(id) { return { id, snapshot_id: `revision${++snapshot}` }; },
    } });
    const result = await intake.service.executeCollection({ mediaRequestId, operationRunId: started.run.id, triggeredByUserId: context.adminId });
    assert.equal(result.failedCount, 1);
    const state = await context.pool.query('SELECT status, pages_completed, items_seen FROM library_external_request_collections WHERE media_request_id = $1', [mediaRequestId]);
    assert.deepEqual(state.rows, [{ status: 'blocked', pages_completed: 0, items_seen: 0 }]);
    assert.equal((await context.pool.query('SELECT id FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId])).rowCount, 0);
  }));

  test('prepares Apple Music relationship pages and album evidence through fixed provider methods', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { url: 'https://music.apple.com/us/playlist/pl.collection123' });
    const mediaRequestId = fixture.requests[0].id;
    const calls = [];
    const intake = { service: createLibraryExternalRequestCollectionIntakeService({ resolveProviderClients: () => ({
      appleMusic: {
        async getCatalogPlaylistTracks(storefront, id, { offset }) {
          calls.push(['tracks', storefront, id, offset]);
          return { data: [{ id: 'song1', type: 'songs', attributes: { name: 'One Song' }, relationships: { albums: { data: [{ id: 'album1', type: 'albums' }] } } }] };
        },
        async getCatalogAlbum(storefront, id) {
          calls.push(['album', storefront, id]);
          return { data: [{ id, type: 'albums', attributes: { name: 'One Album', artistName: 'Collection Artist', trackCount: 1 } }] };
        },
      },
    }) }) };
    await prepareCollection(context, mediaRequestId, intake);
    assert.deepEqual(calls, [['tracks', 'us', 'pl.collection123', 0], ['album', 'us', 'album1']]);
    const review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.status, 'ready');
    assert.equal(review.items.length, 1);
    assert.equal(review.items[0].reviewable, true);
    assert.equal(review.items[0].artistName, 'Collection Artist');
  }));

  test('keeps YouTube entries explicitly unsupported while completing token-based enumeration', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { url: 'https://www.youtube.com/playlist?list=PLcollection123' });
    const mediaRequestId = fixture.requests[0].id;
    const tokens = [];
    const intake = { service: createLibraryExternalRequestCollectionIntakeService({ resolveProviderClients: () => ({
      youtube: {
        async listPlaylistItems(id, { pageToken }) {
          assert.equal(id, 'PLcollection123');
          tokens.push(pageToken);
          return {
            items: [{ id: pageToken === null ? 'membership1' : 'membership2', snippet: { title: 'A Video', resourceId: { kind: 'youtube#video', videoId: 'video123' } } }],
            ...(pageToken === null ? { nextPageToken: 'continuation1' } : {}),
          };
        },
      },
    }) }) };
    await prepareCollection(context, mediaRequestId, intake);
    assert.deepEqual(tokens, [null, 'continuation1']);
    const review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.pagesCompleted, 2);
    assert.equal(review.collection.leafCount, 2, 'each playlist membership requires its own explicit exclusion');
    assert.equal(review.collection.canFinalize, false);
    assert.equal(review.items[0].itemKind, 'unsupported');
    assert.equal(review.items[0].decision, 'pending');
    assert.equal(review.items[0].reviewable, false);
    const memberships = await context.pool.query('SELECT item_key, source_identifier FROM library_external_request_collection_items WHERE media_request_id = $1 ORDER BY item_key', [mediaRequestId]);
    assert.deepEqual(memberships.rows, [
      { item_key: 'youtube:membership:membership1', source_identifier: 'video123' },
      { item_key: 'youtube:membership:membership2', source_identifier: 'video123' },
    ]);
    assert.equal((await context.pool.query("SELECT id FROM provider_ingest_requests WHERE media_request_id = $1 AND ingest_target_type = 'video'", [mediaRequestId])).rowCount, 0);
  }));

  test('fails closed at the page and leaf bounds without accepting a partial overflowing page', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { count: 2 });
    const firstId = fixture.requests[0].id;
    const first = await startCollection(context, firstId);
    await context.pool.query('UPDATE library_external_request_collections SET pages_completed = 50 WHERE media_request_id = $1', [firstId]);
    const firstIntake = createIntake();
    const pageBound = await firstIntake.service.executeCollection({ mediaRequestId: firstId, operationRunId: first.run.id, triggeredByUserId: context.adminId });
    assert.equal(pageBound.failedCount, 1);
    assert.equal(firstIntake.calls.length, 0, 'exhausted page budget blocks before provider access');
    const secondId = fixture.requests[1].id;
    const second = await startCollection(context, secondId);
    await context.pool.query(`
      INSERT INTO library_external_request_collection_items
        (media_request_id, item_key, source_provider, source_identifier, item_kind)
      SELECT $1, 'existing:' || item, 'spotify', 'existing' || item, 'unsupported'
      FROM generate_series(1, 999) item
    `, [secondId]);
    await context.pool.query('UPDATE library_external_request_collections SET items_seen = 999 WHERE media_request_id = $1', [secondId]);
    const secondIntake = createIntake({ pages: [playlistPage(['album1', 'album2'])] });
    const itemBound = await secondIntake.service.executeCollection({ mediaRequestId: secondId, operationRunId: second.run.id, triggeredByUserId: context.adminId });
    assert.equal(itemBound.failedCount, 1);
    assert.equal((await context.pool.query('SELECT id FROM library_external_request_collection_items WHERE media_request_id = $1', [secondId])).rowCount, 999);
    const state = await context.pool.query('SELECT status, pages_completed, items_seen FROM library_external_request_collections WHERE media_request_id = $1', [secondId]);
    assert.deepEqual(state.rows, [{ status: 'blocked', pages_completed: 0, items_seen: 999 }]);
    assert.equal((await context.pool.query('SELECT id FROM provider_ingest_requests WHERE media_request_id = $1', [secondId])).rowCount, 1);
  }));

  test('requires all paginated leaf decisions before finalizing the reviewed selection and coalesces provider albums into one release intent', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    await prepareCollection(context, mediaRequestId, createIntake({ pages: [playlistPage(['album1', 'album2', 'album3'])] }));
    const metadata = await seedMetadataReleaseFixture({ queryable: context.pool, artistName: 'Collection Artist', releaseTitle: 'Reviewed Album' });
    let review = await getReview(context, mediaRequestId, '?limit=1');
    assert.equal(review.collection.status, 'ready');
    assert.equal(review.items.length, 1);
    assert.equal(review.pagination.hasMore, true);
    assert.equal(review.collection.leafCount, 3);
    assert.equal(review.collection.pendingCount, 3);
    assert.equal(review.collection.canFinalize, false);
    const firstItem = review.items[0];
    const initialRevision = review.collection.revision;
    const included = await postReview(context, mediaRequestId, '/approve', {
      providerIngestRequestId: firstItem.id, metadataReleaseId: metadata.metadataReleaseId, expectedRevision: initialRevision,
    });
    assert.equal(included.response.status, 202, JSON.stringify(included.payload));
    const intentId = included.payload.intent.id;
    await persistAppliedCandidate(context, {
      mediaRequestId, requestedForUserId: fixture.users[0].id, intentId, metadataReleaseId: metadata.metadataReleaseId,
    });
    const premature = await context.client.requestJson(`${requestPath}/${mediaRequestId}`);
    assert.equal(premature.payload.mediaRequest.fulfillmentStatus.code, 'under_review');
    const stale = await postReview(context, mediaRequestId, '/collection/finalize', { expectedRevision: initialRevision });
    assert.equal(stale.response.status, 409);
    review = await getReview(context, mediaRequestId, '?limit=1');
    const incomplete = await postReview(context, mediaRequestId, '/collection/finalize', { expectedRevision: review.collection.revision });
    assert.equal(incomplete.response.status, 409, 'one visible decided item must not hide undecided later pages');
    const secondPage = await getReview(context, mediaRequestId, `?limit=1&cursor=${encodeURIComponent(review.pagination.nextCursor)}`);
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(secondPage.items[0].collectionItemId, firstItem.collectionItemId);
    const reused = await postReview(context, mediaRequestId, '/approve', {
      providerIngestRequestId: secondPage.items[0].id, metadataReleaseId: metadata.metadataReleaseId,
      expectedRevision: secondPage.collection.revision,
    });
    assert.equal(reused.response.status, 202, JSON.stringify(reused.payload));
    assert.equal(reused.payload.intent.id, intentId);
    const lastPage = await getReview(context, mediaRequestId, `?limit=1&cursor=${encodeURIComponent(secondPage.pagination.nextCursor)}`);
    assert.equal(lastPage.pagination.hasMore, false);
    const excludePath = `/collection/items/${lastPage.items[0].collectionItemId}/exclude`;
    const noReason = await postReview(context, mediaRequestId, excludePath, { reason: ' ', expectedRevision: lastPage.collection.revision });
    assert.equal(noReason.response.status, 400);
    await assert.rejects(context.pool.query(`
      UPDATE library_external_request_collection_items SET decision = 'excluded', decided_at = NOW(), exclusion_reason = NULL
      WHERE id = $1
    `, [lastPage.items[0].collectionItemId]), { code: '23514', constraint: 'external_collection_item_decision_consistent' });
    const excluded = await postReview(context, mediaRequestId, excludePath, {
      reason: 'This alternate album is outside the reviewed selection.', expectedRevision: lastPage.collection.revision,
    });
    assert.equal(excluded.response.status, 200, JSON.stringify(excluded.payload));
    review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.includedCount, 2);
    assert.equal(review.collection.excludedCount, 1);
    assert.equal(review.collection.pendingCount, 0);
    assert.equal(review.collection.canFinalize, true);
    const finalized = await postReview(context, mediaRequestId, '/collection/finalize', { expectedRevision: review.collection.revision });
    assert.equal(finalized.response.status, 200, JSON.stringify(finalized.payload));
    const ledger = await context.pool.query('SELECT decision, release_intent_id FROM library_external_request_collection_items WHERE media_request_id = $1', [mediaRequestId]);
    assert.equal(ledger.rows.filter((row) => row.decision === 'included').length, 2);
    assert.equal(new Set(ledger.rows.filter((row) => row.decision === 'included').map((row) => row.release_intent_id)).size, 1);
    const intents = await context.pool.query('SELECT id FROM library_external_request_release_intents WHERE media_request_id = $1', [mediaRequestId]);
    assert.deepEqual(intents.rows, [{ id: intentId }]);
    const completed = await context.client.requestJson(`${requestPath}/${mediaRequestId}`);
    assert.equal(completed.payload.mediaRequest.fulfillmentStatus.code, 'fulfilled');
    assert.match(`${completed.payload.mediaRequest.fulfillmentStatus.label} ${completed.payload.mediaRequest.fulfillmentStatus.detail}`, /reviewed selection/i);
  }));

  test('keeps completion scoped to every included release and ignores imports owned by another target', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { count: 2 });
    const mediaRequestId = fixture.requests[0].id;
    await prepareCollection(context, mediaRequestId, createIntake({ pages: [playlistPage(['album1', 'album2'])] }));
    const approvals = [];
    for (const [index, title] of ['First Album', 'Second Album'].entries()) {
      const metadata = await seedMetadataReleaseFixture({ queryable: context.pool, releaseTitle: title });
      const review = await getReview(context, mediaRequestId);
      const included = await postReview(context, mediaRequestId, '/approve', {
        providerIngestRequestId: review.items[index].id, metadataReleaseId: metadata.metadataReleaseId,
        expectedRevision: review.collection.revision,
      });
      assert.equal(included.response.status, 202, JSON.stringify(included.payload));
      approvals.push({ intentId: included.payload.intent.id, metadataReleaseId: metadata.metadataReleaseId });
    }
    const review = await getReview(context, mediaRequestId);
    const finalized = await postReview(context, mediaRequestId, '/collection/finalize', { expectedRevision: review.collection.revision });
    assert.equal(finalized.response.status, 200);
    await persistAppliedCandidate(context, { ...approvals[0], mediaRequestId, requestedForUserId: fixture.users[0].id });
    await persistAppliedCandidate(context, { ...approvals[1], mediaRequestId, requestedForUserId: fixture.users[1].id });
    const partial = await context.client.requestJson(`${requestPath}/${mediaRequestId}`);
    assert.equal(partial.payload.mediaRequest.fulfillmentStatus.code, 'under_review');
    await persistAppliedCandidate(context, { ...approvals[1], mediaRequestId, requestedForUserId: fixture.users[0].id });
    const completed = await context.client.requestJson(`${requestPath}/${mediaRequestId}`);
    assert.equal(completed.payload.mediaRequest.fulfillmentStatus.code, 'fulfilled');
    const cancelled = await context.client.requestJson(`${requestPath}/${mediaRequestId}/cancel`, {
      csrf: true, json: { reason: 'Collection is no longer wanted' }, method: 'POST',
    });
    assert.equal(cancelled.response.status, 200);
    const detail = await context.client.requestJson(`${requestPath}/${mediaRequestId}`);
    assert.equal(detail.payload.mediaRequest.fulfillmentStatus.code, 'cancelled');
  }));

  test('refuses finalization of a collection with no included release even after every item is excluded', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    await prepareCollection(context, mediaRequestId);
    let review = await getReview(context, mediaRequestId);
    const excluded = await postReview(context, mediaRequestId, `/collection/items/${review.items[0].collectionItemId}/exclude`, {
      reason: 'No release in this collection is wanted.', expectedRevision: review.collection.revision,
    });
    assert.equal(excluded.response.status, 200);
    review = await getReview(context, mediaRequestId);
    assert.equal(review.collection.pendingCount, 0);
    assert.equal(review.collection.includedCount, 0);
    assert.equal(review.collection.canFinalize, false);
    const finalized = await postReview(context, mediaRequestId, '/collection/finalize', { expectedRevision: review.collection.revision });
    assert.equal(finalized.response.status, 409);
  }));

  test('rolls back a tracked inclusion, revision, and discovery intent when its queue insert fails', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    await prepareCollection(context, mediaRequestId);
    const review = await getReview(context, mediaRequestId);
    const metadata = await seedMetadataReleaseFixture({ queryable: context.pool });
    await context.pool.query(`
      CREATE FUNCTION integration_reject_collection_discovery() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.operation_type = 'library_external_request_discovery' THEN
          RAISE EXCEPTION 'integration collection discovery queue failure';
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER integration_reject_collection_discovery BEFORE INSERT ON operation_runs
        FOR EACH ROW EXECUTE FUNCTION integration_reject_collection_discovery();
    `);
    const input = {
      providerIngestRequestId: review.items[0].id, metadataReleaseId: metadata.metadataReleaseId,
      expectedRevision: review.collection.revision,
    };
    try {
      const failed = await postReview(context, mediaRequestId, '/approve', input);
      assert.equal(failed.response.status, 500);
      assert.equal(JSON.stringify(failed.payload).includes('integration collection discovery queue failure'), false);
      const unchanged = await getReview(context, mediaRequestId);
      assert.equal(unchanged.collection.revision, review.collection.revision);
      assert.equal(unchanged.items[0].decision, 'pending');
      assert.equal((await context.pool.query('SELECT id FROM library_external_request_release_intents WHERE media_request_id = $1', [mediaRequestId])).rowCount, 0);
    } finally {
      await context.pool.query('DROP TRIGGER integration_reject_collection_discovery ON operation_runs');
      await context.pool.query('DROP FUNCTION integration_reject_collection_discovery()');
    }
    const retried = await postReview(context, mediaRequestId, '/approve', input);
    assert.equal(retried.response.status, 202);
    const committed = await getReview(context, mediaRequestId);
    assert.equal(committed.collection.includedCount, 1);
    assert.equal(committed.items[0].decision, 'included');
    assert.ok(committed.collection.revision > review.collection.revision);
  }));

  test('rolls back an exclusion and its revision when the required audit event cannot be recorded', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context);
    const mediaRequestId = fixture.requests[0].id;
    await prepareCollection(context, mediaRequestId);
    const review = await getReview(context, mediaRequestId);
    const suffix = `/collection/items/${review.items[0].collectionItemId}/exclude`;
    const input = { reason: 'The album is outside the reviewed selection.', expectedRevision: review.collection.revision };
    await context.pool.query(`
      CREATE FUNCTION integration_reject_collection_decision_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type = 'external_collection_item_excluded' THEN
          RAISE EXCEPTION 'integration collection decision audit failure';
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER integration_reject_collection_decision_audit BEFORE INSERT ON audit_events
        FOR EACH ROW EXECUTE FUNCTION integration_reject_collection_decision_audit();
    `);
    try {
      const failed = await postReview(context, mediaRequestId, suffix, input);
      assert.equal(failed.response.status, 500);
      assert.equal(JSON.stringify(failed.payload).includes('integration collection decision audit failure'), false);
      const unchanged = await getReview(context, mediaRequestId);
      assert.equal(unchanged.collection.revision, review.collection.revision);
      assert.equal(unchanged.collection.excludedCount, 0);
      assert.equal(unchanged.items[0].decision, 'pending');
      assert.equal(unchanged.items[0].exclusionReason, null);
      const audits = await context.pool.query("SELECT id FROM audit_events WHERE event_type = 'external_collection_item_excluded' AND entity_id = $1", [mediaRequestId]);
      assert.deepEqual(audits.rows, []);
    } finally {
      await context.pool.query('DROP TRIGGER integration_reject_collection_decision_audit ON audit_events');
      await context.pool.query('DROP FUNCTION integration_reject_collection_decision_audit()');
    }
    const retried = await postReview(context, mediaRequestId, suffix, input);
    assert.equal(retried.response.status, 200);
    assert.equal(retried.payload.collection.excludedCount, 1);
    assert.ok(retried.payload.collection.revision > review.collection.revision);
  }));

  test('enforces administrator, CSRF, fresh-session, request ownership, and current collection target boundaries', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await createFamily(context, { count: 2 });
    for (const request of fixture.requests) await prepareCollection(context, request.id);
    const firstId = fixture.requests[0].id;
    const firstReview = await getReview(context, firstId);
    const secondReview = await getReview(context, fixture.requests[1].id);
    const suffixes = [
      ['/collection/start', { restart: false }],
      [`/collection/items/${firstReview.items[0].collectionItemId}/exclude`, { reason: 'Explicit review exclusion', expectedRevision: firstReview.collection.revision }],
      ['/collection/finalize', { expectedRevision: firstReview.collection.revision }],
    ];
    const requester = createSessionHttpClient(context.baseUrl);
    const login = await loginWithPassword(requester, { password, username: fixture.users[0].username });
    assert.equal(login.response.status, 200);
    const ownReview = await requester.requestJson(reviewPath(firstId));
    assert.equal(ownReview.response.status, 403);
    const sibling = await requester.requestJson(`${requestPath}/${fixture.requests[1].id}`);
    assert.equal(sibling.response.status, 404);
    const anonymous = createSessionHttpClient(context.baseUrl);
    for (const [suffix, json] of suffixes) {
      assert.equal((await anonymous.requestJson(`${reviewPath(firstId)}${suffix}`, { json, method: 'POST' })).response.status, 401);
      assert.equal((await requester.requestJson(`${reviewPath(firstId)}${suffix}`, { csrf: true, json, method: 'POST' })).response.status, 403);
    }
    const configured = await context.client.requestJson('/api/v1/settings', {
      csrf: true, json: { security: { csrfProtectionMode: 'required' } }, method: 'PUT',
    });
    assert.equal(configured.response.status, 200);
    for (const [suffix, json] of suffixes) {
      const response = await context.client.requestJson(`${reviewPath(firstId)}${suffix}`, { csrf: false, json, method: 'POST' });
      assert.equal(response.response.status, 403);
      assert.equal(response.payload.error.code, 'csrf_required');
    }
    await context.pool.query('UPDATE app_users SET must_change_password = TRUE WHERE id = $1', [context.adminId]);
    for (const [suffix, json] of suffixes) {
      const response = await postReview(context, firstId, suffix, json);
      assert.equal(response.response.status, 403);
      assert.equal(response.payload.error.code, 'reauth_required');
    }
    await context.pool.query('UPDATE app_users SET must_change_password = FALSE WHERE id = $1', [context.adminId]);
    const siblingItem = await postReview(context, firstId, `/collection/items/${secondReview.items[0].collectionItemId}/exclude`, {
      reason: 'Wrong request leaf', expectedRevision: firstReview.collection.revision,
    });
    assert.equal(siblingItem.response.status, 404);
    const invalidItem = await postReview(context, firstId, `/collection/items/${randomUUID()}/exclude`, {
      reason: 'Unknown leaf', expectedRevision: firstReview.collection.revision,
    });
    assert.equal(invalidItem.response.status, 404);
    await context.pool.query('UPDATE media_requests SET requested_for_user_id = $2 WHERE id = $1', [firstId, fixture.users[1].id]);
    const staleTarget = await postReview(context, firstId, suffixes[1][0], suffixes[1][1]);
    assert.equal(staleTarget.response.status, 409);
    assert.equal(staleTarget.payload.error.code, 'external_collection_target_changed');
    const ledger = await context.pool.query('SELECT decision FROM library_external_request_collection_items WHERE media_request_id = $1', [firstId]);
    assert.ok(ledger.rows.every((row) => row.decision === 'pending'));
  }));
});
