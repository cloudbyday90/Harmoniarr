/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const requestPath = '/api/v1/library/media-requests';
const lifecycleTypes = ['request_cancelled', 'request_reassigned'];
const password = 'LifecycleActivityPass123!';
const privateNote = 'PRIVATE_REQUEST_NOTE_lifecycle';
const privateReason = 'PRIVATE_MUTATION_REASON_lifecycle';
const providerUrl = 'https://open.spotify.com/playlist/privateSourceMarker123';
let runtime;
let unavailableReason = null;

async function runScenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runScenario(async (context) => {
    const bootstrap = await bootstrapAdminSession(context.client);
    assert.equal(bootstrap.response.status, 201);
    const users = [];
    for (const username of ['private-original-target', 'private-next-target', 'household-observer']) {
      const created = await context.client.requestJson('/api/v1/users', {
        csrf: true, method: 'POST', json: { username, password, role: 'requester' },
      });
      assert.equal(created.response.status, 201);
      users.push(created.payload.user);
    }
    const observer = createSessionHttpClient(context.baseUrl);
    assert.equal((await loginWithPassword(observer, { password, username: users[2].username })).response.status, 200);
    await run({ ...context, pool: context.getPoolFn(), adminId: bootstrap.payload.user.id, users, observer });
  }, { scenarioName: 'media_request_lifecycle_activity' });
}

async function createRequest(context, { external = false } = {}) {
  const created = await context.client.requestJson(requestPath, {
    csrf: true, method: 'POST', json: { requestedForUserId: context.users[0].id, notes: privateNote,
      ...(external ? { requestKind: 'external_url', sourceUrl: providerUrl }
        : { requestKind: 'release', artistName: 'Private Artist Detail', releaseTitle: 'Private Release Detail' }) },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  return created.payload.mediaRequest;
}

function mutate(client, mediaRequestId, action, json, csrf = true) {
  return client.requestJson(`${requestPath}/${mediaRequestId}/${action}`, { csrf, method: 'POST', json });
}

async function readLifecycleRows(pool, mediaRequestId) {
  return (await pool.query(`SELECT event_type, actor_user_id, entity_type, entity_id, entity_title, entity_artist, extra_payload
    FROM activity_events WHERE entity_id = $1 AND event_type = ANY($2::text[]) ORDER BY event_type`, [mediaRequestId, lifecycleTypes])).rows;
}

async function awaitLifecycleRows(pool, mediaRequestId, expectedCount) {
  // Activity remains best-effort and is dispatched after the domain mutation.
  // Wait for its observed insert; this does not assert transactional delivery.
  const deadline = Date.now() + 3000;
  let rows;
  do {
    rows = await readLifecycleRows(pool, mediaRequestId);
    if (rows.length >= expectedCount) break;
    await delay(20);
  } while (Date.now() < deadline);
  assert.equal(rows.length, expectedCount);
  return rows;
}

function assertSafeEvent(event, context, mediaRequestId, eventType) {
  assert.equal(event.eventType, eventType);
  assert.equal(event.actorUserId, context.adminId);
  assert.equal(event.entityId, mediaRequestId);
  assert.equal(event.entityType, 'media_request');
  assert.equal(event.entityTitle, null);
  assert.equal(event.entityArtist, null);
  assert.equal(event.extraPayload, null);
  const serialized = JSON.stringify(event);
  for (const forbidden of [privateNote, privateReason, providerUrl, 'Private Artist Detail', 'Private Release Detail',
    ...context.users.slice(0, 2).flatMap((user) => [user.id, user.username])]) {
    assert.equal(serialized.includes(forbidden), false, 'Household lifecycle event must omit request details and recipient identities');
  }
}

async function assertVisibleSafeEvents(context, mediaRequestId) {
  for (const client of [context.client, context.observer]) {
    for (const eventType of lifecycleTypes) {
      const feed = await client.requestJson(`/api/v1/activity/feed?eventType=${eventType}`);
      assert.equal(feed.response.status, 200);
      assert.equal(feed.payload.total, 1);
      assert.equal(feed.payload.events.length, 1, 'Registered lifecycle filter must exclude unrelated Activity types');
      assertSafeEvent(feed.payload.events[0], context, mediaRequestId, eventType);
    }
    const unfiltered = await client.requestJson('/api/v1/activity/feed');
    const lifecycle = unfiltered.payload.events.filter((event) => lifecycleTypes.includes(event.eventType));
    assert.equal(lifecycle.length, 2);
    for (const event of lifecycle) assertSafeEvent(event, context, mediaRequestId, event.eventType);
  }
}

suite('integration request lifecycle Activity', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('successful reassignment and cancellation each appear once without private request detail in household Activity', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    const reassigned = await mutate(context.client, request.id, 'reassign', { newRequestedForUserId: context.users[1].id, reason: privateReason });
    assert.equal(reassigned.response.status, 200);
    assert.equal(reassigned.payload.mediaRequest.requestedForUser.id, context.users[1].id);
    await awaitLifecycleRows(context.pool, request.id, 1);
    const noop = await mutate(context.client, request.id, 'reassign', { newRequestedForUserId: context.users[1].id, reason: privateReason });
    assert.equal(noop.response.status, 409);
    assert.equal(noop.payload.error.code, 'reassignment_noop');
    const cancelled = await mutate(context.client, request.id, 'cancel', { reason: privateReason });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.payload.mediaRequest.requestState, 'cancelled');
    const rows = await awaitLifecycleRows(context.pool, request.id, 2);
    assert.deepEqual(rows.map((row) => row.event_type), lifecycleTypes);
    for (const row of rows) {
      assert.equal(row.actor_user_id, context.adminId);
      assert.equal(row.entity_title, null);
      assert.equal(row.entity_artist, null);
      assert.equal(row.extra_payload, null);
    }
    const repeated = await mutate(context.client, request.id, 'cancel', { reason: privateReason });
    assert.equal(repeated.response.status, 409);
    assert.equal(repeated.payload.error.code, 'request_already_cancelled');
    assert.equal((await readLifecycleRows(context.pool, request.id)).length, 2);
    const domain = await context.pool.query(`SELECT event_type, reason FROM media_request_events
      WHERE media_request_id = $1 AND event_type IN ('reassigned', 'cancelled') ORDER BY event_type`, [request.id]);
    assert.deepEqual(domain.rows, [{ event_type: 'cancelled', reason: privateReason }, { event_type: 'reassigned', reason: privateReason }]);
    await assertVisibleSafeEvents(context, request.id);
    const detail = await context.observer.requestJson(`${requestPath}/${request.id}`);
    assert.equal(detail.response.status, 404, 'Household Activity does not grant access to another recipient\'s request');
  }));

  test('external request lifecycle events omit provider URLs and targets while remaining visible to household members', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context, { external: true });
    assert.equal((await mutate(context.client, request.id, 'reassign', { newRequestedForUserId: context.users[1].id, reason: privateReason })).response.status, 200);
    assert.equal((await mutate(context.client, request.id, 'cancel', { reason: privateReason })).response.status, 200);
    await awaitLifecycleRows(context.pool, request.id, 2);
    const durable = await context.pool.query('SELECT source_url, notes FROM media_requests WHERE id = $1', [request.id]);
    assert.equal(durable.rows[0].source_url, providerUrl);
    assert.equal(durable.rows[0].notes, privateNote);
    await assertVisibleSafeEvents(context, request.id);
  }));

  test('database constraints accept lifecycle and existing event types, reject unknown types, and read projection hides contaminated historical payloads', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    for (const eventType of lifecycleTypes) {
      await context.pool.query(`INSERT INTO activity_events (event_type, actor_user_id, entity_type, entity_id, entity_title, entity_artist, extra_payload)
        VALUES ($1, $2, 'media_request', $3, $4, $5, $6::jsonb)`,
      [eventType, context.adminId, request.id, 'Private Release Detail', 'Private Artist Detail',
        JSON.stringify({ notes: privateNote, reason: privateReason, sourceUrl: providerUrl,
          requestedForUserId: context.users[1].id, previousRequestedForUserId: context.users[0].id })]);
    }
    await context.pool.query(`INSERT INTO activity_events (event_type, entity_type) VALUES ('request_created', 'media_request')`);
    await assert.rejects(context.pool.query(`INSERT INTO activity_events (event_type) VALUES ('unknown_lifecycle_event')`), { code: '23514' });
    await assertVisibleSafeEvents(context, request.id);
    const raw = await readLifecycleRows(context.pool, request.id);
    assert.equal(raw[0].extra_payload.reason, privateReason, 'The read projection must omit sensitive fields even for existing raw rows');
  }));

  test('authentication, request ownership, CSRF, and fresh-admin checks reject mutations without recording successful lifecycle Activity', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    const initial = (await context.pool.query('SELECT request_state, requested_for_user_id FROM media_requests WHERE id = $1', [request.id])).rows[0];
    const settings = await context.client.requestJson('/api/v1/settings', { method: 'PUT', csrf: true,
      json: { security: { csrfProtectionMode: 'required' } } });
    assert.equal(settings.response.status, 200);
    const anonymous = createSessionHttpClient(context.baseUrl);
    assert.equal((await anonymous.requestJson('/api/v1/activity/feed')).response.status, 401);
    for (const action of ['cancel', 'reassign']) {
      const json = { newRequestedForUserId: context.users[1].id, reason: privateReason };
      assert.equal((await mutate(anonymous, request.id, action, json)).response.status, 401);
      assert.equal((await mutate(context.observer, request.id, action, json)).response.status, 403);
      const noCsrf = await mutate(context.client, request.id, action, json, false);
      assert.equal(noCsrf.response.status, 403);
      assert.equal(noCsrf.payload.error.code, 'csrf_required');
    }
    await context.pool.query('UPDATE app_users SET must_change_password = TRUE WHERE id = $1', [context.adminId]);
    const stale = await mutate(context.client, request.id, 'reassign', { newRequestedForUserId: context.users[1].id });
    assert.equal(stale.response.status, 403);
    assert.equal(stale.payload.error.code, 'reauth_required');
    assert.deepEqual((await context.pool.query('SELECT request_state, requested_for_user_id FROM media_requests WHERE id = $1', [request.id])).rows[0], initial);
    assert.deepEqual(await readLifecycleRows(context.pool, request.id), []);
    const count = await context.pool.query(`SELECT COUNT(*)::int AS count FROM media_request_events
      WHERE media_request_id = $1 AND event_type IN ('reassigned', 'cancelled')`, [request.id]);
    assert.equal(count.rows[0].count, 0);
  }));
});
