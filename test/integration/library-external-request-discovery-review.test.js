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
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { findNextCandidateForRecovery } from '../../src/server/import-candidates/import-candidate-repository.js';
import { createLibraryExternalRequestDiscoveryModule } from '../../src/server/library/library-external-request-discovery-module.js';
import { createLibraryExternalRequestReviewService } from '../../src/server/library/library-external-request-review-service.js';
import { createLibraryExternalRequestReviewStore } from '../../src/server/library/library-external-request-review-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryProviderIngestRequestStore } from '../../src/server/library/library-provider-ingest-request-store.js';
import { createOperationQueueDispatcher } from '../../src/server/operation-queue-dispatcher.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import {
  countPrunableOperationRuns,
  createOperationRunStore,
  pruneOperationRunsLedger,
} from '../../src/server/operation-run-store.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { seedOperationRunFixture } from '../../testing/integration/operation-run-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const password = 'DiscoveryReviewPass123!';
const requestPath = '/api/v1/library/media-requests';
const discoveryType = 'library_external_request_discovery';
const planningType = 'library_external_intake_planning';
const executionType = 'library_external_intake_execution';
const fetchedAt = '2026-09-10T12:00:00.000Z';
let runtime;
let unavailableReason = null;

async function createFamily(client, pool, count = 1) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const created = await client.requestJson('/api/v1/users', {
      csrf: true,
      json: { password, role: 'requester', username: `discovery-listener-${index + 1}` },
      method: 'POST',
    });
    assert.equal(created.response.status, 201);
    users.push(created.payload.user);
  }
  const created = await client.requestJson(requestPath, {
    csrf: true,
    json: {
      requestKind: 'external_url',
      requestedForUserIds: users.map((user) => user.id),
      sourceUrl: 'https://open.spotify.com/playlist/12345',
    },
    method: 'POST',
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  const requests = await pool.query('SELECT id, requested_for_user_id FROM media_requests');
  await pool.query("UPDATE operation_runs SET status = 'completed', finished_at = NOW() WHERE operation_type = $1", [planningType]);
  return {
    requests: users.map((user) => requests.rows.find((row) => row.requested_for_user_id === user.id)),
    users,
  };
}

async function seedProviderItem(mediaRequestId, overrides = {}) {
  const store = createLibraryProviderIngestRequestStore();
  const [item] = await store.insertProviderIngestRequests({
    providerIngestRequests: [{
      canonicalUrl: 'https://open.spotify.com/album/sharedalbum',
      evidence: {
        fetchedAt,
        response: {
          artists: [{ id: 'provider-artist', name: 'Autechre' }],
          id: 'sharedalbum',
          name: 'Amber',
          release_date: '1994-11-07',
          total_tracks: 1,
          providerPrivateToken: 'private-provider-field-must-not-be-copied',
        },
      },
      ingestTargetType: 'release',
      mediaRequestId,
      sourceIdentifier: 'sharedalbum',
      sourceProvider: 'spotify',
      sourceResourceType: 'release',
      status: 'completed',
      ...overrides,
    }],
  });
  return item;
}

async function seedApproval(context, { recipientCount = 1 } = {}) {
  const family = await createFamily(context.client, context.pool, recipientCount);
  const metadata = await seedMetadataReleaseFixture({ queryable: context.pool });
  const items = [];
  for (const request of family.requests) items.push(await seedProviderItem(request.id));
  return { ...family, items, metadata };
}

function approvalInput(context, fixture, index = 0) {
  return {
    actorUserId: context.adminId,
    mediaRequestId: fixture.requests[index].id,
    metadataReleaseId: fixture.metadata.metadataReleaseId,
    providerIngestRequestId: fixture.items[index].id,
  };
}

async function readIntents(pool) {
  const result = await pool.query('SELECT * FROM library_external_request_release_intents ORDER BY id');
  return result.rows;
}

async function readRuns(pool, type = discoveryType) {
  const result = await pool.query('SELECT id, status, triggered_by_user_id, summary FROM operation_runs WHERE operation_type = $1 ORDER BY id', [type]);
  return result.rows;
}

function createDiscoveryHarness(context, { waitForResponses = async () => {} } = {}) {
  const searches = [];
  const slskdService = {
    async startSearch({ query }) {
      const id = randomUUID();
      searches.push({ id, query });
      return { id };
    },
    async getSearchResponses({ searchId }) {
      await waitForResponses();
      return {
        searchId,
        responses: [{
          username: 'shared-provider-peer',
          hasFreeUploadSlot: true,
          queueLength: 0,
          uploadSpeed: 2048,
          files: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 42000000, length: 322, bitDepth: 16, sampleRate: 44100 }],
        }],
      };
    },
  };
  const module = createLibraryExternalRequestDiscoveryModule({
    getAppUserById: createAppUserService().getAppUserById,
    getPoolFn: context.getPoolFn,
    getReleaseTracklistExpectationsFn: async () => ({ expectedTrackCount: 1, expectedTrackTitles: ['Foil'] }),
    importCandidateService: createImportCandidateService({ pool: context.pool, slskdService }),
    mediaRequestStore: createLibraryMediaRequestStore(),
    reviewStore: createLibraryExternalRequestReviewStore(),
    slskdService,
  });
  const dispatchErrors = [];
  const dispatcher = createOperationQueueDispatcher({
    handlers: createOperationQueueHandlers({ libraryModule: module }),
    onError: async (error) => { dispatchErrors.push(error); },
  });
  return { dispatchErrors, dispatcher, module, searches };
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

suite('integration external request discovery review', () => {
  before(async () => {
    try {
      runtime = await createIntegrationAppRuntime({ config });
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('serializes concurrent approval into one durable intent and one target-owned discovery run', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context);
    const service = createLibraryExternalRequestReviewService();
    const input = approvalInput(context, fixture);
    const approvals = await Promise.all([service.approveRelease(input), service.approveRelease(input)]);
    assert.ok(approvals.every((result) => result.accepted));
    assert.deepEqual(approvals.map((result) => result.reusedExistingIntent).sort(), [false, true]);
    assert.equal(approvals[0].intent.id, approvals[1].intent.id);
    assert.equal(approvals[0].run.id, approvals[1].run.id);
    const intents = await readIntents(context.pool);
    const runs = await readRuns(context.pool);
    assert.equal(intents.length, 1);
    assert.equal(runs.length, 1);
    assert.equal(intents[0].media_request_id, input.mediaRequestId);
    assert.equal(intents[0].metadata_release_id, input.metadataReleaseId);
    assert.equal(intents[0].requested_for_user_id, fixture.users[0].id);
    assert.equal(intents[0].approved_by_user_id, context.adminId);
    assert.equal(intents[0].operation_run_id, runs[0].id);
    assert.equal(runs[0].status, 'pending');
    assert.equal(runs[0].triggered_by_user_id, context.adminId);
    assert.equal(runs[0].summary.mediaRequestId, input.mediaRequestId);
    const request = await context.pool.query('SELECT request_state, matched_metadata_release_id FROM media_requests WHERE id = $1', [input.mediaRequestId]);
    assert.equal(request.rows[0].request_state, 'needs_fetch');
    assert.equal(request.rows[0].matched_metadata_release_id, null, 'approval must not enter release-global discovery');
  }));

  test('rejects contradictory mappings and keeps separate recipients when a release is already available globally', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    await context.pool.query(`
      INSERT INTO library_release_reconciliations (
        metadata_artist_id, metadata_release_group_id, metadata_release_id,
        reconciliation_status, expected_track_count, matched_track_count,
        missing_track_count, matched_file_count, duplicate_track_count, evidence
      ) VALUES ($1, $2, $3, 'complete', 1, 1, 0, 1, 0, '{}'::jsonb)
    `, [fixture.metadata.metadataArtistId, fixture.metadata.metadataReleaseGroupId, fixture.metadata.metadataReleaseId]);
    const alternate = await seedMetadataReleaseFixture({ queryable: context.pool, releaseTitle: 'Different Edition' });
    const service = createLibraryExternalRequestReviewService();
    await service.approveRelease(approvalInput(context, fixture, 0));
    await assert.rejects(service.approveRelease({
      ...approvalInput(context, fixture, 0),
      metadataReleaseId: alternate.metadataReleaseId,
    }), { status: 409, code: 'external_request_review_conflict' });
    await service.approveRelease(approvalInput(context, fixture, 1));
    const intents = await readIntents(context.pool);
    assert.equal(intents.length, 2);
    assert.equal((await readRuns(context.pool)).length, 2);
    assert.deepEqual(new Set(intents.map((intent) => intent.requested_for_user_id)), new Set(fixture.users.map((user) => user.id)));
    assert.ok(intents.every((intent) => intent.metadata_release_id === fixture.metadata.metadataReleaseId));
    assert.equal(new Set(intents.map((intent) => intent.operation_run_id)).size, 2);
  }));

  test('dispatches approved jobs into distinct persisted candidates and keeps requester visibility scoped to each target', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    const { dispatchErrors, dispatcher, searches } = createDiscoveryHarness(context);
    const service = createLibraryExternalRequestReviewService();
    const approvals = [];
    for (let index = 0; index < fixture.requests.length; index += 1) {
      approvals.push(await service.approveRelease(approvalInput(context, fixture, index)));
    }
    for (const approval of approvals) {
      const dispatched = await dispatcher.tick();
      assert.equal(dispatched.claimedCount, 1);
      const deadline = Date.now() + 15_000;
      let run;
      do {
        [run] = (await context.pool.query('SELECT status, summary FROM operation_runs WHERE id = $1', [approval.run.id])).rows;
        if (!['pending', 'running'].includes(run.status)) break;
        await new Promise((resolve) => { setTimeout(resolve, 20); });
      } while (Date.now() < deadline);
      assert.equal(run.status, 'completed', JSON.stringify(run));
      assert.equal(run.summary.candidateCount, 1);
    }
    assert.deepEqual(dispatchErrors, []);
    assert.equal(searches.length, 2);
    assert.equal(new Set(searches.map((search) => search.id)).size, 2);
    assert.equal(searches[0].query, searches[1].query);
    const candidates = await context.pool.query('SELECT id, status, source_search_id, source_response_key, normalized_payload FROM import_candidates ORDER BY created_at');
    assert.equal(candidates.rows.length, 2);
    assert.equal(new Set(candidates.rows.map((row) => row.source_response_key)).size, 1, 'identical peer folders must remain distinct across target searches');
    assert.equal(new Set(candidates.rows.map((row) => row.source_search_id)).size, 2);
    assert.equal(await findNextCandidateForRecovery({
      excludeCandidateId: randomUUID(),
      maxDownloadAttemptCount: 3,
      metadataReleaseId: fixture.metadata.metadataReleaseId,
    }, context.pool), null, 'automatic recovery must not select candidates still awaiting external request import review');
    for (let index = 0; index < fixture.requests.length; index += 1) {
      const candidate = candidates.rows.find((row) => row.normalized_payload.requestOwnership.sourceMediaRequestId === fixture.requests[index].id);
      assert.ok(candidate);
      assert.equal(candidate.status, 'pending', 'discovery never bypasses import review');
      const ownership = candidate.normalized_payload.requestOwnership;
      assert.equal(ownership.externalRequestReleaseIntentId, approvals[index].intent.id);
      assert.equal(ownership.sourceRequestedForUserId, fixture.users[index].id);
      assert.equal(ownership.sourceRequestedByUserId, context.adminId);
      assert.equal(ownership.metadataReleaseId, fixture.metadata.metadataReleaseId);
      const requester = createSessionHttpClient(context.baseUrl);
      const login = await loginWithPassword(requester, { password, username: fixture.users[index].username });
      assert.equal(login.response.status, 200);
      const pipeline = await requester.requestJson(`${requestPath}/${fixture.requests[index].id}/pipeline`);
      assert.equal(pipeline.response.status, 200);
      assert.equal(pipeline.payload.candidates.length, 1);
      assert.equal(pipeline.payload.candidates[0].status, 'pending');
      const own = await requester.requestJson(`/api/v1/import-candidates/${candidate.id}`);
      assert.equal(own.response.status, 200);
      const siblingCandidate = candidates.rows.find((row) => row.id !== candidate.id);
      const sibling = await requester.requestJson(`/api/v1/import-candidates/${siblingCandidate.id}`);
      assert.equal(sibling.response.status, 404);
    }
  }));

  test('persists concurrent target discovery with cancellation checks using the existing transaction clients', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    const service = createLibraryExternalRequestReviewService();
    const approvals = await Promise.all(fixture.requests.map((_, index) => service.approveRelease(approvalInput(context, fixture, index))));
    let responsesReady = 0;
    let releaseResponses;
    const responsesBarrier = new Promise((resolve) => { releaseResponses = resolve; });
    const { module } = createDiscoveryHarness(context, {
      async waitForResponses() {
        responsesReady += 1;
        if (responsesReady === 2) releaseResponses();
        await responsesBarrier;
      },
    });
    const discoveries = await Promise.all(approvals.map((approval, index) => module.externalRequestDiscoveryService.discoverExternalRequestRelease({
      intentId: approval.intent.id,
      mediaRequestId: fixture.requests[index].id,
      operationRunId: approval.run.id,
      triggeredByUserId: context.adminId,
    })));
    assert.deepEqual(discoveries.map((result) => result.candidateCount), [1, 1]);
    const candidates = await context.pool.query("SELECT normalized_payload #>> '{requestOwnership,sourceRequestedForUserId}' AS target_id FROM import_candidates");
    assert.equal(candidates.rows.length, 2);
    assert.deepEqual(new Set(candidates.rows.map((row) => row.target_id)), new Set(fixture.users.map((user) => user.id)));
  }));

  test('requires a completed release item belonging to this request and a real local release identifier', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    const service = createLibraryExternalRequestReviewService();
    const input = approvalInput(context, fixture);
    await assert.rejects(service.approveRelease({ ...input, providerIngestRequestId: fixture.items[1].id }), {
      status: 404, code: 'provider_ingest_request_not_found',
    });
    await assert.rejects(service.approveRelease({ ...input, metadataReleaseId: fixture.metadata.metadataReleaseGroupId }), {
      status: 404, code: 'metadata_release_not_found',
    });
    await assert.rejects(service.approveRelease({ ...input, metadataReleaseId: 'not-a-uuid' }), {
      status: 400, code: 'validation_error',
    });
    await context.pool.query("UPDATE provider_ingest_requests SET status = 'planned' WHERE id = $1", [input.providerIngestRequestId]);
    await assert.rejects(service.approveRelease(input), { status: 409, code: 'external_request_item_not_reviewable' });
    await context.pool.query("UPDATE provider_ingest_requests SET status = 'completed', ingest_target_type = 'playlist_page' WHERE id = $1", [input.providerIngestRequestId]);
    await assert.rejects(service.approveRelease(input), { status: 409, code: 'external_request_item_not_reviewable' });
    assert.deepEqual(await readIntents(context.pool), []);
    assert.deepEqual(await readRuns(context.pool), []);
  }));

  for (const failureTarget of ['queue', 'audit']) {
    test(`rolls back approval and permits a clean retry when the ${failureTarget} insert fails`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => runScenario(t, async (context) => {
      const fixture = await seedApproval(context);
      const service = createLibraryExternalRequestReviewService();
      const input = approvalInput(context, fixture);
      const table = failureTarget === 'queue' ? 'operation_runs' : 'audit_events';
      const condition = failureTarget === 'queue' ? `NEW.operation_type = '${discoveryType}'` : 'TRUE';
      await context.pool.query(`
        CREATE FUNCTION integration_reject_external_approval() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF ${condition} THEN RAISE EXCEPTION 'integration approval persistence failure'; END IF;
          RETURN NEW;
        END
        $$;
        CREATE TRIGGER integration_reject_external_approval BEFORE INSERT ON ${table}
          FOR EACH ROW EXECUTE FUNCTION integration_reject_external_approval();
      `);
      try {
        await assert.rejects(service.approveRelease(input));
        const failed = await context.client.requestJson(`${requestPath}/${input.mediaRequestId}/external-review/approve`, {
          csrf: true, json: input, method: 'POST',
        });
        assert.equal(failed.response.status, 500);
        assert.equal(failed.payload.error.code, 'external_request_review_failed');
        assert.equal(JSON.stringify(failed.payload).includes('integration approval persistence failure'), false);
        assert.deepEqual(await readIntents(context.pool), []);
        assert.deepEqual(await readRuns(context.pool), []);
        const approvals = await context.pool.query("SELECT id FROM audit_events WHERE event_type = 'external_request_release_approved' AND entity_id = $1", [input.mediaRequestId]);
        assert.deepEqual(approvals.rows, []);
      } finally {
        await context.pool.query(`DROP TRIGGER integration_reject_external_approval ON ${table}`);
        await context.pool.query('DROP FUNCTION integration_reject_external_approval()');
      }
      const retried = await service.approveRelease(input);
      assert.equal(retried.accepted, true);
      assert.equal(retried.reusedExistingIntent, false);
      assert.equal((await readIntents(context.pool)).length, 1);
      assert.equal((await readRuns(context.pool)).length, 1);
    }));
  }

  test('retains safe approval provenance after provider rows are replaced and rejects replay after reassignment', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    const service = createLibraryExternalRequestReviewService();
    const input = approvalInput(context, fixture);
    const approval = await service.approveRelease(input);
    const [stored] = await readIntents(context.pool);
    assert.equal(stored.provider_evidence.title, 'Amber');
    assert.equal(stored.provider_evidence.artistName, 'Autechre');
    assert.equal(stored.provider_evidence.sourceProvider, 'spotify');
    assert.equal(stored.provider_evidence.sourceIdentifier, 'sharedalbum');
    assert.equal(stored.provider_evidence.fetchedAt, fetchedAt);
    assert.equal(JSON.stringify(stored.provider_evidence).includes('private-provider-field'), false);
    await context.pool.query('DELETE FROM provider_ingest_requests WHERE media_request_id = $1', [input.mediaRequestId]);
    const [retained] = await readIntents(context.pool);
    assert.equal(retained.id, approval.intent.id);
    assert.deepEqual(retained.provider_evidence, stored.provider_evidence);
    const replacement = await seedProviderItem(input.mediaRequestId);
    const replay = await service.approveRelease({ ...input, providerIngestRequestId: replacement.id });
    assert.equal(replay.reusedExistingIntent, true);
    assert.equal(replay.run.id, approval.run.id);
    await context.pool.query('UPDATE media_requests SET requested_for_user_id = $2 WHERE id = $1', [input.mediaRequestId, fixture.users[1].id]);
    await assert.rejects(service.approveRelease({ ...input, providerIngestRequestId: replacement.id }), {
      status: 409, code: 'external_request_review_conflict',
    });
    assert.equal((await readRuns(context.pool)).length, 1);
    assert.equal((await readIntents(context.pool))[0].requested_for_user_id, fixture.users[0].id);
  }));

  test('retains approved discovery jobs during ledger pruning until their request is deleted', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context);
    const service = createLibraryExternalRequestReviewService();
    const approval = await service.approveRelease(approvalInput(context, fixture));
    await context.pool.query(`
      UPDATE operation_runs SET status = 'failed', started_at = $2, finished_at = $2,
        created_at = $2, next_attempt_at = $2, attempt_count = max_attempts
      WHERE id = $1
    `, [approval.run.id, '2026-05-01T00:00:00.000Z']);
    const oldUnreferenced = await seedOperationRunFixture({
      queryable: context.pool,
      runOverrides: {
        operationType: discoveryType, status: 'completed',
        startedAt: '2026-06-01T00:00:00.000Z', finishedAt: '2026-06-01T00:00:00.000Z',
      },
    });
    const retainedByFloor = await seedOperationRunFixture({
      queryable: context.pool,
      runOverrides: {
        operationType: discoveryType, status: 'completed',
        startedAt: '2026-08-01T00:00:00.000Z', finishedAt: '2026-08-01T00:00:00.000Z',
      },
    });
    const retention = {
      getPoolFn: context.getPoolFn,
      olderThanIso: '2026-09-01T00:00:00.000Z',
      retainCountPerType: 1,
    };
    assert.deepEqual(await countPrunableOperationRuns(retention), { prunableCount: 1 });
    assert.deepEqual(await pruneOperationRunsLedger(retention), { prunedCount: 1 });
    const remaining = await readRuns(context.pool);
    assert.deepEqual(new Set(remaining.map((run) => run.id)), new Set([approval.run.id, retainedByFloor.id]));
    assert.equal(remaining.some((run) => run.id === oldUnreferenced.id), false);
    assert.equal((await readIntents(context.pool))[0].operation_run_id, approval.run.id);
    assert.deepEqual(await countPrunableOperationRuns(retention), { prunableCount: 0 });

    await seedOperationRunFixture({
      queryable: context.pool,
      runOverrides: {
        operationType: discoveryType, status: 'completed',
        startedAt: '2026-06-02T00:00:00.000Z', finishedAt: '2026-06-02T00:00:00.000Z',
      },
    });
    const legacyStore = createOperationRunStore({ getPoolFn: context.getPoolFn, operationType: discoveryType });
    await legacyStore.pruneOldRuns({ retainCount: 1 });
    assert.deepEqual(new Set((await readRuns(context.pool)).map((run) => run.id)), new Set([approval.run.id, retainedByFloor.id]));

    await assert.rejects(context.pool.query('DELETE FROM operation_runs WHERE id = $1', [approval.run.id]), {
      code: '23001', constraint: 'library_external_request_release_intents_operation_run_id_fkey',
    });
    assert.equal((await readIntents(context.pool))[0].operation_run_id, approval.run.id);
    await context.pool.query('DELETE FROM media_requests WHERE id = $1', [fixture.requests[0].id]);
    assert.deepEqual(await readIntents(context.pool), []);
    assert.deepEqual(await countPrunableOperationRuns(retention), { prunableCount: 1 });
    assert.deepEqual(await pruneOperationRunsLedger(retention), { prunedCount: 1 });
    assert.deepEqual((await readRuns(context.pool)).map((run) => run.id), [retainedByFloor.id]);
  }));

  test('blocks cancelled requests and disabled recipients before approval or recovery can queue work', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    const service = createLibraryExternalRequestReviewService();
    const cancelled = approvalInput(context, fixture, 0);
    const disabled = approvalInput(context, fixture, 1);
    await context.pool.query("UPDATE media_requests SET request_state = 'cancelled' WHERE id = $1", [cancelled.mediaRequestId]);
    await context.pool.query('UPDATE app_users SET is_disabled = TRUE WHERE id = $1', [fixture.users[1].id]);
    for (const method of ['approveRelease', 'recoverPreparation']) {
      await assert.rejects(service[method](cancelled), { status: 409, code: 'external_request_inactive' });
      await assert.rejects(service[method](disabled), { status: 409, code: 'media_request_target_ineligible' });
    }
    assert.deepEqual(await readIntents(context.pool), []);
    assert.deepEqual(await readRuns(context.pool), []);
    assert.deepEqual(await readRuns(context.pool, executionType), []);
  }));

  test('recovers a historical child without jobs once and resumes remaining provider rows without deleting completed evidence', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context, { recipientCount: 2 });
    const service = createLibraryExternalRequestReviewService();
    const child = fixture.requests[1];
    await context.pool.query('DELETE FROM provider_ingest_requests WHERE media_request_id = $1', [child.id]);
    await context.pool.query("DELETE FROM operation_runs WHERE summary->>'mediaRequestId' = $1", [child.id]);
    const recoveryInput = { actorUserId: context.adminId, mediaRequestId: child.id };
    const recoveries = await Promise.all([service.recoverPreparation(recoveryInput), service.recoverPreparation(recoveryInput)]);
    assert.ok(recoveries.every((result) => result.accepted));
    assert.equal(recoveries[0].run.id, recoveries[1].run.id);
    const planningRuns = (await readRuns(context.pool, planningType)).filter((run) => run.summary.mediaRequestId === child.id);
    assert.equal(planningRuns.length, 1);
    assert.equal(planningRuns[0].status, 'pending');
    await context.pool.query("UPDATE operation_runs SET status = 'completed', finished_at = NOW() WHERE id = $1", [planningRuns[0].id]);
    const completed = await seedProviderItem(child.id);
    const remaining = await seedProviderItem(child.id, {
      sourceIdentifier: 'remaining-album', canonicalUrl: 'https://open.spotify.com/album/remainingalbum', status: 'planned', evidence: {},
    });
    const executionRecoveries = await Promise.all([service.recoverPreparation(recoveryInput), service.recoverPreparation(recoveryInput)]);
    assert.equal(executionRecoveries[0].run.id, executionRecoveries[1].run.id);
    const executions = await readRuns(context.pool, executionType);
    assert.equal(executions.length, 1);
    assert.equal(executions[0].summary.mediaRequestId, child.id);
    const providerRows = await context.pool.query('SELECT id, status, evidence FROM provider_ingest_requests WHERE media_request_id = $1', [child.id]);
    assert.equal(providerRows.rows.length, 2);
    assert.deepEqual(providerRows.rows.find((row) => row.id === completed.id).evidence, completed.evidence);
    assert.equal(providerRows.rows.find((row) => row.id === remaining.id).status, 'planned');
    assert.equal((await readIntents(context.pool)).length, 0, 'recovery does not approve a release or claim acquisition');
  }));

  test('retries failed provider work atomically and refuses recovery when preparation is complete', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context);
    const service = createLibraryExternalRequestReviewService();
    const input = { actorUserId: context.adminId, mediaRequestId: fixture.requests[0].id };
    await assert.rejects(service.recoverPreparation(input), {
      status: 409, code: 'external_request_preparation_complete',
    });
    const failureEvidence = { errorCode: 'provider_unavailable', failedAt: fetchedAt };
    const failedItem = await seedProviderItem(input.mediaRequestId, {
      canonicalUrl: 'https://open.spotify.com/album/failedalbum',
      evidence: failureEvidence,
      sourceIdentifier: 'failedalbum',
      status: 'failed',
    });
    await context.pool.query(`
      CREATE FUNCTION integration_reject_external_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.operation_type = '${executionType}' THEN
          RAISE EXCEPTION 'integration provider recovery queue failure';
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER integration_reject_external_recovery BEFORE INSERT ON operation_runs
        FOR EACH ROW EXECUTE FUNCTION integration_reject_external_recovery();
    `);
    try {
      await assert.rejects(service.recoverPreparation(input));
      const failed = await context.pool.query('SELECT status, evidence FROM provider_ingest_requests WHERE id = $1', [failedItem.id]);
      assert.deepEqual(failed.rows, [{ status: 'failed', evidence: failureEvidence }]);
      assert.deepEqual(await readRuns(context.pool, executionType), []);
    } finally {
      await context.pool.query('DROP TRIGGER integration_reject_external_recovery ON operation_runs');
      await context.pool.query('DROP FUNCTION integration_reject_external_recovery()');
    }
    const recovered = await service.recoverPreparation(input);
    assert.equal(recovered.accepted, true);
    const providerRows = await context.pool.query('SELECT id, status, evidence FROM provider_ingest_requests WHERE media_request_id = $1', [input.mediaRequestId]);
    assert.equal(providerRows.rows.find((row) => row.id === fixture.items[0].id).status, 'completed');
    const retried = providerRows.rows.find((row) => row.id === failedItem.id);
    assert.equal(retried.status, 'planned');
    assert.deepEqual(retried.evidence, failureEvidence);
    assert.equal((await readRuns(context.pool, executionType)).length, 1);
  }));

  test('requires authenticated administrator access, CSRF, and fresh credentials through the real route graph', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const fixture = await seedApproval(context);
    const securitySettings = await context.client.requestJson('/api/v1/settings', {
      csrf: true, json: { security: { csrfProtectionMode: 'required' } }, method: 'PUT',
    });
    assert.equal(securitySettings.response.status, 200, JSON.stringify(securitySettings.payload));
    const input = approvalInput(context, fixture);
    const reviewPath = `${requestPath}/${input.mediaRequestId}/external-review`;
    const anonymous = createSessionHttpClient(context.baseUrl);
    const requester = createSessionHttpClient(context.baseUrl);
    const login = await loginWithPassword(requester, { password, username: fixture.users[0].username });
    assert.equal(login.response.status, 200);
    for (const client of [anonymous, requester]) {
      const status = client === anonymous ? 401 : 403;
      for (const suffix of ['', '/releases?artistName=Autechre&releaseTitle=Amber']) {
        const response = await client.requestJson(`${reviewPath}${suffix}`);
        assert.equal(response.response.status, status, JSON.stringify(response.payload));
      }
      for (const suffix of ['/approve', '/recover']) {
        const response = await client.requestJson(`${reviewPath}${suffix}`, { csrf: true, json: input, method: 'POST' });
        assert.equal(response.response.status, status, JSON.stringify(response.payload));
      }
    }
    for (const suffix of ['/approve', '/recover']) {
      const noCsrf = await context.client.requestJson(`${reviewPath}${suffix}`, { csrf: false, json: input, method: 'POST' });
      assert.equal(noCsrf.response.status, 403);
      assert.equal(noCsrf.payload.error.code, 'csrf_required');
    }
    await context.pool.query('UPDATE app_users SET must_change_password = TRUE WHERE id = $1', [context.adminId]);
    for (const suffix of ['/approve', '/recover']) {
      const stale = await context.client.requestJson(`${reviewPath}${suffix}`, { csrf: true, json: input, method: 'POST' });
      assert.equal(stale.response.status, 403);
      assert.equal(stale.payload.error.code, 'reauth_required');
    }
    await context.pool.query('UPDATE app_users SET must_change_password = FALSE WHERE id = $1', [context.adminId]);
    const review = await context.client.requestJson(reviewPath);
    assert.equal(review.response.status, 200, JSON.stringify(review.payload));
    assert.equal(JSON.stringify(review.payload).includes('private-provider-field'), false);
    const approved = await context.client.requestJson(`${reviewPath}/approve`, { csrf: true, json: input, method: 'POST' });
    assert.ok([200, 202].includes(approved.response.status), JSON.stringify(approved.payload));
    assert.equal((await readIntents(context.pool)).length, 1);
    assert.equal((await readRuns(context.pool)).length, 1);
    const unknown = await context.client.requestJson(`${requestPath}/${randomUUID()}/external-review`);
    assert.equal(unknown.response.status, 404);
  }));
});
