/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createLibraryProviderIngestPlanningService } from '../../src/server/library/library-provider-ingest-planning-service.js';
import { createLibraryProviderIngestExecutionService } from '../../src/server/library/library-provider-ingest-execution-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const requesterPassword = 'ExternalTargetPass123!';
const requestPath = '/api/v1/library/media-requests';
const sourceUrl = 'https://open.spotify.com/playlist/12345';
const planningType = 'library_external_intake_planning';
const executionType = 'library_external_intake_execution';
let runtime;
let unavailableReason = null;

async function createRequesters(client, count = 3) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const response = await client.requestJson('/api/v1/users', {
      csrf: true,
      json: { password: requesterPassword, role: 'requester', username: `external-listener-${index + 1}` },
      method: 'POST',
    });
    assert.equal(response.response.status, 201);
    users.push(response.payload.user);
  }
  return users;
}

async function loginRequester(baseUrl, user) {
  const client = createSessionHttpClient(baseUrl);
  const login = await loginWithPassword(client, { password: requesterPassword, username: user.username });
  assert.equal(login.response.status, 200);
  return client;
}

async function submitFamily(client, users) {
  return client.requestJson(requestPath, {
    csrf: true,
    json: { requestKind: 'external_url', requestedForUserIds: users.map((user) => user.id), sourceUrl },
    method: 'POST',
  });
}

async function readFamily(pool) {
  const result = await pool.query(`
    SELECT id, requested_by_user_id, requested_for_user_id, fan_out_parent_id,
           fan_out_child_count, linked_request_id, request_state, evidence
    FROM media_requests
    ORDER BY fan_out_parent_id NULLS FIRST, requested_for_user_id
  `);
  return result.rows;
}

async function readProviderRuns(pool, operationType = planningType) {
  const result = await pool.query(`
    SELECT id, status, triggered_by_user_id, summary
    FROM operation_runs WHERE operation_type = $1
    ORDER BY id
  `, [operationType]);
  return result.rows;
}

async function assertQueuedFamily({ adminId, pool, users }) {
  const family = await readFamily(pool);
  const runs = await readProviderRuns(pool);
  assert.equal(family.length, 3);
  assert.equal(runs.length, 3);
  assert.deepEqual(new Set(family.map((row) => row.requested_for_user_id)), new Set(users.map((user) => user.id)));
  const parent = family.find((row) => row.fan_out_parent_id === null);
  assert.equal(parent.requested_for_user_id, users[0].id);
  assert.equal(parent.fan_out_child_count, 2);
  for (const request of family) {
    assert.equal(request.requested_by_user_id, adminId);
    assert.equal(request.linked_request_id, null);
    if (request.id !== parent.id) assert.equal(request.fan_out_parent_id, parent.id);
    const run = runs.find((item) => item.summary.mediaRequestId === request.id);
    assert.ok(run, 'each recipient owns a planning run');
    assert.equal(run.status, 'pending');
    assert.equal(run.triggered_by_user_id, adminId);
    assert.equal(run.summary.canonicalUrl, sourceUrl);
    assert.equal(request.evidence.providerAutomation.operationRunId, run.id);
    assert.equal(request.evidence.providerAutomation.status, 'queued');
  }
  const audits = await pool.query(`
    SELECT actor_user_id, entity_id, details FROM audit_events
    WHERE event_type = 'library_external_intake_started'
  `);
  assert.equal(audits.rows.length, 3);
  assert.deepEqual(new Set(audits.rows.map((row) => row.details.mediaRequestId)), new Set(family.map((row) => row.id)));
  assert.deepEqual(new Set(audits.rows.map((row) => row.entity_id)), new Set(runs.map((row) => row.id)));
  assert.ok(audits.rows.every((row) => row.actor_user_id === adminId));
  return { family, parent, runs };
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

suite('integration external request target ownership', () => {
  before(async () => {
    try {
      runtime = await createIntegrationAppRuntime({ config });
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('queues and executes distinct provider work for each recipient of the same external source', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, client, pool }) => {
    const users = await createRequesters(client);
    const response = await submitFamily(client, users);
    assert.equal(response.response.status, 201, response.payload.error?.message);
    const { family, runs } = await assertQueuedFamily({ adminId, pool, users });
    const planner = createLibraryProviderIngestPlanningService();
    const providerCalls = [];
    const executor = createLibraryProviderIngestExecutionService({
      resolveProviderClients: () => ({
        spotify: {
          async getPlaylistItems(identifier) {
            providerCalls.push(['playlist', identifier]);
            return { items: [{ track: { album: { id: 'shared-album', name: 'Shared Album' } } }], next: null };
          },
          async getAlbum(identifier) {
            providerCalls.push(['album', identifier]);
            return { id: identifier, name: 'Shared Album', tracks: { items: [] } };
          },
        },
      }),
    });
    for (const request of family) {
      const planningRun = runs.find((run) => run.summary.mediaRequestId === request.id);
      const plan = await planner.planExternalMediaRequest({
        mediaRequestId: request.id, operationRunId: planningRun.id, triggeredByUserId: adminId,
      });
      assert.equal(plan.providerIngestRequests.length, 1);
      assert.equal(plan.providerIngestRequests[0].mediaRequestId, request.id);
      const execution = await executor.queueExternalMediaRequestExecution({
        canonicalUrl: plan.normalizedSource.canonicalUrl,
        mediaRequestId: request.id,
        resourceType: plan.normalizedSource.resourceType,
        sourceIdentifier: plan.normalizedSource.sourceIdentifier,
        sourceProvider: plan.normalizedSource.provider,
        triggeredByUserId: adminId,
      });
      const replay = await executor.queueExternalMediaRequestExecution({ mediaRequestId: request.id });
      assert.equal(replay.reusedExistingRun, true);
      assert.equal(replay.run.id, execution.run.id);
      const firstPass = await executor.executeProviderIngestRequests({ mediaRequestId: request.id, operationRunId: execution.run.id });
      assert.equal(firstPass.executedCount, 1);
      assert.equal(firstPass.failedCount, 0);
      assert.equal(firstPass.derivedIngestRequests.length, 1);
      assert.equal(firstPass.derivedIngestRequests[0].mediaRequestId, request.id);
      const secondPass = await executor.executeProviderIngestRequests({ mediaRequestId: request.id, operationRunId: execution.run.id });
      assert.equal(secondPass.executedCount, 1);
      assert.equal(secondPass.failedCount, 0);
    }
    const executionRuns = await readProviderRuns(pool, executionType);
    assert.equal(executionRuns.length, 3);
    assert.deepEqual(new Set(executionRuns.map((run) => run.summary.mediaRequestId)), new Set(family.map((request) => request.id)));
    const ingest = await pool.query(`
      SELECT ingest.id, ingest.media_request_id, ingest.ingest_target_type, ingest.status,
             request.requested_for_user_id
      FROM provider_ingest_requests ingest
      JOIN media_requests request ON request.id = ingest.media_request_id
    `);
    assert.equal(ingest.rows.length, 6);
    assert.equal(new Set(ingest.rows.map((row) => row.id)).size, 6);
    for (const user of users) {
      const ownedRows = ingest.rows.filter((row) => row.requested_for_user_id === user.id);
      assert.equal(ownedRows.length, 2);
      assert.deepEqual(new Set(ownedRows.map((row) => row.ingest_target_type)), new Set(['playlist_page', 'release']));
      assert.ok(ownedRows.every((row) => row.status === 'completed'));
    }
    assert.equal(providerCalls.filter(([kind]) => kind === 'playlist').length, 3);
    assert.equal(providerCalls.filter(([kind]) => kind === 'album').length, 3);
  }));

  test('rolls back the whole family when the third planning insert fails and permits a clean retry', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, client, pool }) => {
    const users = await createRequesters(client);
    await pool.query(`
      CREATE FUNCTION integration_reject_third_external_plan() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.operation_type = 'library_external_intake_planning'
          AND (SELECT count(*) FROM operation_runs WHERE operation_type = NEW.operation_type) = 2 THEN
          RAISE EXCEPTION 'integration third recipient planning failure';
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER integration_reject_third_external_plan
        BEFORE INSERT ON operation_runs FOR EACH ROW
        EXECUTE FUNCTION integration_reject_third_external_plan();
    `);
    try {
      const failed = await submitFamily(client, users);
      assert.equal(failed.response.status, 500);
      assert.equal(failed.payload.error.code, 'media_request_creation_failed');
      assert.equal(JSON.stringify(failed.payload).includes('integration third recipient'), false);
      assert.deepEqual(await readFamily(pool), []);
      assert.deepEqual(await readProviderRuns(pool), []);
      const audits = await pool.query(`
        SELECT id FROM audit_events
        WHERE entity_type = 'media_request' OR event_type = 'library_external_intake_started'
      `);
      assert.deepEqual(audits.rows, []);
    } finally {
      await pool.query('DROP TRIGGER integration_reject_third_external_plan ON operation_runs');
      await pool.query('DROP FUNCTION integration_reject_third_external_plan()');
    }
    const retry = await submitFamily(client, users);
    assert.equal(retry.response.status, 201);
    await assertQueuedFamily({ adminId, pool, users });
  }));

  test('keeps fulfillment and pipeline state scoped to each recipient and rejects sibling references', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, baseUrl, client, pool }) => {
    const users = await createRequesters(client, 4);
    const response = await submitFamily(client, users.slice(0, 3));
    assert.equal(response.response.status, 201);
    const family = await readFamily(pool);
    const requests = users.slice(0, 3).map((user) => family.find((request) => request.requested_for_user_id === user.id));
    const candidates = [];
    for (const [index, status] of ['applied', 'downloading'].entries()) {
      candidates.push(await seedImportCandidateFixture({
        candidateOverrides: {
          status,
          normalizedPayload: {
            extensions: ['flac'],
            requestOwnership: {
              sourceMediaRequestId: requests[index].id,
              sourceRequestKind: 'external_url',
              sourceRequestedByUserId: adminId,
              sourceRequestedForUserId: users[index].id,
              sourceType: 'media_request',
            },
          },
        },
        queryable: pool,
      }));
    }
    const previousOwnerCandidate = await seedImportCandidateFixture({
      candidateOverrides: {
        status: 'applied',
        normalizedPayload: {
          requestOwnership: {
            sourceMediaRequestId: requests[2].id,
            sourceRequestKind: 'external_url',
            sourceRequestedByUserId: adminId,
            sourceRequestedForUserId: users[0].id,
            sourceType: 'media_request',
          },
        },
      },
      queryable: pool,
    });
    const expectedCodes = ['fulfilled', 'downloading', 'queued'];
    for (let index = 0; index < 3; index += 1) {
      const target = await loginRequester(baseUrl, users[index]);
      const summary = await target.requestJson('/api/v1/library/media-request-summary?scope=all');
      assert.equal(summary.response.status, 200);
      assert.equal(summary.payload.scope, 'mine');
      assert.equal(summary.payload.counts.totalRequests, 1);
      assert.equal(summary.payload.fulfillmentCounts[expectedCodes[index]], 1);
      assert.equal(summary.payload.recentRequests[0].fulfillmentStatus.code, expectedCodes[index]);
      const listing = await target.requestJson(`${requestPath}?scope=all`);
      assert.equal(listing.response.status, 200);
      assert.equal(listing.payload.mediaRequests.length, 1);
      assert.equal(listing.payload.mediaRequests[0].id, requests[index].id);
      assert.equal(listing.payload.mediaRequests[0].fulfillmentStatus.code, expectedCodes[index]);
      const detail = await target.requestJson(`${requestPath}/${requests[index].id}`);
      assert.equal(detail.response.status, 200);
      assert.equal(detail.payload.mediaRequest.fulfillmentStatus.code, expectedCodes[index]);
      const ownEvents = await target.requestJson(`${requestPath}/${requests[index].id}/events`);
      assert.equal(ownEvents.response.status, 200);
      assert.ok(Array.isArray(ownEvents.payload.events));
      const pipeline = await target.requestJson(`${requestPath}/${requests[index].id}/pipeline`);
      assert.equal(pipeline.response.status, 200);
      assert.equal(pipeline.payload.candidates.length, index < 2 ? 1 : 0);
      if (index < 2) {
        assert.equal(pipeline.payload.candidates[0].status, index === 0 ? 'applied' : 'downloading');
        assert.equal('id' in pipeline.payload.candidates[0], false);
        assert.equal('folderPath' in pipeline.payload.candidates[0], false);
      }
      for (const sibling of requests.filter((request) => request.id !== requests[index].id)) {
        for (const suffix of ['', '/pipeline', '/events']) {
          const hidden = await target.requestJson(`${requestPath}/${sibling.id}${suffix}`);
          assert.equal(hidden.response.status, 404, `${suffix || 'detail'}: ${JSON.stringify(hidden.payload)}`);
          assert.equal(hidden.payload.error.code, 'media_request_not_found');
        }
      }
      for (const [candidateIndex, candidate] of candidates.entries()) {
        const candidateDetail = await target.requestJson(`/api/v1/import-candidates/${candidate.id}`);
        assert.equal(candidateDetail.response.status, candidateIndex === index ? 200 : 404);
      }
    }
    const unrelated = await loginRequester(baseUrl, users[3]);
    const listing = await unrelated.requestJson(`${requestPath}?scope=all`);
    assert.deepEqual(listing.payload.mediaRequests, []);
    for (const request of requests) {
      const hidden = await unrelated.requestJson(`${requestPath}/${request.id}/pipeline`);
      assert.equal(hidden.response.status, 404);
    }

    const unfulfilledTarget = await loginRequester(baseUrl, users[2]);
    const previousOwnerDetail = await unfulfilledTarget.requestJson(`/api/v1/import-candidates/${previousOwnerCandidate.id}`);
    assert.equal(previousOwnerDetail.response.status, 404);
    await pool.query(`
      UPDATE operation_runs SET status = 'completed', finished_at = NOW()
      WHERE operation_type = $1 AND summary->>'mediaRequestId' = $2
    `, [planningType, requests[2].id]);
    const executor = createLibraryProviderIngestExecutionService();
    const execution = await executor.queueExternalMediaRequestExecution({ mediaRequestId: requests[2].id });
    await pool.query("UPDATE operation_runs SET status = 'completed', finished_at = NOW() WHERE id = $1", [execution.run.id]);
    const prepared = await unfulfilledTarget.requestJson(`${requestPath}/${requests[2].id}`);
    assert.equal(prepared.response.status, 200);
    assert.equal(prepared.payload.mediaRequest.fulfillmentStatus.code, 'under_review');
    assert.equal(prepared.payload.mediaRequest.fulfillmentStatus.label, 'Provider details prepared');
    assert.match(prepared.payload.mediaRequest.fulfillmentStatus.detail, /Music has not been imported yet/);

    const privateError = 'provider-private-token-do-not-expose';
    await pool.query(`
      UPDATE operation_runs SET status = 'failed', error_message = $2,
        summary = summary || jsonb_build_object('providerError', $2::text)
      WHERE id = $1
    `, [execution.run.id, privateError]);
    for (const path of [
      `${requestPath}/${requests[2].id}`,
      requestPath,
      '/api/v1/library/media-request-summary',
    ]) {
      const failed = await unfulfilledTarget.requestJson(path);
      assert.equal(failed.response.status, 200);
      const request = failed.payload.mediaRequest ?? failed.payload.mediaRequests?.[0] ?? failed.payload.recentRequests[0];
      assert.equal(request.fulfillmentStatus.code, 'failed');
      assert.equal(request.fulfillmentStatus.label, 'Provider preparation failed');
      assert.equal(JSON.stringify(failed.payload).includes(privateError), false);
    }
  }));

  test('stops planning and provider execution after recipient cancellation and parent cancellation cascade', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ baseUrl, client, pool }) => {
    const users = await createRequesters(client);
    const response = await submitFamily(client, users);
    assert.equal(response.response.status, 201);
    const family = await readFamily(pool);
    const parent = family.find((request) => request.fan_out_parent_id === null);
    const child = family.find((request) => request.requested_for_user_id === users[1].id);
    const planner = createLibraryProviderIngestPlanningService();
    let providerResolutionCount = 0;
    const executor = createLibraryProviderIngestExecutionService({
      resolveProviderClients: () => { providerResolutionCount += 1; return {}; },
    });
    await planner.planExternalMediaRequest({ mediaRequestId: child.id });
    const target = await loginRequester(baseUrl, users[1]);
    const cancelledChild = await target.requestJson(`${requestPath}/${child.id}/cancel`, {
      csrf: true, json: { reason: 'Recipient no longer wants this request' }, method: 'POST',
    });
    assert.equal(cancelledChild.response.status, 200);
    assert.equal((await readFamily(pool)).find((request) => request.id === parent.id).request_state, 'needs_fetch');
    const cancellationError = { code: 'operation_run_cancelled' };
    await assert.rejects(planner.planExternalMediaRequest({ mediaRequestId: child.id }), cancellationError);
    await assert.rejects(executor.queueExternalMediaRequestExecution({ mediaRequestId: child.id }), cancellationError);
    await assert.rejects(executor.executeProviderIngestRequests({ mediaRequestId: child.id }), cancellationError);
    const cancelledParent = await client.requestJson(`${requestPath}/${parent.id}/cancel`, {
      csrf: true, json: { reason: 'Cancel remaining household requests' }, method: 'POST',
    });
    assert.equal(cancelledParent.response.status, 200);
    assert.ok((await readFamily(pool)).every((request) => request.request_state === 'cancelled'));
    for (const request of family) {
      await assert.rejects(planner.planExternalMediaRequest({ mediaRequestId: request.id }), cancellationError);
      await assert.rejects(executor.queueExternalMediaRequestExecution({ mediaRequestId: request.id }), cancellationError);
      await assert.rejects(executor.executeProviderIngestRequests({ mediaRequestId: request.id }), cancellationError);
    }
    assert.equal(providerResolutionCount, 0);
    assert.deepEqual(await readProviderRuns(pool, executionType), []);
    const ingest = await pool.query('SELECT media_request_id, status FROM provider_ingest_requests');
    assert.deepEqual(ingest.rows, [{ media_request_id: child.id, status: 'planned' }]);
  }));

  test('reports remaining provider work, active retries, and pruned history without claiming acquisition', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ baseUrl, client, pool }) => {
    const users = await createRequesters(client);
    const response = await submitFamily(client, users);
    assert.equal(response.response.status, 201);
    const family = await readFamily(pool);
    const child = family.find((request) => request.requested_for_user_id === users[1].id);
    const planningRun = (await readProviderRuns(pool)).find((run) => run.summary.mediaRequestId === child.id);
    const planner = createLibraryProviderIngestPlanningService();
    const plan = await planner.planExternalMediaRequest({ mediaRequestId: child.id, operationRunId: planningRun.id });
    await pool.query("UPDATE operation_runs SET status = 'completed', finished_at = NOW() WHERE id = $1", [planningRun.id]);
    const executor = createLibraryProviderIngestExecutionService({
      resolveProviderClients: () => ({
        spotify: {
          async getPlaylistItems() {
            return { items: [{ track: { album: { id: 'pending-album', name: 'Pending Album' } } }], next: null };
          },
        },
      }),
    });
    const execution = await executor.queueExternalMediaRequestExecution({
      mediaRequestId: child.id,
      canonicalUrl: plan.normalizedSource.canonicalUrl,
      resourceType: plan.normalizedSource.resourceType,
      sourceIdentifier: plan.normalizedSource.sourceIdentifier,
      sourceProvider: plan.normalizedSource.provider,
    });
    const executed = await executor.executeProviderIngestRequests({ mediaRequestId: child.id, operationRunId: execution.run.id });
    assert.equal(executed.executedCount, 1);
    assert.equal(executed.derivedIngestRequests.length, 1);
    assert.equal(executed.derivedIngestRequests[0].status, 'planned');
    await pool.query("UPDATE operation_runs SET status = 'completed', finished_at = NOW() WHERE id = $1", [execution.run.id]);
    const target = await loginRequester(baseUrl, users[1]);
    const readStatus = async () => {
      const detail = await target.requestJson(`${requestPath}/${child.id}`);
      assert.equal(detail.response.status, 200);
      return detail.payload.mediaRequest.fulfillmentStatus;
    };
    const remaining = await readStatus();
    assert.equal(remaining.code, 'under_review');
    assert.equal(remaining.label, 'More provider details need review');
    assert.match(remaining.detail, /remaining work/);

    await pool.query("UPDATE operation_runs SET status = 'pending', finished_at = NULL WHERE id = $1", [planningRun.id]);
    const retried = await readStatus();
    assert.equal(retried.code, 'queued');
    assert.equal(retried.label, 'Planning provider request');

    await pool.query(`
      DELETE FROM operation_runs
      WHERE summary->>'mediaRequestId' = $1 AND operation_type = ANY($2::text[])
    `, [child.id, [planningType, executionType]]);
    for (const path of [`${requestPath}/${child.id}`, requestPath, '/api/v1/library/media-request-summary']) {
      const pruned = await target.requestJson(path);
      assert.equal(pruned.response.status, 200);
      const request = pruned.payload.mediaRequest ?? pruned.payload.mediaRequests?.[0] ?? pruned.payload.recentRequests[0];
      assert.equal(request.fulfillmentStatus.code, 'under_review');
      assert.equal(request.fulfillmentStatus.label, 'Provider preparation needs review');
      assert.match(request.fulfillmentStatus.detail, /state is unavailable/);
    }
  }));

  test('allows a parent recipient to cancel only their own request while children continue independently', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ baseUrl, client, pool }) => {
    const users = await createRequesters(client, 4);
    const response = await submitFamily(client, users.slice(0, 3));
    assert.equal(response.response.status, 201);
    const family = await readFamily(pool);
    const parent = family.find((request) => request.fan_out_parent_id === null);
    const children = family.filter((request) => request.fan_out_parent_id === parent.id);
    const parentTarget = await loginRequester(baseUrl, users[0]);
    const unrelated = await loginRequester(baseUrl, users[3]);
    const cancelled = await parentTarget.requestJson(`${requestPath}/${parent.id}/cancel`, {
      csrf: true, json: { reason: 'Only my request is no longer wanted' }, method: 'POST',
    });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.payload.mediaRequest.requestState, 'cancelled');
    const currentFamily = await readFamily(pool);
    assert.equal(currentFamily.find((request) => request.id === parent.id).request_state, 'cancelled');
    assert.ok(currentFamily.filter((request) => request.id !== parent.id).every((request) => request.request_state === 'needs_fetch'));

    const planner = createLibraryProviderIngestPlanningService();
    const executor = createLibraryProviderIngestExecutionService();
    for (const child of children) {
      for (const requester of [parentTarget, unrelated]) {
        const forbidden = await requester.requestJson(`${requestPath}/${child.id}/cancel`, {
          csrf: true, json: { reason: 'Cannot cancel another recipient' }, method: 'POST',
        });
        assert.equal(forbidden.response.status, 403);
        assert.equal(forbidden.payload.error.code, 'forbidden');
      }
      const plan = await planner.planExternalMediaRequest({ mediaRequestId: child.id });
      assert.equal(plan.providerIngestRequests.length, 1);
      assert.equal(plan.providerIngestRequests[0].mediaRequestId, child.id);
      const execution = await executor.queueExternalMediaRequestExecution({
        mediaRequestId: child.id,
        canonicalUrl: plan.normalizedSource.canonicalUrl,
        resourceType: plan.normalizedSource.resourceType,
        sourceIdentifier: plan.normalizedSource.sourceIdentifier,
        sourceProvider: plan.normalizedSource.provider,
      });
      assert.equal(execution.accepted, true);
      assert.equal(execution.run.mediaRequestId, child.id);
    }
    const executionRuns = await readProviderRuns(pool, executionType);
    assert.deepEqual(new Set(executionRuns.map((run) => run.summary.mediaRequestId)), new Set(children.map((child) => child.id)));
    const finalFamily = await readFamily(pool);
    assert.ok(finalFamily.filter((request) => request.id !== parent.id).every((request) => request.request_state === 'needs_fetch'));
  }));
});
