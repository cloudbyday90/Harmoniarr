/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { after, before, suite, test } from 'node:test';
import { createAppUserService } from '../../src/server/app-user-service.js';
import { createPlexLinkedAccountReconciliationService } from '../../src/server/integrations/plex/plex-linked-account-reconciliation-service.js';
import { createPlexDirectoryImportService } from '../../src/server/integrations/plex/plex-directory-import-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = { ...resolveIntegrationTestRuntimeConfig(), poolMax: 4 };
const requestPath = '/api/v1/library/media-requests';
const draft = { requestKind: 'release', artistName: 'Eligibility Artist', releaseTitle: 'Eligibility Release' };
let runtime;
let unavailableReason;

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitForBlocked(queryable, blockerPid) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await queryable.query(`SELECT count(*)::int AS count FROM pg_stat_activity
      WHERE datname = current_database() AND $1::int = ANY(pg_blocking_pids(pid))`, [blockerPid]);
    if (result.rows[0].count) return;
    await delay(20);
  }
  assert.fail('Expected eligibility reader or writer to wait for its account guard');
}

async function scenario(t, work) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runScenario(async (context) => {
    const bootstrap = await bootstrapAdminSession(context.client);
    assert.equal(bootstrap.response.status, 201);
    const users = [];
    for (const username of ['eligibility-target', 'eligibility-other']) {
      const created = await context.client.requestJson('/api/v1/users', {
        csrf: true, method: 'POST', json: { username, password: 'EligibilityPass123!', role: 'requester' },
      });
      assert.equal(created.response.status, 201);
      users.push(created.payload.user);
    }
    const pool = context.getPoolFn();
    const userService = createAppUserService({ getPoolFn: () => pool });
    await pool.query(`UPDATE app_users SET auth_provider = 'plex', auth_subject = 'eligibility-plex-uuid',
      password_changed_at = NOW() WHERE id = $1`, [users[0].id]);
    await work({ ...context, pool, userService, users, adminId: bootstrap.payload.user.id });
  }, { scenarioName: 'recipient_eligibility_consistency' });
}

async function seedProfile(context) {
  await context.pool.query(`INSERT INTO app_user_plex_profiles
    (app_user_id, plex_user_id, plex_uuid, plex_title, plex_home_role, plex_library_access_state)
    VALUES ($1, 'eligibility-plex-id', 'eligibility-plex-uuid', 'Private Plex Title', 'home_member', 'shared')`, [context.users[0].id]);
}

function reconciliation(context, getPoolFn = () => context.pool) {
  return createPlexLinkedAccountReconciliationService({
    getPoolFn, getAppUserById: context.userService.getAppUserById,
    buildPlexDirectoryImportPreview: async () => ({ profiles: [{
      id: 'eligibility-plex-id', uuid: 'eligibility-plex-uuid', title: 'Private Plex Title',
      homeRole: 'home_member', libraryAccessState: 'unknown', libraryAccessDetails: {}, classification: 'linked',
    }] }),
  });
}

function refresh(context, service) {
  return service.reconcileUser({ action: 'refresh_profile', userId: context.users[0].id, actorUserId: context.adminId });
}

function directory(context, { getPoolFn = () => context.pool, extraProfiles = [] } = {}) {
  return createPlexDirectoryImportService({
    getPoolFn, listAppUsers: context.userService.listAppUsers,
    plexOwnerLinkService: { resolveLinkedAccessToken: async () => ({
      accessToken: 'fixture-only', clientIdentifier: 'fixture-only',
      linkedUser: { id: 'fixture-owner', uuid: 'fixture-owner-uuid', username: 'fixture-owner' },
    }) },
    plexHttpClient: { fetchHomeUsers: async () => [{ id: 'eligibility-plex-id', uuid: 'eligibility-plex-uuid',
      username: 'eligibility-target', title: 'Private Plex Title' }, ...extraProfiles] },
  });
}

function heldCommitPool(pool) {
  const ready = deferred();
  const release = deferred();
  return { ready: ready.promise, release: release.resolve, getPoolFn: () => ({
    connect: async () => {
      const client = await pool.connect();
      const { rows } = await client.query('SELECT pg_backend_pid() AS pid');
      return { release: () => client.release(), query: async (sql, params) => {
        if (sql === 'COMMIT') { ready.resolve(rows[0].pid); await release.promise; }
        return client.query(sql, params);
      } };
    },
  }) };
}

async function requestState(pool) {
  const counts = await pool.query(`SELECT
    (SELECT count(*)::int FROM media_requests) AS requests,
    (SELECT count(*)::int FROM media_request_events) AS history,
    (SELECT count(*)::int FROM activity_events WHERE event_type = 'request_reassigned') AS activity,
    (SELECT count(*)::int FROM audit_events WHERE event_type LIKE 'media_request_%') AS audit`);
  return counts.rows[0];
}

suite('integration recipient eligibility consistency', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const missingProfile of [false, true]) {
    test(`waiting reassignment sees committed Plex ${missingProfile ? 'insertion' : 'refresh'} and rejects stale eligibility`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => scenario(t, async (context) => {
      if (!missingProfile) await seedProfile(context);
      const created = await context.client.requestJson(requestPath, {
        csrf: true, method: 'POST', json: { ...draft, requestedForUserId: context.users[1].id },
      });
      assert.equal(created.response.status, 201);
      const initial = await requestState(context.pool);
      const held = heldCommitPool(context.pool);
      const writer = refresh(context, reconciliation(context, held.getPoolFn));
      let pending;
      try {
        const writerPid = await Promise.race([held.ready, writer.then(() => assert.fail('Writer completed before the commit gate'))]);
        pending = context.client.requestJson(`${requestPath}/${created.payload.mediaRequest.id}/reassign`, {
          csrf: true, method: 'POST', json: { newRequestedForUserId: context.users[0].id },
        });
        await waitForBlocked(context.pool, writerPid);
        held.release();
        await writer;
        const response = await pending;
        assert.equal(response.response.status, 409);
        assert.equal(response.payload.error.code, 'media_request_target_ineligible');
        assert.deepEqual(await requestState(context.pool), initial);
      } finally { held.release(); await Promise.allSettled([writer, pending]); }
    }));

    test(`a transactional reader protects ${missingProfile ? 'absent' : 'existing'} profile eligibility until commit`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => scenario(t, async (context) => {
      if (!missingProfile) await seedProfile(context);
      const reader = await context.pool.connect();
      let writer;
      try {
        await reader.query('BEGIN');
        const { rows } = await reader.query('SELECT pg_backend_pid() AS pid');
        const original = await context.userService.getAppUserById({ userId: context.users[0].id, queryable: reader });
        assert.equal(original.plexProfile?.accessPolicy.requestTargetingEligible ?? true, true);
        writer = refresh(context, reconciliation(context));
        await waitForBlocked(context.pool, rows[0].pid);
        const retained = await context.userService.getAppUserById({ userId: context.users[0].id, queryable: reader });
        assert.deepEqual(retained.plexProfile, original.plexProfile);
        await reader.query('COMMIT');
        await writer;
        const changed = await context.userService.getAppUserById({ userId: context.users[0].id });
        assert.equal(changed.plexProfile.accessPolicy.requestTargetingEligible, false);
      } finally { await reader.query('ROLLBACK'); reader.release(); await writer; }
    }));
  }

  for (const multipleTargets of [false, true]) {
    test(`${multipleTargets ? 'multi-target' : 'single-target'} creation rechecks recipients after a concurrent profile refresh`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => scenario(t, async (context) => {
      await seedProfile(context);
      const initial = await requestState(context.pool);
      const held = heldCommitPool(context.pool);
      const writer = refresh(context, reconciliation(context, held.getPoolFn));
      let pending;
      try {
        const writerPid = await Promise.race([held.ready, writer.then(() => assert.fail('Writer completed before the commit gate'))]);
        pending = context.client.requestJson(requestPath, { csrf: true, method: 'POST', json: {
          ...draft, ...(multipleTargets ? { requestedForUserIds: context.users.map((user) => user.id).reverse() }
            : { requestedForUserId: context.users[0].id }),
        } });
        await waitForBlocked(context.pool, writerPid);
        held.release();
        await writer;
        const response = await pending;
        assert.equal(response.response.status, 409);
        assert.equal(response.payload.error.code, 'media_request_target_ineligible');
        assert.deepEqual(await requestState(context.pool), initial);
      } finally { held.release(); await Promise.allSettled([writer, pending]); }
    }));
  }

  test('unlink cannot remove the profile while a transactional eligibility reader holds its guard', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => scenario(t, async (context) => {
    await seedProfile(context);
    const reader = await context.pool.connect();
    let writer;
    try {
      await reader.query('BEGIN');
      const { rows } = await reader.query('SELECT pg_backend_pid() AS pid');
      await context.userService.getAppUserById({ userId: context.users[0].id, queryable: reader });
      writer = createPlexDirectoryImportService({ getPoolFn: () => context.pool }).unlinkUser({
        actorUserId: context.adminId, userId: context.users[0].id,
      });
      await waitForBlocked(context.pool, rows[0].pid);
      assert.equal((await reader.query('SELECT count(*)::int AS count FROM app_user_plex_profiles')).rows[0].count, 1);
      await reader.query('COMMIT');
      await writer;
      assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM app_user_plex_profiles')).rows[0].count, 0);
    } finally { await reader.query('ROLLBACK'); reader.release(); await writer; }
  }));

  test('directory refresh rejects a preview made stale by a concurrent relink', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => scenario(t, async (context) => {
    await seedProfile(context);
    const blocker = await context.pool.connect();
    let pending;
    try {
      await blocker.query('BEGIN');
      const { rows } = await blocker.query('SELECT pg_backend_pid() AS pid');
      await blocker.query("UPDATE app_users SET auth_subject = 'replacement-plex-uuid' WHERE id = $1", [context.users[0].id]);
      await blocker.query(`UPDATE app_user_plex_profiles SET plex_user_id = 'replacement-plex-id',
        plex_uuid = 'replacement-plex-uuid' WHERE app_user_id = $1`, [context.users[0].id]);
      pending = directory(context).applyImport({ actorUserId: context.adminId });
      const rejected = assert.rejects(pending, { status: 409 });
      await waitForBlocked(context.pool, rows[0].pid);
      await blocker.query('COMMIT');
      await rejected;
      const identity = (await context.pool.query(`SELECT u.auth_subject, p.plex_uuid, p.plex_user_id
        FROM app_users u JOIN app_user_plex_profiles p ON p.app_user_id = u.id WHERE u.id = $1`, [context.users[0].id])).rows[0];
      assert.deepEqual(identity, { auth_subject: 'replacement-plex-uuid', plex_uuid: 'replacement-plex-uuid', plex_user_id: 'replacement-plex-id' });
      assert.equal((await context.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'plex_directory_import_applied'")).rows[0].count, 0);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); await Promise.allSettled([pending]); }
  }));

  test('batch refresh and reversed multi-target creation acquire guards without a reader-writer deadlock', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => scenario(t, async (context) => {
    await seedProfile(context);
    await context.pool.query("UPDATE app_users SET auth_provider = 'plex', auth_subject = 'second-plex-uuid' WHERE id = $1", [context.users[1].id]);
    await context.pool.query(`INSERT INTO app_user_plex_profiles
      (app_user_id, plex_user_id, plex_uuid, plex_title, plex_home_role, plex_library_access_state)
      VALUES ($1, 'second-plex-id', 'second-plex-uuid', 'Second Profile', 'home_member', 'shared')`, [context.users[1].id]);
    const sortedIds = context.users.map((user) => user.id).sort();
    const reader = await context.pool.connect();
    const connected = deferred();
    let writer;
    let pending;
    try {
      await reader.query('BEGIN');
      const { rows } = await reader.query('SELECT pg_backend_pid() AS pid');
      await context.userService.getAppUserById({ userId: sortedIds[1], queryable: reader });
      writer = directory(context, {
        extraProfiles: [{ id: 'second-plex-id', uuid: 'second-plex-uuid', username: 'eligibility-other', title: 'Second Profile' }],
        getPoolFn: () => ({ connect: async () => {
          const client = await context.pool.connect();
          connected.resolve((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
          return client;
        } }),
      }).applyImport({ actorUserId: context.adminId });
      const writerPid = await Promise.race([connected.promise, writer.then(() => assert.fail('Writer did not connect'))]);
      await waitForBlocked(context.pool, rows[0].pid);
      pending = context.client.requestJson(requestPath, { csrf: true, method: 'POST',
        json: { ...draft, requestedForUserIds: sortedIds.toReversed() } });
      await waitForBlocked(context.pool, writerPid);
      await reader.query('COMMIT');
      assert.equal((await writer).summary.updated, 2);
      const response = await pending;
      assert.equal(response.response.status, 409);
      assert.equal(response.payload.error.code, 'media_request_target_ineligible');
      assert.equal((await requestState(context.pool)).requests, 0);
    } finally { await reader.query('ROLLBACK'); reader.release(); await Promise.allSettled([writer, pending]); }
  }));
});
