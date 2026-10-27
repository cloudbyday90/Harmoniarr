/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { createSystemModule } from '/app/server-dist/system-module.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createBootstrapAdmin } from '/app/server-dist/auth.js';
import { recordAuditEvent } from '/app/server-dist/audit.js';
import { createMaintenanceLockService } from '/app/server-dist/recovery/maintenance-lock-service.js';
import { createPlexCallbackRetentionService } from '/app/server-dist/integrations/plex/plex-callback-retention-service.js';
import { createPlexCallbackMaintenanceService } from '/app/server-dist/integrations/plex/plex-callback-maintenance-service.js';
import { plexCallbackRetentionLockKey, plexCallbackRetentionNamePattern } from '/app/server-dist/integrations/plex/plex-callback-retention-policy.js';
import { plexCallbackSecretName, plexClientIdentifierName } from '/app/server-dist/integrations/plex/plex-callback-policy.js';
import { createPlexDirectSignInService } from '/app/server-dist/integrations/plex/plex-direct-sign-in-service.js';
import { createPlexHttpClient } from '/app/server-dist/integrations/plex/plex-http-client.js';
import { readLinkedPlexLoginUser } from '/app/server-dist/linked-login-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { createStartupServiceSupervisor } from '/app/server-dist/startup-service-supervisor.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createPlexResponseTransport } from '../../testing/server/plex-response-transport.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('Plex callback retention is bounded, maintenance-guarded, atomic and safe beside active completion', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), writer = new pg.Client(buildConnectionConfig());
  const secrets = createEncryptedSecretService(), results = [], active = new Set(), releases = new Set();
  let runtime, app;
  const expiry = async offset => (await observer.query('SELECT clock_timestamp()+$1::interval AS value', [offset])).rows[0].value.toISOString();
  const count = async name => Number((await observer.query('SELECT count(*) FROM encrypted_secrets WHERE secret_type=$1 AND name=$2', ['integration_oauth', name])).rows[0].count);
  const audits = async () => (await observer.query("SELECT details FROM audit_events WHERE event_type='plex_callback_state_pruned' ORDER BY occurred_at,id")).rows;
  const clear = () => observer.query('DELETE FROM encrypted_secrets WHERE secret_type=$1 AND name ~ $2', ['integration_oauth', plexCallbackRetentionNamePattern]);
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  async function until(check) {
    const deadline = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, 'Retention observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  async function ready(promise) {
    t.signal.throwIfAborted(); let abort;
    try { await Promise.race([promise, new Promise((_, reject) => { abort = () => { reject(t.signal.reason); }; t.signal.addEventListener('abort', abort, { once: true }); })]); }
    finally { t.signal.removeEventListener('abort', abort); }
  }
  async function seed(plaintext, { age = '2 days', name = plexCallbackSecretName(randomUUID()), type = 'integration_oauth', metadata = null } = {}) {
    await secrets.setSecretValue({ secretType: type, name, plaintextValue: plaintext, metadata, queryable: observer });
    await observer.query('UPDATE encrypted_secrets SET created_at=clock_timestamp()-$3::interval,updated_at=clock_timestamp()-$3::interval WHERE secret_type=$1 AND name=$2', [type, name, age]);
    return name;
  }
  const expired = async () => JSON.stringify({ version: 1, expiresAt: await expiry('-1 minute') });
  const unexpired = async () => JSON.stringify({ version: 1, expiresAt: await expiry('1 hour') });
  async function prune(options) {
    const task = createPlexCallbackRetentionService(options).startPrune(), result = track(task.result);
    return withWorkerTaskCleanup(() => result, async () => { assert.equal(await task.drained, true); });
  }
  function gate() {
    const entered = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    const service = createPlexCallbackRetentionService({ recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); entered.resolve(); await release.promise; } });
    return { service, entered: entered.promise, open: () => { release.resolve(); releases.delete(release); } };
  }
  async function trigger(table, timing, body, work) {
    await observer.query(`CREATE FUNCTION fixture_retention_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END $$;
      CREATE TRIGGER fixture_retention_trigger ${timing} ON ${table} FOR EACH ROW EXECUTE FUNCTION fixture_retention_trigger()`);
    return withWorkerTaskCleanup(work, () => observer.query(`DROP TRIGGER fixture_retention_trigger ON ${table}; DROP FUNCTION fixture_retention_trigger()`));
  }
  await withWorkerTaskCleanup(async () => {
    await observer.connect(); await writer.connect();
    const clientIdentifier = await seed('retention-fixture-client', { name: plexClientIdentifierName });
    const unrelated = await seed('unrelated', { name: 'auth.other.pending.' + randomUUID() });
    const otherType = await seed(await expired(), { type: 'provider_credentials' });
    const expected = [await seed(await expired(), { metadata: { version: 1, expiresAt: await expiry('1 day') } }), await seed('{}'), await seed('malformed'), await seed('{"version":1,"expiresAt":"invalid"}')];
    const activeName = await seed(await unexpired(), { metadata: { version: 1, expiresAt: await expiry('-1 day') } });
    const recent = await seed('{}', { age: '1 minute' }), unknown = await seed('{"version":2,"expiresAt":"2000-01-01T00:00:00.000Z"}');
    const unreadable = await seed('{}'), oversized = await seed('{}');
    await observer.query('UPDATE encrypted_secrets SET encrypted_value=$2 WHERE name=$1', [unreadable, Buffer.from('bad cipher')]);
    await observer.query('UPDATE encrypted_secrets SET encrypted_value=$2 WHERE name=$1', [oversized, Buffer.alloc(17 * 1024)]);
    const first = await prune(); assert.equal(first.deletedCount, 4); assert.equal(first.inspectedCount, 9);
    for (const name of expected) assert.equal(await count(name), 0);
    for (const name of [clientIdentifier, unrelated, activeName, recent, unknown, unreadable, oversized]) assert.equal(await count(name), 1);
    assert.equal(Number((await observer.query('SELECT count(*) FROM encrypted_secrets WHERE secret_type=$1 AND name=$2', ['provider_credentials', otherType])).rows[0].count), 1);
    const audit = (await audits())[0].details; assert.deepEqual(audit, { inspectedCount: 9, deletedCount: 4, expiredCount: 1, legacyCount: 3 });
    results.push('payload-expiry-legacy-grace-namespace-isolation-unknown-unreadable-and-private-audit');

    await clear();
    const names = [1, 2, 3].map(index => plexCallbackSecretName('00000000-0000-4000-8000-' + String(index).padStart(12, '0')));
    await seed(await unexpired(), { name: names[0] }); await seed(await unexpired(), { name: names[1] }); await seed(await expired(), { name: names[2] });
    const bounded = createPlexCallbackRetentionService({ batchSize: 2 });
    assert.equal((await bounded.startPrune().result).deletedCount, 0); assert.equal(await count(names[2]), 1);
    assert.equal((await bounded.startPrune().result).deletedCount, 1); assert.equal((await bounded.startPrune().result).inspectedCount, 2);
    results.push('bounded-keyset-progress-past-active-rows-and-wrap');

    await clear(); const locked = await seed(await expired());
    await writer.query('BEGIN'); await writer.query('SELECT id FROM encrypted_secrets WHERE name=$1 FOR UPDATE', [locked]);
    assert.equal((await prune()).deletedCount, 0); assert.equal(await count(locked), 1); await writer.query('ROLLBACK');
    assert.equal((await prune()).deletedCount, 1); results.push('locked-callback-record-skipped-and-revisited');

    await writer.query('BEGIN'); await writer.query('SELECT pg_advisory_xact_lock($1::bigint)', [plexCallbackRetentionLockKey]);
    assert.deepEqual(await prune(), { skipped: true, reason: 'busy' }); await writer.query('ROLLBACK'); results.push('cross-process-retention-claim-is-nonwaiting');

    const maintenance = createMaintenanceLockService({ getPoolFn: () => observer });
    const protectedName = await seed(await expired()), lock = await maintenance.acquireMaintenanceLock({ lockType: 'maintenance' });
    await assert.rejects(prune(), { code: 'plex_callback_retention_unavailable' }); assert.equal(await count(protectedName), 1);
    await maintenance.releaseMaintenanceLock({ lockId: lock.id }); results.push('active-maintenance-lock-refuses-retention');

    const held = gate(), task = held.service.startPrune(), pruning = track(task.result); await ready(held.entered);
    assert.equal(await count(protectedName), 1);
    const beforeAudit = (await audits()).length;
    const inserting = track(createMaintenanceLockService({ getPoolFn: () => writer }).acquireMaintenanceLock({ lockType: 'restore' }));
    await until(async () => (await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [writer.processID])).rows[0]?.wait_event_type === 'Lock');
    held.open(); await pruning; await task.drained; const inserted = await inserting;
    assert.equal(await count(protectedName), 0); assert.equal((await audits()).length, beforeAudit + 1);
    await maintenance.releaseMaintenanceLock({ lockId: inserted.id }); results.push('maintenance-insertion-waits-for-atomic-delete-and-required-audit');

    const failureName = await seed(await expired()), auditBefore = (await audits()).length;
    await assert.rejects(prune({ recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); throw new Error('fixture audit failure'); } }), { status: 503 });
    assert.equal(await count(failureName), 1); assert.equal((await audits()).length, auditBefore); await prune();
    results.push('audit-failure-rolls-back-deletion-and-explicit-retry');

    const suppressed = await seed(await expired());
    await trigger('encrypted_secrets', 'BEFORE DELETE', 'RETURN NULL;', async () => { await assert.rejects(prune(), { status: 503 }); assert.equal(await count(suppressed), 1); });
    results.push('suppressed-deletion-refuses-publication');
    await trigger('audit_events', 'BEFORE INSERT', "IF NEW.event_type='plex_callback_state_pruned' THEN RETURN NULL; END IF; RETURN NEW;", async () => { await assert.rejects(prune(), { status: 503 }); assert.equal(await count(suppressed), 1); });
    results.push('suppressed-required-audit-restores-state'); await prune();

    const replaced = await seed(await expired()), replacingGate = gate(), replaceTask = replacingGate.service.startPrune();
    const replacing = track(replaceTask.result); await ready(replacingGate.entered);
    const replacement = track(secrets.setSecretValue({ secretType: 'integration_oauth', name: replaced, plaintextValue: await unexpired(), queryable: writer }));
    await until(async () => (await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [writer.processID])).rows[0]?.wait_event_type === 'Lock');
    replacingGate.open(); await replacing; await replacement; await replaceTask.drained;
    assert.equal(await count(replaced), 1); assert.equal((await prune()).deletedCount, 0); results.push('concurrent-replacement-survives-after-owned-expired-row-deletion');

    await clear(); const uncertainName = await seed(await expired()); let commits = 0;
    const uncertain = createPlexCallbackRetentionService({ startTransactionFn: (work, options) => startSessionWriteTransaction(work, { ...options, getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client), release = client.release;
      client.query = async (...args) => { const result = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost acknowledgement'); } return result; };
      client.release = function (...args) { client.release = release; return Reflect.apply(release, this, args); }; return client;
    } }) }) });
    const uncertainTask = uncertain.startPrune(); await assert.rejects(uncertainTask.result, { status: 503 }); assert.equal(await uncertainTask.drained, true);
    assert.equal(commits, 1); assert.equal(await count(uncertainName), 0); assert.equal((await prune()).deletedCount, 0);
    results.push('real-commit-controlled-ack-loss-has-no-automatic-repeat');

    const timedName = await seed(await expired()); let pid, timedTask;
    await trigger('audit_events', 'BEFORE INSERT', "IF NEW.event_type='plex_callback_state_pruned' THEN PERFORM pg_sleep(30); END IF; RETURN NEW;", async () => {
      const timed = createPlexCallbackRetentionService({ startTransactionFn: (work, options) => startSessionWriteTransaction(async (client, check) => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check); }, { ...options, timeoutMs: 300 }) });
      timedTask = timed.startPrune(); await assert.rejects(timedTask.result, { status: 503 }); assert.equal(await timedTask.drained, true);
      await until(async () => (await observer.query('SELECT count(*)::int AS total FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0].total === 0);
      assert.equal(await count(timedName), 1);
    }); await prune(); results.push('deadline-rollback-and-actual-postgres-backend-retirement');

    await createBootstrapAdmin({ username: 'retention-admin', password: 'PublicRetentionFixture123!', requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'native-retention' } });
    await observer.query("UPDATE app_users SET auth_provider='plex',auth_subject='retention-subject' WHERE username='retention-admin'");
    const admitted = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    const callbacks = createPlexDirectSignInService({ loadSettingsFn: async () => ({ system: { baseUrl: 'http://127.0.0.1:3000' } }),
      findLinkedUserFn: async input => { const user = await readLinkedPlexLoginUser(input); admitted.resolve(); await release.promise; return user; },
      plexHttpClient: createPlexHttpClient({ transport: createPlexResponseTransport(async url => { const path = new URL(url).pathname; return Response.json(path === '/api/v2/pins' ? { id: 123, code: 'fixture-pin' } : path.startsWith('/api/v2/pins/') ? { authToken: 'fixture-token' } : { uuid: 'retention-subject', restricted: false }); }) }) });
    const browserBinding = Buffer.alloc(32, 1).toString('base64url'), started = await callbacks.startSignIn({ browserBinding });
    const state = new URL(new URLSearchParams(started.authorizationUrl.split('#?')[1]).get('forwardUrl')).searchParams.get('state');
    const completing = track(callbacks.completeSignIn({ state, browserBinding })); await ready(admitted.promise);
    assert.equal((await prune()).deletedCount, 0); assert.equal(await count(plexCallbackSecretName(state)), 1);
    release.resolve(); releases.delete(release); assert.ok((await completing).issuedSession.refreshToken); assert.equal(await count(plexCallbackSecretName(state)), 0);
    results.push('active-prepared-provider-callback-survives-cleanup-and-completes-once');

    await clear(); const automaticName = await seed(await expired());
    const automatic = createPlexCallbackMaintenanceService();
    app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
      createSystemModule: options => createSystemModule({ ...options, plexCallbackMaintenanceService: automatic }) });
    let registered = false;
    runtime = await startServerRuntime({ createApp: () => app, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} }, startBackgroundServices: true,
      createStartupServiceSupervisor: options => { const supervisor = createStartupServiceSupervisor(options); return { ...supervisor, registerService: service => { if (service === automatic) { registered = true; supervisor.registerService(service); } } }; } });
    assert.equal(registered, true); await until(async () => await count(automaticName) === 0);
    await automatic.stopAndDrain(); assert.equal((await automatic.tick()).skipped, true);
    results.push('actual-runtime-registration-automatic-startup-pass-and-owned-shutdown');
  }, async () => {
    for (const release of releases) release.resolve();
    await Promise.allSettled([...active]);
    await writer.query('ROLLBACK').catch(() => {});
    await runtime?.startupServiceSupervisor.shutdown({ onShutdown: async () => { runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); } });
    if (app) await drainApplicationWorkerOwners(app);
    await Promise.allSettled([observer.end(), writer.end()]); await closePool();
  });
  t.diagnostic(JSON.stringify({ results, boundedBatch: true, activeFlowsPreserved: true, maintenanceOwnership: true,
    requiredAuditAtomic: true, commitLossControlled: true, actualBackendRetirement: true, automaticLifecycle: true }));
});
