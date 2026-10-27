/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { createProviderModule } from '/app/server-dist/provider-module.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { getSessionFromRequest } from '/app/server-dist/auth.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createPlexOwnerLinkService } from '/app/server-dist/integrations/plex/plex-owner-link-service.js';
import { createPlexOwnerLinkCommandService } from '/app/server-dist/integrations/plex/plex-owner-link-command-service.js';
import { createPlexOwnerLinkStateService } from '/app/server-dist/integrations/plex/plex-owner-link-state-service.js';
import { ownerLinkStateName, ownerLinkTokenName, ownerLinkRevisionName, ownerLinkLockKey } from '/app/server-dist/integrations/plex/plex-owner-link-policy.js';
import { createPlexCallbackRetentionService } from '/app/server-dist/integrations/plex/plex-callback-retention-service.js';
import { createPlexHttpClient } from '/app/server-dist/integrations/plex/plex-http-client.js';
import { startAuthLookup } from '/app/server-dist/auth-lookup-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { recordAuditEvent } from '/app/server-dist/audit.js';
import { createMaintenanceLockService } from '/app/server-dist/recovery/maintenance-lock-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createPlexResponseTransport } from '../../testing/server/plex-response-transport.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('Plex owner linking binds current authority and publishes one atomic administrator decision', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64); process.env.HARMONIARR_SECURE_COOKIES = 'false';
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), writer = new pg.Client(buildConnectionConfig());
  const secrets = createEncryptedSecretService(), results = [], active = new Set(), releases = new Set(), ownership = new AsyncLocalStorage();
  const binding = Buffer.alloc(32, 1).toString('base64url'), other = Buffer.alloc(32, 2).toString('base64url');
  const baseUrl = 'http://127.0.0.1:3000', metadata = { ipAddress: '127.0.0.1', userAgent: 'native-owner-link' };
  let runtime, callbacks, session, cookies, csrf, networkCalls = 0;
  const trackedPool = { async connect() {
    const context = ownership.getStore(); assert.ok(context);
    const client = await pool.connect(), release = client.release; context.clients++;
    client.release = function (...args) { client.release = release; const result = Reflect.apply(release, this, args); context.clients--; return result; };
    return client;
  } };
  const transport = createPlexHttpClient({ transport: createPlexResponseTransport(async url => {
    assert.equal(ownership.getStore()?.clients, 0, 'No checkout may be held across provider work'); networkCalls++;
    const path = new URL(url).pathname;
    if (path === '/api/v2/pins') return Response.json({ id: 123, code: 'fixture-pin' });
    if (path === '/api/v2/pins/123') return Response.json({ authToken: 'fixture-owner-token' });
    return Response.json({ id: 7, uuid: 'owner-subject', email: 'Owner@Example.test', restricted: false });
  }) });
  function make({ beforePublish, commandOptions = {} } = {}) {
    const commandService = createPlexOwnerLinkCommandService({ encryptedSecretService: secrets,
      startTransactionFn: (work, settings) => startSessionWriteTransaction(work, { ...settings, getPoolFn: () => trackedPool }), ...commandOptions });
    const stateService = createPlexOwnerLinkStateService({ encryptedSecretService: secrets,
      startReadFn: (work, settings) => startAuthLookup(work, { ...settings, getPoolFn: () => trackedPool }) });
    const service = createPlexOwnerLinkService({ encryptedSecretService: secrets, commandService: { ...commandService,
      async complete(input) { if (beforePublish) await beforePublish(); return commandService.complete(input); } }, stateService,
      plexHttpClient: transport, loadSettingsFn: async () => ({ system: { baseUrl } }) });
    return Object.fromEntries(['startLink', 'completeLink', 'clearLink'].map(name => [name, input => ownership.run({ clients: 0 }, () => service[name](input))]));
  }
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createProviderModule: options => createProviderModule({ ...options,
    plexOwnerLinkService: { buildStatus: () => createPlexOwnerLinkService().buildStatus(), resolveLinkedAccessToken: () => null,
      ...Object.fromEntries(['startLink', 'completeLink', 'clearLink'].map(name => [name, input => track(callbacks[name](input))])) } }) });
  const record = key => secrets.getSecretRecord({ secretType: 'integration_oauth', name: ownerLinkStateName(key), queryable: observer });
  const snapshot = async () => (await observer.query(`SELECT name,encode(encrypted_value,'hex') AS cipher,updated_at::text AS revision
    FROM encrypted_secrets WHERE name LIKE 'providers.plex.link.%' ORDER BY name,id`)).rows;
  async function flow(service = callbacks) {
    const dto = await service.startLink({ session, browserBinding: binding, requestMetadata: metadata });
    return new URL(new URLSearchParams(dto.authorizationUrl.split('#?')[1]).get('forwardUrl')).searchParams.get('state');
  }
  const complete = (key, service = callbacks) => service.completeLink({ state: key, browserBinding: binding, requestMetadata: metadata });
  async function rewrite(key, delta) {
    const row = await record(key), value = JSON.parse(secrets.decryptSecretRecord(row));
    await secrets.setSecretValue({ secretType: 'integration_oauth', name: ownerLinkStateName(key), plaintextValue: JSON.stringify({ ...value, ...delta }), queryable: observer });
  }
  async function trigger(table, event, condition, body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_owner() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF ${condition} THEN ${body} END IF; RETURN ${event === 'DELETE' ? 'OLD' : 'NEW'}; END $$;
      CREATE TRIGGER fixture_owner BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION public.fixture_owner()`);
    return withWorkerTaskCleanup(work, () => observer.query(`DROP TRIGGER fixture_owner ON ${table}; DROP FUNCTION public.fixture_owner()`));
  }
  function gate(count = 1) {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release); let seen = 0;
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, service: make({ beforePublish: async () => { if (++seen === count) ready.resolve(); await release.promise; } }) };
  }
  async function until(check) {
    const deadline = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, 'Owner observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  await withWorkerTaskCleanup(async () => {
    callbacks = make(); runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect(); await writer.connect();
    const boot = await fetch(baseUrl + '/api/v1/bootstrap/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'owner-admin', password: 'OwnerFixturePassword123!' }) });
    assert.equal(boot.status, 201); const dto = await boot.json(); csrf = dto.csrfToken;
    cookies = boot.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    session = await getSessionFromRequest({ headers: { cookie: cookies }, socket: { remoteAddress: '127.0.0.1' } }); assert.ok(session);
    csrf ??= session.csrfToken;
    const start = await fetch(baseUrl + '/api/v1/providers/plex/link/start', { method: 'POST', headers: { cookie: cookies, 'x-csrf-token': csrf } });
    assert.equal(start.status, 202); assert.equal(start.headers.get('cache-control'), 'no-store'); assert.equal(start.headers.get('referrer-policy'), 'no-referrer');
    const startDto = await start.json(), cookie = start.headers.get('set-cookie'); assert.match(cookie, /harmoniarr_plex_link_binding=.*HttpOnly; SameSite=Lax/u);
    const browser = decodeURIComponent(cookie.split(';')[0].split('=')[1]); assert.ok(!JSON.stringify(startDto).includes(browser));
    const key = new URL(new URLSearchParams(startDto.authorizationUrl.split('#?')[1]).get('forwardUrl')).searchParams.get('state');
    const callback = browserBinding => fetch(baseUrl + '/api/v1/providers/plex/link/callback?state=' + key, { redirect: 'manual', headers: browserBinding ? { cookie: 'harmoniarr_plex_link_binding=' + browserBinding } : {} });
    const before = await snapshot(), calls = networkCalls;
    for (const browserBinding of [null, other]) { const response = await callback(browserBinding); assert.match(response.headers.get('location'), /plex_link_state_invalid/u); assert.equal(networkCalls, calls); assert.deepEqual(await snapshot(), before); }
    results.push('http-start-private-dto-cookie-and-cross-browser-refusal');
    const accepted = await callback(browser); assert.equal(accepted.headers.get('location'), '/app/settings?plexOAuth=linked');
    assert.equal(await record(key), null); assert.equal(await secrets.getSecretValue({ secretType: 'integration_oauth', name: ownerLinkTokenName, queryable: observer }).then(JSON.parse).then(value => value.accessToken), 'fixture-owner-token');
    const after = await snapshot(); await callback(browser); assert.deepEqual(await snapshot(), after); results.push('callback-without-strict-auth-cookie-consumes-once-and-replay-refuses');
    const audits = (await observer.query("SELECT details FROM audit_events WHERE event_type LIKE 'plex_owner_link_%'")).rows;
    assert.ok(!JSON.stringify(audits).includes(key)); assert.ok(!JSON.stringify(audits).includes(browser)); assert.ok(!JSON.stringify(audits).includes('owner@example.test')); results.push('required-audit-details-omit-state-bindings-token-and-provider-identity');

    for (const delta of [{ version: 0 }, { kind: 'sign_in' }, { browserBindingHash: undefined }, { expiresAt: '2000-01-01T00:00:00.000Z' }]) {
      const state = await flow(); await rewrite(state, delta); const stable = await snapshot(), count = networkCalls;
      await assert.rejects(complete(state), { code: 'plex_link_state_invalid' }); assert.equal(networkCalls, count); assert.deepEqual(await snapshot(), stable);
    } results.push('legacy-malformed-expired-state-refused-before-provider-work');
    const exhaustedKey = await flow(), holders = [], stableExhausted = await snapshot(), countBefore = networkCalls;
    await withWorkerTaskCleanup(async () => {
      for (let index = 0; index < 4; index++) holders.push(await pool.connect());
      await assert.rejects(complete(exhaustedKey), { status: 503, code: 'auth_lookup_unavailable' });
    }, () => { for (const client of holders) client.release(); });
    assert.equal(networkCalls, countBefore); assert.deepEqual(await snapshot(), stableExhausted); results.push('state-read-pool-exhaustion-refuses-before-provider-work');
    const writerFirstKey = await flow(), stableWriterFirst = await snapshot();
    await writer.query('BEGIN'); await writer.query("UPDATE app_users SET role='member' WHERE id=$1", [session.appUserId]);
    await withWorkerTaskCleanup(async () => {
      const refused = assert.rejects(track(complete(writerFirstKey)), { code: 'plex_link_authorization_changed' });
      await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%FOR NO KEY UPDATE%') AS waiting")).rows[0].waiting);
      await writer.query('COMMIT'); await refused;
    }, () => writer.query('ROLLBACK'));
    assert.deepEqual(await snapshot(), stableWriterFirst); await observer.query("UPDATE app_users SET role='admin' WHERE id=$1", [session.appUserId]); results.push('committed-demotion-after-account-lock-wait-is-observed');
    for (const [name, sql, reset] of [
      ['demoted', "UPDATE app_users SET role='member' WHERE id=$1", "UPDATE app_users SET role='admin' WHERE id=$1"],
      ['disabled', 'UPDATE app_users SET is_disabled=true WHERE id=$1', 'UPDATE app_users SET is_disabled=false WHERE id=$1'],
      ['password-change-required', 'UPDATE app_users SET must_change_password=true WHERE id=$1', 'UPDATE app_users SET must_change_password=false WHERE id=$1'],
      ['credential-epoch', 'UPDATE app_users SET password_changed_at=clock_timestamp() WHERE id=$1', 'UPDATE app_users SET password_changed_at=NULL WHERE id=$1'],
    ]) {
      const held = gate(), state = await flow(held.service), stable = await snapshot(), pending = assert.rejects(track(complete(state, held.service)), { code: 'plex_link_authorization_changed' });
      await held.ready; await observer.query(sql, [session.appUserId]); held.open(); await pending; assert.deepEqual(await snapshot(), stable); await observer.query(reset, [session.appUserId]); results.push('current-actor-' + name + '-refused-after-provider-work');
    }
    for (const [name, sql, reset] of [
      ['revoked', 'UPDATE refresh_tokens SET is_revoked=true WHERE id=$1', 'UPDATE refresh_tokens SET is_revoked=false WHERE id=$1'],
      ['rotated', 'UPDATE refresh_tokens SET replaced_by_refresh_token_id=id WHERE id=$1', 'UPDATE refresh_tokens SET replaced_by_refresh_token_id=NULL WHERE id=$1'],
      ['expired', "UPDATE refresh_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", "UPDATE refresh_tokens SET expires_at=clock_timestamp()+interval '1 day' WHERE id=$1"],
    ]) {
      const held = gate(), state = await flow(held.service), stable = await snapshot(), pending = assert.rejects(track(complete(state, held.service)), { code: 'plex_link_authorization_changed' });
      await held.ready; await observer.query(sql, [session.refreshTokenId]); held.open(); await pending; assert.deepEqual(await snapshot(), stable); await observer.query(reset, [session.refreshTokenId]); results.push('exact-session-' + name + '-refused-after-provider-work');
    }
    const competing = gate(2), concurrentKey = await flow(competing.service);
    const consumers = track(Promise.allSettled([complete(concurrentKey, competing.service), complete(concurrentKey, competing.service)])); await competing.ready; competing.open();
    const consumed = await consumers; assert.equal(consumed.filter(row => row.status === 'fulfilled').length, 1); assert.equal(await record(concurrentKey), null); results.push('two-concurrent-completions-one-consumer');
    const older = await flow(), newer = await flow(); await complete(newer); const linked = await snapshot(); await assert.rejects(complete(older), { code: 'plex_link_state_invalid' }); assert.deepEqual(await snapshot(), linked); results.push('newer-completed-link-invalidates-older-independent-flow');
    const stale = await flow(); await callbacks.clearLink({ session }); const cleared = await snapshot(); await assert.rejects(complete(stale), { code: 'plex_link_state_invalid' }); assert.deepEqual(await snapshot(), cleared); results.push('clear-invalidates-in-flight-link-even-when-unlinked');
    for (const kind of ['revision', 'cipher', 'replacement', 'deletion']) {
      const held = gate(), state = await flow(held.service), pending = assert.rejects(track(complete(state, held.service)), { code: 'plex_link_state_invalid' }); await held.ready;
      if (kind === 'revision') await observer.query('UPDATE encrypted_secrets SET updated_at=updated_at+interval \'1 microsecond\' WHERE name=$1', [ownerLinkStateName(state)]);
      if (kind === 'cipher') await rewrite(state, { pinId: '456' });
      if (kind === 'replacement') { const saved = await record(state); await secrets.setSecretValue({ secretType: 'integration_oauth', name: ownerLinkStateName(state), plaintextValue: secrets.decryptSecretRecord(saved), queryable: observer }); }
      if (kind === 'deletion') await observer.query('DELETE FROM encrypted_secrets WHERE name=$1', [ownerLinkStateName(state)]);
      const stable = await snapshot(); held.open(); await pending; assert.deepEqual(await snapshot(), stable); results.push('exact-state-' + kind + '-fence');
    }
    for (const event of ['plex_owner_link_started', 'plex_owner_link_completed', 'plex_owner_link_cleared']) {
      const state = event === 'plex_owner_link_completed' ? await flow() : null, stable = await snapshot();
      await trigger('audit_events', 'INSERT', `NEW.event_type='${event}'`, 'RETURN NULL;', async () => {
        if (event === 'plex_owner_link_started') {
          const response = await fetch(baseUrl + '/api/v1/providers/plex/link/start', { method: 'POST', headers: { cookie: cookies, 'x-csrf-token': csrf } });
          assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null); await response.json();
        } else await assert.rejects(event === 'plex_owner_link_completed' ? complete(state) : callbacks.clearLink({ session }), { status: 503 });
      }); assert.deepEqual(await snapshot(), stable); results.push('required-' + event + '-audit-rollback');
    }
    await complete(await flow());
    for (const event of ['INSERT', 'DELETE']) {
      const state = await flow(), stable = await snapshot();
      await trigger('encrypted_secrets', event, `${event === 'DELETE' ? 'OLD' : 'NEW'}.name='${ownerLinkTokenName}'`, 'RETURN NULL;', () => assert.rejects(complete(state), { status: 503 }));
      assert.deepEqual(await snapshot(), stable); results.push('suppressed-token-' + event.toLowerCase() + '-rolls-back-state-token-and-revision');
    }
    const expired = await flow(), expiresAt = new Date(Date.now() + 500).toISOString(); await rewrite(expired, { expiresAt }); const stableExpiry = await snapshot();
    const expiring = make({ commandOptions: { recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); await client.query('SELECT pg_sleep(GREATEST(0,EXTRACT(epoch FROM ($1::timestamptz-clock_timestamp())))+0.05)', [expiresAt]); } } });
    await assert.rejects(complete(expired, expiring), { status: 503 }); assert.deepEqual(await snapshot(), stableExpiry); results.push('final-state-expiry-rolls-back-all-publication');
    const sessionExpiryKey = await flow(), sessionExpiresAt = new Date(Date.now() + 500).toISOString();
    await observer.query('UPDATE refresh_tokens SET expires_at=$2 WHERE id=$1', [session.refreshTokenId, sessionExpiresAt]);
    const stableSessionExpiry = await snapshot();
    const expiringSession = make({ commandOptions: { recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); await client.query('SELECT pg_sleep(GREATEST(0,EXTRACT(epoch FROM ($1::timestamptz-clock_timestamp())))+0.05)', [sessionExpiresAt]); } } });
    await assert.rejects(complete(sessionExpiryKey, expiringSession), { status: 503 }); assert.deepEqual(await snapshot(), stableSessionExpiry);
    await observer.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()+interval '1 day' WHERE id=$1", [session.refreshTokenId]); results.push('final-parent-expiry-rolls-back-all-publication');
    const beforePrune = await snapshot(); await createPlexCallbackRetentionService().startPrune().result;
    const afterPrune = await snapshot(); assert.ok(!afterPrune.some(row => row.name === ownerLinkStateName(expired)));
    for (const name of [ownerLinkTokenName, ownerLinkRevisionName, 'providers.plex.link.client_identifier']) assert.deepEqual(afterPrune.filter(row => row.name === name), beforePrune.filter(row => row.name === name));
    results.push('automatic-retention-removes-expired-owner-state-preserves-permanent-secrets');
    const maintenance = createMaintenanceLockService(), maintenanceKey = await flow(), stableMaintenance = await snapshot();
    const maintenanceLock = await maintenance.acquireMaintenanceLock({ lockType: 'maintenance' });
    await withWorkerTaskCleanup(() => assert.rejects(complete(maintenanceKey), { status: 503 }), () => maintenance.releaseMaintenanceLock({ lockId: maintenanceLock.id }));
    assert.deepEqual(await snapshot(), stableMaintenance); results.push('active-maintenance-lock-refuses-publication');
    const admitted = Promise.withResolvers(), publish = Promise.withResolvers(); releases.add(publish);
    const heldCommit = make({ commandOptions: { recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); admitted.resolve(); await publish.promise; } } });
    const invisibleKey = await flow(), stableInvisible = await snapshot(), pendingCommit = track(complete(invisibleKey, heldCommit));
    await admitted.promise; assert.deepEqual(await snapshot(), stableInvisible);
    const inserting = track(createMaintenanceLockService({ getPoolFn: () => writer }).acquireMaintenanceLock({ lockType: 'restore' }));
    await until(async () => (await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [writer.processID])).rows[0]?.wait_event_type === 'Lock');
    publish.resolve(); releases.delete(publish); await pendingCommit; const inserted = await inserting;
    await maintenance.releaseMaintenanceLock({ lockId: inserted.id }); assert.equal(await record(invisibleKey), null); results.push('publication-invisible-before-commit-and-maintenance-insertion-waits');
    const lockKey = await flow(), stableLock = await snapshot();
    await writer.query('BEGIN'); await writer.query('SELECT pg_advisory_xact_lock($1::bigint)', [ownerLinkLockKey]);
    await withWorkerTaskCleanup(() => assert.rejects(complete(lockKey), { status: 503 }), () => writer.query('ROLLBACK'));
    assert.deepEqual(await snapshot(), stableLock); results.push('installation-lock-contention-is-bounded-and-rolls-back');
    let commits = 0;
    const uncertain = make({ commandOptions: { startTransactionFn: (work, settings) => startSessionWriteTransaction(work, { ...settings, getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client); client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('controlled acknowledgement loss'); } return value; }; return client;
    } }) }) } });
    const uncertainKey = await flow(); await assert.rejects(complete(uncertainKey, uncertain), { status: 503 }); assert.equal(commits, 1); assert.equal(await record(uncertainKey), null);
    const stableCommit = await snapshot(); await assert.rejects(complete(uncertainKey), { code: 'plex_link_state_invalid' }); assert.deepEqual(await snapshot(), stableCommit); results.push('real-commit-ack-loss-publishes-once-without-retry');
    const timedKey = await flow(), stableTimed = await snapshot(); let task, pid;
    await trigger('audit_events', 'INSERT', "NEW.event_type='plex_owner_link_completed'", 'PERFORM pg_sleep(30);', async () => {
      const timed = make({ commandOptions: { startTransactionFn: (work, settings) => { task = startSessionWriteTransaction(async (client, check) => {
        pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check);
      }, { ...settings, timeoutMs: 1_000 }); return task; } } });
      const refused = assert.rejects(track(complete(timedKey, timed)), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await snapshot(), stableTimed);
    }); results.push('deadline-rolls-back-and-awaits-actual-backend-retirement');
  }, async () => {
    for (const release of releases) release.resolve(); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => Promise.allSettled([observer.end(), writer.end()]), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, browserBound: true, exactCurrentAuthority: true, singleUse: true, atomicPublication: true,
    exactRecordFence: true, revisionFenced: true, controlledProviderTransport: true, commitLossControlled: true, actualBackendRetirement: true }));
});
