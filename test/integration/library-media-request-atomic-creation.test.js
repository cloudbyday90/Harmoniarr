/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const requesterPassword = 'AtomicRequestPass123!';
const mediaRequestPath = '/api/v1/library/media-requests';
const releaseDraft = {
  artistName: 'Atomic Request Fixture Artist',
  releaseTitle: 'Shared Request Fixture Release',
  requestKind: 'release',
};
const externalDraft = {
  requestKind: 'external_url',
  sourceUrl: 'https://open.spotify.com/playlist/12345',
};
let integrationRuntime;
let runtimeUnavailableReason = null;

async function createRequesters(client, count = 3) {
  const users = [];
  for (let index = 0; index < count; index += 1) {
    const response = await client.requestJson('/api/v1/users', {
      csrf: true,
      json: { password: requesterPassword, role: 'requester', username: `atomic-listener-${index + 1}` },
      method: 'POST',
    });
    assert.equal(response.response.status, 201);
    users.push(response.payload.user);
  }
  return users;
}

async function submitRequest(client, payload, { csrf = true } = {}) {
  return client.requestJson(mediaRequestPath, { csrf, json: payload, method: 'POST' });
}

async function readCreationState(pool) {
  const requests = await pool.query(`
    SELECT id, requested_by_user_id, requested_for_user_id, fan_out_parent_id,
           fan_out_child_count, request_kind, evidence
    FROM media_requests
  `);
  const audits = await pool.query(`
    SELECT actor_user_id, event_type, entity_type, entity_id, details
    FROM audit_events
    WHERE entity_type = 'media_request' OR event_type = 'library_external_intake_started'
  `);
  const planningRuns = await pool.query(`
    SELECT id, status, triggered_by_user_id, summary
    FROM operation_runs
    WHERE operation_type = 'library_external_intake_planning'
  `);
  return { audits: audits.rows, planningRuns: planningRuns.rows, requests: requests.rows };
}

async function assertNoCreationState(pool) {
  assert.deepEqual(await readCreationState(pool), { audits: [], planningRuns: [], requests: [] });
}

async function assertCommittedFanOut({ adminId, parentId, pool, targetIds }) {
  const state = await readCreationState(pool);
  assert.equal(state.requests.length, targetIds.length);
  assert.deepEqual(new Set(state.requests.map((row) => row.requested_for_user_id)), new Set(targetIds));
  assert.ok(state.requests.every((row) => row.requested_by_user_id === adminId));
  const parent = state.requests.find((row) => row.id === parentId);
  assert.ok(parent);
  assert.equal(parent.fan_out_parent_id, null);
  assert.equal(parent.requested_for_user_id, targetIds[0]);
  assert.equal(parent.fan_out_child_count, targetIds.length - 1);
  const children = state.requests.filter((row) => row.id !== parentId);
  assert.ok(children.every((row) => row.fan_out_parent_id === parentId && row.fan_out_child_count === 0));
  assert.equal(state.audits.length, 2);
  assert.ok(state.audits.every((row) => row.actor_user_id === adminId && row.entity_id === parentId));
  const creationAudit = state.audits.find((row) => row.event_type === 'media_request_created');
  assert.ok(creationAudit);
  assert.equal(creationAudit.details.requestedForUserId, targetIds[0]);
  const fanOutAudit = state.audits.find((row) => row.event_type === 'media_request_fan_out_created');
  assert.ok(fanOutAudit);
  assert.equal(fanOutAudit.details.parentRequestId, parentId);
  assert.equal(fanOutAudit.details.targetUserCount, targetIds.length);
  assert.equal(fanOutAudit.details.fanOutChildCount, targetIds.length - 1);
  return state;
}

async function runScenario(t, run) {
  if (runtimeUnavailableReason) {
    t.skip(runtimeUnavailableReason);
    return;
  }
  await integrationRuntime.runScenario(async (context) => {
    const bootstrap = await bootstrapAdminSession(context.client);
    assert.equal(bootstrap.response.status, 201);
    const securityUpdate = await context.client.requestJson('/api/v1/settings', {
      csrf: true,
      json: { security: { csrfProtectionMode: 'required' } },
      method: 'PUT',
    });
    assert.equal(securityUpdate.response.status, 200);
    await run({ ...context, adminId: bootstrap.payload.user.id, pool: context.getPoolFn() });
  });
}

suite('integration atomic music request creation', () => {
  before(async () => {
    try {
      integrationRuntime = await createIntegrationAppRuntime({ config: integrationRuntimeConfig });
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      runtimeUnavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('creates one owned request per distinct target with a complete audited multi-user group', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, baseUrl, client, pool }) => {
    const users = await createRequesters(client);
    const targetIds = users.map((user) => user.id);
    const response = await submitRequest(client, {
      ...releaseDraft,
      requestedForUserIds: [...targetIds, targetIds[1], targetIds[0]],
    });
    assert.equal(response.response.status, 201, response.payload.error?.message);
    const request = response.payload.mediaRequest;
    assert.equal(request.fanOutChildCount, 2);
    assert.equal(request.fanOutChildIds.length, 2);
    const state = await assertCommittedFanOut({ adminId, parentId: request.id, pool, targetIds });
    assert.deepEqual(new Set(request.fanOutChildIds), new Set(state.requests.filter((row) => row.id !== request.id).map((row) => row.id)));

    for (const user of users) {
      const requesterClient = createSessionHttpClient(baseUrl);
      const login = await loginWithPassword(requesterClient, { password: requesterPassword, username: user.username });
      assert.equal(login.response.status, 200);
      const listing = await requesterClient.requestJson(`${mediaRequestPath}?scope=all`);
      assert.equal(listing.response.status, 200);
      assert.equal(listing.payload.mediaRequests.length, 1);
      assert.equal(listing.payload.mediaRequests[0].requestedForUser.id, user.id);
      assert.equal(listing.payload.mediaRequests[0].requestedByUser.id, adminId);
    }
  }));

  test('rolls back the parent and audit when a child insert fails, then retries without duplicate requests', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, client, pool }) => {
    const targetIds = (await createRequesters(client)).map((user) => user.id);
    const payload = { ...releaseDraft, requestedForUserIds: targetIds };
    await pool.query('ALTER TABLE media_requests ADD CONSTRAINT atomic_test_reject_children CHECK (fan_out_parent_id IS NULL)');
    try {
      const response = await submitRequest(client, payload);
      assert.equal(response.response.status, 500);
      await assertNoCreationState(pool);
    } finally {
      await pool.query('ALTER TABLE media_requests DROP CONSTRAINT atomic_test_reject_children');
    }
    const retry = await submitRequest(client, payload);
    assert.equal(retry.response.status, 201);
    await assertCommittedFanOut({ adminId, parentId: retry.payload.mediaRequest.id, pool, targetIds });
  }));

  test('rolls back the entire multi-user group when its aggregate audit cannot be persisted', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, client, pool }) => {
    const targetIds = (await createRequesters(client)).map((user) => user.id);
    const payload = { ...releaseDraft, requestedForUserIds: targetIds };
    await pool.query("ALTER TABLE audit_events ADD CONSTRAINT atomic_test_reject_fan_out_audit CHECK (event_type <> 'media_request_fan_out_created')");
    try {
      const response = await submitRequest(client, payload);
      assert.equal(response.response.status, 500);
      await assertNoCreationState(pool);
    } finally {
      await pool.query('ALTER TABLE audit_events DROP CONSTRAINT atomic_test_reject_fan_out_audit');
    }
    const retry = await submitRequest(client, payload);
    assert.equal(retry.response.status, 201);
    await assertCommittedFanOut({ adminId, parentId: retry.payload.mediaRequest.id, pool, targetIds });
  }));

  test('keeps multi-user creation admin-only and CSRF-protected while excluding disabled targets', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, baseUrl, client, pool }) => {
    const users = await createRequesters(client);
    const payload = { ...releaseDraft, requestedForUserIds: users.map((user) => user.id) };
    const missingCsrf = await submitRequest(client, payload, { csrf: false });
    assert.equal(missingCsrf.response.status, 403);
    await assertNoCreationState(pool);

    const requesterClient = createSessionHttpClient(baseUrl);
    const login = await loginWithPassword(requesterClient, { password: requesterPassword, username: users[0].username });
    assert.equal(login.response.status, 200);
    const forbidden = await submitRequest(requesterClient, payload);
    assert.equal(forbidden.response.status, 403);
    await assertNoCreationState(pool);

    const disabled = await client.requestJson(`/api/v1/users/${users[2].id}`, {
      csrf: true,
      json: { isDisabled: true },
      method: 'PATCH',
    });
    assert.equal(disabled.response.status, 200);
    const response = await submitRequest(client, payload);
    assert.equal(response.response.status, 201);
    assert.equal(response.payload.mediaRequest.fanOutIneligibleTargets.length, 1);
    assert.equal(response.payload.mediaRequest.fanOutIneligibleTargets[0].id, users[2].id);
    assert.equal(response.payload.mediaRequest.fanOutIneligibleTargets[0].reasonCode, 'media_request_target_disabled');
    await assertCommittedFanOut({ adminId, parentId: response.payload.mediaRequest.id, pool, targetIds: users.slice(0, 2).map((user) => user.id) });

    const singleEligibleResponse = await submitRequest(client, {
      ...releaseDraft,
      releaseTitle: 'Single Eligible Target Fixture',
      requestedForUserIds: [users[0].id, users[2].id],
    });
    assert.equal(singleEligibleResponse.response.status, 201);
    const singleEligibleRequest = singleEligibleResponse.payload.mediaRequest;
    assert.equal(singleEligibleRequest.requestedForUser.id, users[0].id);
    assert.equal(singleEligibleRequest.fanOutChildCount, 0);
    assert.equal(singleEligibleRequest.fanOutMessage, 'Request created for 1 user. 1 ineligible user was skipped.');
    assert.equal(singleEligibleRequest.fanOutIneligibleTargets.length, 1);
    assert.equal(singleEligibleRequest.fanOutIneligibleTargets[0].id, users[2].id);
    const state = await readCreationState(pool);
    assert.equal(state.requests.length, 3);
    assert.equal(state.requests.filter((row) => row.fan_out_parent_id === singleEligibleRequest.id).length, 0);
  }));

  test('commits a supported external request with its durable pending planning run and audit', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ adminId, client, pool }) => {
    const response = await submitRequest(client, externalDraft);
    assert.equal(response.response.status, 201);
    const requestId = response.payload.mediaRequest.id;
    const state = await readCreationState(pool);
    assert.equal(state.requests.length, 1);
    assert.equal(state.requests[0].id, requestId);
    assert.equal(state.planningRuns.length, 1);
    const run = state.planningRuns[0];
    assert.equal(run.status, 'pending');
    assert.equal(run.triggered_by_user_id, adminId);
    assert.equal(run.summary.mediaRequestId, requestId);
    assert.equal(run.summary.sourceProvider, 'spotify');
    assert.equal(run.summary.canonicalUrl, externalDraft.sourceUrl);
    assert.equal(state.requests[0].evidence.providerAutomation.operationRunId, run.id);
    assert.equal(state.requests[0].evidence.providerAutomation.status, 'queued');
    assert.deepEqual(new Set(state.audits.map((row) => row.event_type)), new Set(['media_request_created', 'library_external_intake_started']));
    assert.equal(state.audits.length, 2);
    assert.ok(state.audits.every((row) => row.actor_user_id === adminId));
    const creationAudit = state.audits.find((row) => row.event_type === 'media_request_created');
    assert.equal(creationAudit.entity_id, requestId);
    assert.equal(creationAudit.entity_type, 'media_request');
    const planningAudit = state.audits.find((row) => row.event_type === 'library_external_intake_started');
    assert.equal(planningAudit.entity_id, run.id);
    assert.equal(planningAudit.entity_type, 'operation_run');
    assert.equal(planningAudit.details.mediaRequestId, requestId);
  }));

  test('rolls back external request creation and its audit when durable planning cannot be queued', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async ({ client, pool }) => {
    await pool.query("ALTER TABLE operation_runs ADD CONSTRAINT atomic_test_reject_external_planning CHECK (operation_type <> 'library_external_intake_planning')");
    try {
      const response = await submitRequest(client, externalDraft);
      assert.equal(response.response.status, 500);
      await assertNoCreationState(pool);
    } finally {
      await pool.query('ALTER TABLE operation_runs DROP CONSTRAINT atomic_test_reject_external_planning');
    }
    const retry = await submitRequest(client, externalDraft);
    assert.equal(retry.response.status, 201);
    const state = await readCreationState(pool);
    assert.equal(state.requests.length, 1);
    assert.equal(state.planningRuns.length, 1);
    assert.equal(state.audits.length, 2);
    assert.equal(state.planningRuns[0].summary.mediaRequestId, retry.payload.mediaRequest.id);
  }));
});
