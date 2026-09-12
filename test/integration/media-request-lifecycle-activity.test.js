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
  // A successful response must already have committed household Activity.
  const rows = await readLifecycleRows(pool, mediaRequestId);
  assert.equal(rows.length, expectedCount);
  return rows;
}

async function readAtomicState(pool) {
  const requests = await pool.query(`SELECT id, request_state, requested_for_user_id, updated_at
    FROM media_requests ORDER BY id`);
  const history = await pool.query(`SELECT * FROM media_request_events
    WHERE event_type IN ('cancelled', 'reassigned') ORDER BY id`);
  const audit = await pool.query(`SELECT * FROM audit_events
    WHERE event_type IN ('media_request_cancelled', 'media_request_reassigned', 'media_request_fan_out_cancelled') ORDER BY id`);
  const activity = await pool.query(`SELECT * FROM activity_events
    WHERE event_type IN ('request_cancelled', 'request_reassigned') ORDER BY id`);
  return { requests: requests.rows, history: history.rows, audit: audit.rows, activity: activity.rows };
}

async function withInsertFailure(pool, table, work) {
  assert.ok(['media_request_events', 'audit_events', 'activity_events'].includes(table));
  await pool.query(`CREATE FUNCTION reject_lifecycle_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Injected lifecycle persistence failure'; END $$`);
  await pool.query(`CREATE TRIGGER reject_lifecycle_fixture BEFORE INSERT ON ${table}
    FOR EACH ROW EXECUTE FUNCTION reject_lifecycle_fixture()`);
  try { await work(); }
  finally {
    await pool.query(`DROP TRIGGER reject_lifecycle_fixture ON ${table}`);
    await pool.query('DROP FUNCTION reject_lifecycle_fixture()');
  }
}

async function waitForBlockedMutation(pool, blockerPid) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const blocked = await pool.query(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND $1::int = ANY(pg_blocking_pids(pid))`, [blockerPid]);
    if (blocked.rows[0].count > 0) return;
    await delay(20);
  }
  assert.fail('Expected lifecycle mutation to wait for the held request lock');
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

  for (const action of ['cancel', 'reassign']) {
    for (const table of ['media_request_events', 'audit_events', 'activity_events']) {
      test(`${action} rolls back every lifecycle record when ${table} fails and permits a clean retry`, {
        timeout: config.scenarioTimeoutMs,
      }, async (t) => runScenario(t, async (context) => {
        const request = await createRequest(context);
        const initial = await readAtomicState(context.pool);
        const payload = { reason: privateReason, newRequestedForUserId: context.users[1].id };
        await withInsertFailure(context.pool, table, async () => {
          const failed = await mutate(context.client, request.id, action, payload);
          assert.equal(failed.response.status, 500);
          assert.deepEqual(await readAtomicState(context.pool), initial);
        });
        assert.equal((await mutate(context.client, request.id, action, payload)).response.status, 200);
        const committed = await readAtomicState(context.pool);
        assert.equal(committed.history.length, 1);
        assert.equal(committed.audit.length, 1);
        assert.equal(committed.activity.length, 1);
        assert.equal(committed.activity[0].entity_title, null);
        assert.equal(committed.activity[0].extra_payload, null);
      }));
    }

    test(`concurrent duplicate ${action} commits one transition and one set of lifecycle records`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => runScenario(t, async (context) => {
      const request = await createRequest(context);
      const payload = { reason: privateReason, newRequestedForUserId: context.users[1].id };
      const responses = await Promise.all([
        mutate(context.client, request.id, action, payload),
        mutate(context.client, request.id, action, payload),
      ]);
      assert.deepEqual(responses.map((result) => result.response.status).sort(), [200, 409]);
      const state = await readAtomicState(context.pool);
      assert.equal(state.history.length, 1);
      assert.equal(state.audit.length, 1);
      assert.equal(state.activity.length, 1);
    }));
  }

  test('fan-out cancellation rolls back the whole family on Activity failure and records actual child states on retry', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const created = await context.client.requestJson(requestPath, {
      csrf: true, method: 'POST', json: { requestKind: 'release', artistName: 'Family Artist',
        releaseTitle: 'Family Release', requestedForUserIds: context.users.map((user) => user.id) },
    });
    assert.equal(created.response.status, 201);
    const request = created.payload.mediaRequest;
    const children = (await context.pool.query('SELECT id FROM media_requests WHERE fan_out_parent_id = $1 ORDER BY id', [request.id])).rows;
    assert.equal(children.length, 2);
    await context.pool.query("UPDATE media_requests SET request_state = 'needs_review' WHERE id = $1", [children[0].id]);
    const initial = await readAtomicState(context.pool);
    await withInsertFailure(context.pool, 'activity_events', async () => {
      assert.equal((await mutate(context.client, request.id, 'cancel', { reason: privateReason })).response.status, 500);
      assert.deepEqual(await readAtomicState(context.pool), initial);
    });
    const response = await mutate(context.client, request.id, 'cancel', { reason: privateReason });
    assert.equal(response.response.status, 200);
    assert.equal(response.payload.mediaRequest.cancelledChildCount, 2);
    const final = await readAtomicState(context.pool);
    assert.ok(final.requests.every((row) => row.request_state === 'cancelled'));
    assert.equal(final.history.length, 3);
    assert.equal(final.audit.length, 2);
    assert.equal(final.activity.length, 1);
    assert.equal(final.history.find((row) => row.media_request_id === children[0].id).details.previousState, 'needs_review');
    assert.equal(final.history.find((row) => row.media_request_id === children[1].id).details.previousState, 'needs_fetch');
  }));

  test('concurrent distinct reassignments preserve a continuous ownership history', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    const responses = await Promise.all(context.users.slice(1).map((user) =>
      mutate(context.client, request.id, 'reassign', { newRequestedForUserId: user.id })));
    assert.ok(responses.every((result) => result.response.status === 200));
    const state = await readAtomicState(context.pool);
    assert.equal(state.history.length, 2);
    assert.equal(state.audit.length, 2);
    assert.equal(state.activity.length, 2);
    const first = state.history.find((row) => row.previous_requested_for_user_id === context.users[0].id);
    assert.ok(first);
    const second = state.history.find((row) => row.previous_requested_for_user_id === first.new_requested_for_user_id);
    assert.ok(second, 'Second writer must use the first writer\'s committed recipient');
    assert.equal(state.requests[0].requested_for_user_id, second.new_requested_for_user_id);
  }));

  test('bulk cancellation reports a safe item error and preserves state when durable Activity fails', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    const initial = await readAtomicState(context.pool);
    await withInsertFailure(context.pool, 'activity_events', async () => {
      const response = await context.client.requestJson(`${requestPath}/bulk-cancel`, {
        csrf: true, method: 'POST', json: { mediaRequestIds: [request.id], reason: privateReason },
      });
      assert.equal(response.response.status, 200);
      assert.equal(response.payload.failed, 1);
      assert.equal(response.payload.succeeded, 0);
      const error = response.payload.results[0].error;
      assert.equal(error.code, 'media_request_lifecycle_failed');
      assert.equal(error.status, 500);
      assert.equal(JSON.stringify(response.payload).includes('Injected lifecycle persistence failure'), false);
      assert.equal(JSON.stringify(response.payload).includes(privateReason), false);
      assert.deepEqual(await readAtomicState(context.pool), initial);
    });
  }));

  test('cancellation rechecks ownership after waiting for a conflicting request write', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    const originalRecipient = createSessionHttpClient(context.baseUrl);
    assert.equal((await loginWithPassword(originalRecipient, {
      username: context.users[0].username, password,
    })).response.status, 200);
    const blocker = await context.pool.connect();
    let pending;
    try {
      await blocker.query('BEGIN');
      const { rows } = await blocker.query('SELECT pg_backend_pid() AS pid');
      await blocker.query('UPDATE media_requests SET requested_for_user_id = $2 WHERE id = $1',
        [request.id, context.users[1].id]);
      pending = mutate(originalRecipient, request.id, 'cancel', { reason: privateReason });
      await waitForBlockedMutation(blocker, rows[0].pid);
      await blocker.query('COMMIT');
      assert.equal((await pending).response.status, 403);
      const state = await readAtomicState(context.pool);
      assert.equal(state.requests[0].request_state, request.requestState);
      assert.equal(state.requests[0].requested_for_user_id, context.users[1].id);
      assert.deepEqual(state.history, []);
      assert.deepEqual(state.audit, []);
      assert.deepEqual(state.activity, []);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending;
    }
  }));

  test('reassignment rejects a target disabled while it waits for the user lock', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => runScenario(t, async (context) => {
    const request = await createRequest(context);
    const initial = await readAtomicState(context.pool);
    const blocker = await context.pool.connect();
    let pending;
    try {
      await blocker.query('BEGIN');
      const { rows } = await blocker.query('SELECT pg_backend_pid() AS pid');
      await blocker.query('UPDATE app_users SET is_disabled = TRUE WHERE id = $1', [context.users[1].id]);
      pending = mutate(context.client, request.id, 'reassign', { newRequestedForUserId: context.users[1].id });
      await waitForBlockedMutation(blocker, rows[0].pid);
      await blocker.query('COMMIT');
      const response = await pending;
      assert.equal(response.response.status, 409);
      assert.equal(response.payload.error.code, 'media_request_target_ineligible');
      assert.deepEqual(await readAtomicState(context.pool), initial);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await pending;
    }
  }));

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
    const uppercaseNoop = await mutate(context.client, request.id, 'reassign', {
      newRequestedForUserId: context.users[1].id.toUpperCase(), reason: privateReason,
    });
    assert.equal(uppercaseNoop.response.status, 409);
    assert.equal(uppercaseNoop.payload.error.code, 'reassignment_noop');
    const compactNoop = await mutate(context.client, request.id, 'reassign', {
      newRequestedForUserId: context.users[1].id.replaceAll('-', ''),
    });
    assert.equal(compactNoop.response.status, 409);
    assert.equal(compactNoop.payload.error.code, 'reassignment_noop');
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
