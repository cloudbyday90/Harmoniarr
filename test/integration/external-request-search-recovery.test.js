import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedExternalDiscoveryLifetimeRun, createExternalDiscoveryHttpFixture } from '../../testing/integration/external-request-discovery-lifetime-fixture.js';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { createAppUserService } from '../../src/server/app-user-service.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createLibraryExternalRequestDiscoveryModule } from '../../src/server/library/library-external-request-discovery-module.js';
import { createLibraryExternalRequestDiscoveryRunStore } from '../../src/server/library/library-external-request-discovery-run-store.js';
import { createLibraryExternalRequestReviewStore } from '../../src/server/library/library-external-request-review-store.js';
import { createLibraryExternalRequestSearchRecoveryService } from '../../src/server/library/library-external-request-search-recovery-service.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { buildDiscoverySearchQuery } from '../../src/server/library/library-discovery-search-query.js';
import { createSlskdSearchContinuationService } from '../../src/server/slskd/slskd-search-continuation-service.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const path = f => `/api/v1/library/media-requests/${f.request.id}/external-review/intents/${f.intent.id}/search-again`;
const reviewPath = f => `/api/v1/library/media-requests/${f.request.id}/external-review`;
const expired = 'slskd_search_continuation_expired';
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function scenario(run) {
  await runtime.runScenario(async context => {
    const admin = (await bootstrapAdminSession(context.client)).payload.user;
    await run({ ...context, admin, pool: context.getPoolFn(), fixture: await seedExternalDiscoveryLifetimeRun() });
  });
}
async function failRun(c, code = expired, status = 'failed') {
  await c.pool.query(`UPDATE operation_runs SET status=$2,finished_at=NOW(),summary=summary||jsonb_build_object('failureCode',$3::text)
    WHERE id=$1`, [c.fixture.run.id, status, code]);
}
function recover(c, key, expectedOperationRunId = c.fixture.run.id, options = {}) {
  return c.client.requestJson(path(c.fixture), { method: 'POST', headers: { 'idempotency-key': key },
    json: { expectedOperationRunId }, ...options });
}
function service(c, overrides = {}) {
  return createLibraryExternalRequestSearchRecoveryService({ reviewStore: createLibraryExternalRequestReviewStore(),
    mediaRequestStore: createLibraryMediaRequestStore(), discoveryRunStore: createLibraryExternalRequestDiscoveryRunStore(),
    getAppUserById: createAppUserService().getAppUserById, assertMaintenanceWriteAllowed: async () => {}, ...overrides });
}
const command = c => ({ mediaRequestId: c.fixture.request.id, intentId: c.fixture.intent.id,
  expectedOperationRunId: c.fixture.run.id, actorUserId: c.admin.id });
async function assertRunCount(c, count) {
  assert.equal((await c.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type='library_external_request_discovery'")).rows[0].count, count);
}
async function waitForBlocked(c, pid, signal) {
  await withFixturePostgresObserver({ connectionConfig: c.databaseConfig, signal }, async observer => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      await observer.query('SELECT pg_stat_clear_snapshot()');
      if ((await observer.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
        AND $1::int=ANY(pg_blocking_pids(pid))) AS blocked`, [pid])).rows[0].blocked) return;
      await new Promise(done => { setTimeout(done, 20); });
    }
    assert.fail('The real database contender must be observed waiting before releasing its owner');
  });
}

suite('approved external search recovery with PostgreSQL, sessions and native HTTP', () => {
  before(async () => { runtime = await createIntegrationAppRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('published empty searches enforce durable cooldown and two fresh commands across expiry, replay and retries', { timeout: config.scenarioTimeoutMs }, async t => scenario(async c => {
    const f = c.fixture; const provider = await createExternalDiscoveryHttpFixture({ signal: t.signal, empty: true });
    const module = createLibraryExternalRequestDiscoveryModule({ slskdService: provider.service,
      importCandidateService: createImportCandidateService({ pool: c.pool, slskdService: provider.service }),
      getAppUserById: createAppUserService().getAppUserById, reviewStore: createLibraryExternalRequestReviewStore(),
      mediaRequestStore: createLibraryMediaRequestStore() });
    const worker = module.libraryExternalRequestDiscoveryWorker;
    const run = async runId => {
      const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['library_external_request_discovery'] });
      assert.equal(claimed?.id, runId);
      await (await worker.startWorkerRun({ intentId: f.intent.id,
        mediaRequestId: f.request.id, runId, triggeredByUserId: c.admin.id })).completion;
    };
    const policy = async () => (await c.client.requestJson(reviewPath(f))).payload.intents[0].searchRecovery;
    const ageObservation = () => c.pool.query(`UPDATE library_external_request_release_intents
      SET last_empty_search_at=clock_timestamp()-interval '6 hours 1 second' WHERE id=$1`, [f.intent.id]);
    return withWorkerTaskCleanup(async () => {
      provider.release(); await run(f.run.id);
      const first = (await c.pool.query('SELECT status,summary FROM operation_runs WHERE id=$1', [f.run.id])).rows[0];
      assert.equal(first.status, 'failed'); assert.equal(first.summary.searchOutcome, 'published_empty');
      assert.equal(first.summary.candidateCount, 0);
      assert.equal((await policy()).policy.blockedReason, 'cooldown');
      assert.equal((await policy()).canSearchAgain, false);
      assert.equal((await recover(c, 'early')).payload.error.code, 'external_request_search_cooldown');
      await assertRunCount(c, 1);
      const observation = (await c.pool.query('SELECT last_empty_search_at FROM library_external_request_release_intents WHERE id=$1', [f.intent.id])).rows[0].last_empty_search_at;
      // Ordinary retry reads the same saved provider search and cannot reset its observation.
      await createOperationRunControlService().requestOperationRunRetry({ runId: f.run.id });
      await run(f.run.id);
      assert.equal((await c.pool.query('SELECT last_empty_search_at FROM library_external_request_release_intents WHERE id=$1', [f.intent.id])).rows[0].last_empty_search_at.toISOString(), observation.toISOString());
      assert.equal(provider.queries.length, 1);
      // A later missing saved search cannot bypass a prior empty-search cooldown.
      provider.removeSearch();
      await createOperationRunControlService().requestOperationRunRetry({ runId: f.run.id });
      await run(f.run.id);
      assert.equal((await recover(c, 'early-expired')).payload.error.code, 'external_request_search_cooldown');
      await ageObservation();
      assert.equal((await policy()).canSearchAgain, true);
      const replies = await Promise.all([recover(c, 'fresh-one'), recover(c, 'fresh-duplicate')]);
      assert.deepEqual(replies.map(reply => reply.response.status), [202, 202]);
      const secondRunId = replies[0].payload.searchRecovery.operationRunId;
      assert.equal(secondRunId, replies[1].payload.searchRecovery.operationRunId);
      await assertRunCount(c, 2);
      await run(secondRunId);
      assert.equal((await policy()).policy.remainingSearches, 1);
      assert.equal((await policy()).policy.blockedReason, 'cooldown');
      assert.equal((await recover(c, 'fresh-one')).response.status, 202);
      assert.equal((await recover(c, 'terminal-predecessor')).payload.searchRecovery.operationRunId, secondRunId);
      await ageObservation();
      const third = await recover(c, 'fresh-two', secondRunId); assert.equal(third.response.status, 202);
      const thirdRunId = third.payload.searchRecovery.operationRunId; await run(thirdRunId);
      await ageObservation();
      assert.equal((await policy()).policy.blockedReason, 'exhausted');
      assert.equal((await policy()).policy.remainingSearches, 0);
      assert.equal((await policy()).canSearchAgain, false);
      assert.equal((await recover(c, 'exhausted', thirdRunId)).payload.error.code, 'external_request_search_exhausted');
      assert.equal((await recover(c, 'fresh-two', secondRunId)).response.status, 202);
      assert.equal((await recover(c, 'terminal-final-replay', secondRunId)).payload.searchRecovery.operationRunId, thirdRunId);
      await assertRunCount(c, 3);
      assert.equal(provider.queries.length, 3);
      assert.equal((await c.pool.query('SELECT count(*)::int AS n FROM slskd_search_intents WHERE external_request_intent_id=$1', [f.intent.id])).rows[0].n, 3);
      assert.equal((await c.pool.query("SELECT count(*)::int AS n FROM audit_events WHERE event_type='external_request_search_again_requested'")).rows[0].n, 2);
      assert.equal((await c.pool.query('SELECT count(*)::int AS n FROM import_candidates')).rows[0].n, 0);
    }, async () => { await worker.close(); await provider.close(); });
  }));

  for (const code of [expired, 'slskd_search_continuation_unavailable']) {
    test(`${code}: explicit concurrent commands queue one fresh provider search and retain both reservations`, { timeout: config.scenarioTimeoutMs }, async t => scenario(async c => {
      const f = c.fixture; const provider = await createExternalDiscoveryHttpFixture({ signal: t.signal });
      let now = new Date();
      const continuation = createSlskdSearchContinuationService({ slskdService: provider.service, getNow: () => now, expiresAfterMs: 1000 });
      const module = createLibraryExternalRequestDiscoveryModule({ slskdService: provider.service, searchContinuationService: continuation,
        importCandidateService: createImportCandidateService({ pool: c.pool, slskdService: provider.service }),
        getAppUserById: createAppUserService().getAppUserById, reviewStore: createLibraryExternalRequestReviewStore(),
        mediaRequestStore: createLibraryMediaRequestStore(), getReleaseTracklistExpectationsFn: async () => ({ expectedTrackCount: 1, expectedTrackTitles: ['Foil'] }) });
      const worker = module.libraryExternalRequestDiscoveryWorker;
      return withWorkerTaskCleanup(async () => {
        const first = await continuation.getOrStartSearch({ owner: { externalRequestIntentId: f.intent.id },
          query: buildDiscoverySearchQuery({ artistName: f.intent.artistName, releaseTitle: f.intent.releaseTitle }),
          context: { operationRunId: f.run.id, mediaRequestId: f.request.id, metadataReleaseId: f.intent.metadataReleaseId,
            requestedForUserId: f.recipientId }, assertCurrent: async () => {} });
        if (code === expired) now = new Date(now.getTime() + 1001); else provider.removeSearch();
        await (await worker.startWorkerRun({ intentId: f.intent.id, mediaRequestId: f.request.id, runId: f.run.id, triggeredByUserId: c.admin.id })).completion;
        const failed = (await c.pool.query('SELECT status,summary,error_message FROM operation_runs WHERE id=$1', [f.run.id])).rows[0];
        assert.equal(failed.status, 'failed'); assert.equal(failed.summary.failureCode, code);
        assert.match(failed.error_message, /Choose Search again/);
        const review = await c.client.requestJson(reviewPath(f)); assert.equal(review.response.status, 200);
        assert.equal(review.payload.intents[0].searchRecovery.canSearchAgain, true);
        const results = await Promise.all([recover(c, 'first-intent'), recover(c, 'second-intent')]);
        assert.ok(results.every(result => result.response.status === 202), JSON.stringify(results.map(result => result.payload)));
        const outcomes = results.map(result => result.payload.searchRecovery);
        assert.deepEqual(outcomes.map(outcome => outcome.reusedExistingRun).sort(), [false, true]);
        assert.equal(outcomes[0].operationRunId, outcomes[1].operationRunId);
        assert.deepEqual((await recover(c, 'first-intent')).payload, results[0].payload);
        assert.equal((await recover(c, 'first-intent', randomUUID())).payload.error.code, 'idempotency_key_payload_mismatch');
        const newRunId = outcomes[0].operationRunId; assert.notEqual(newRunId, f.run.id);
        await assertRunCount(c, 2);
        assert.equal(provider.requests.filter(request => request.method === 'POST').length, 1, 'Only the worker can submit the replacement search');
        assert.equal((await c.client.requestJson(`/api/v1/operations/runs/${f.run.id}/retry`, { method: 'POST' })).response.status, 409);
        provider.release();
        await (await worker.startWorkerRun({ intentId: f.intent.id, mediaRequestId: f.request.id, runId: newRunId, triggeredByUserId: c.admin.id, triggerSource: 'operator_search_recovery' })).completion;
        const current = (await c.pool.query('SELECT status,summary FROM operation_runs WHERE id=$1', [newRunId])).rows[0];
        assert.equal(current.status, 'completed'); assert.equal(current.summary.searchRecoveryOfRunId, f.run.id);
        assert.equal(current.summary.candidateCount, 1);
        const candidate = (await c.pool.query('SELECT status,normalized_payload FROM import_candidates WHERE source_search_id=$1', [current.summary.searchId])).rows[0];
        assert.equal(candidate.status, 'pending');
        assert.equal(candidate.normalized_payload.requestOwnership.externalRequestReleaseIntentId, f.intent.id);
        assert.equal(candidate.normalized_payload.requestOwnership.sourceRequestedForUserId, f.recipientId);
        assert.equal(candidate.normalized_payload.requestOwnership.sourceMediaRequestId, f.request.id);
        assert.notEqual(current.summary.searchId, first.id);
        const reservations = (await c.pool.query('SELECT id FROM slskd_search_intents WHERE external_request_intent_id=$1', [f.intent.id])).rows;
        assert.equal(reservations.length, 2); assert.ok(reservations.some(row => row.id === first.id));
        assert.equal(provider.requests.filter(request => request.method === 'POST').length, 2);
        const replay = await recover(c, 'another-key'); assert.equal(replay.response.status, 202);
        assert.equal(replay.payload.searchRecovery.operationRunId, newRunId); await assertRunCount(c, 2);
        assert.equal((await c.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='external_request_search_again_requested'")).rows[0].count, 1);
      }, () => withWorkerTaskCleanup(() => worker.close(), () => provider.close()));
    }));
  }

  test('authorization, current eligibility, expected run and terminal state refuse new work', { timeout: config.scenarioTimeoutMs }, async () => scenario(async c => {
    const f = c.fixture; await failRun(c);
    await c.client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
    const guest = createSessionHttpClient(c.baseUrl);
    assert.equal((await guest.requestJson(path(f), { method: 'POST' })).response.status, 401);
    const requester = await c.client.requestJson('/api/v1/users', { method: 'POST', json: { username: 'recovery-outsider', password: 'RecoveryTestPass123!', role: 'requester' } });
    assert.equal(requester.response.status, 201);
    await c.pool.query('UPDATE app_users SET must_change_password=false WHERE id=$1', [requester.payload.user.id]);
    const outsider = createSessionHttpClient(c.baseUrl); await loginWithPassword(outsider, { username: 'recovery-outsider', password: 'RecoveryTestPass123!' });
    assert.equal((await outsider.requestJson(path(f), { method: 'POST' })).response.status, 403);
    assert.equal((await recover(c, 'csrf-refusal', f.run.id, { csrf: false })).response.status, 403);
    assert.equal((await c.client.requestJson(path(f), { method: 'POST', json: { expectedOperationRunId: f.run.id } })).payload.error.code, 'idempotency_key_required');
    assert.equal((await recover(c, 'invalid', 'not-a-uuid')).response.status, 400);
    await c.pool.query('UPDATE app_users SET must_change_password=true WHERE id=$1', [c.admin.id]);
    assert.equal((await recover(c, 'fresh')).payload.error.code, 'reauth_required');
    await c.pool.query('UPDATE app_users SET must_change_password=false WHERE id=$1', [c.admin.id]);
    assert.equal((await recover(c, 'stale', randomUUID())).response.status, 409);
    await c.pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [f.recipientId]);
    assert.equal((await recover(c, 'disabled')).payload.error.code, 'media_request_target_ineligible');
    assert.equal((await c.client.requestJson(reviewPath(f))).payload.intents[0].searchRecovery.canSearchAgain, false);
    await c.pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [f.recipientId]);
    await c.pool.query('UPDATE media_requests SET requested_for_user_id=$2 WHERE id=$1', [f.request.id, requester.payload.user.id]);
    assert.equal((await recover(c, 'target-changed')).response.status, 409);
    await c.pool.query('UPDATE media_requests SET requested_for_user_id=$2 WHERE id=$1', [f.request.id, f.recipientId]);
    const lock = await c.pool.query("INSERT INTO maintenance_locks(lock_type,status,reason,acquired_at) VALUES ('maintenance','active','Synthetic recovery test',NOW()) RETURNING id");
    assert.equal((await recover(c, 'maintenance')).payload.error.code, 'recovery_lock_conflict');
    await c.pool.query('DELETE FROM maintenance_locks WHERE id=$1', [lock.rows[0].id]);
    const other = await createLibraryMediaRequestStore().createMediaRequest({ requestKind: 'external_url', requestState: 'needs_fetch',
      requestedByUserId: c.admin.id, requestedForUserId: requester.payload.user.id, sourceProvider: 'spotify',
      sourceUrl: 'https://open.spotify.com/album/other123', normalizedQuery: 'separate external request' });
    assert.equal((await c.client.requestJson(path({ request: other, intent: f.intent }), { method: 'POST',
      headers: { 'idempotency-key': 'cross-request' }, json: { expectedOperationRunId: f.run.id } })).response.status, 404);
    for (const status of ['pending','running','completed','cancelled']) {
      await failRun(c, expired, status); assert.equal((await recover(c, status)).response.status, 409);
    }
    await failRun(c, 'external_request_discovery_no_candidates');
    assert.equal((await recover(c, 'no-candidates')).response.status, 409);
    assert.equal((await c.client.requestJson(`/api/v1/library/media-requests/${f.request.id}/cancel`, { method: 'POST' })).response.status, 200);
    assert.equal((await recover(c, 'inactive')).payload.error.code, 'external_request_inactive');
    await assertRunCount(c, 1);
  }));

  test('required audit failure rolls back replacement run, intent pointer and old-run supersession', { timeout: config.scenarioTimeoutMs }, async () => scenario(async c => {
    await failRun(c); const failure = new Error('controlled required audit failure');
    await c.pool.query(`UPDATE library_external_request_release_intents SET last_empty_search_run_id=$2,
      last_empty_search_at=clock_timestamp()-interval '7 hours' WHERE id=$1`, [c.fixture.intent.id, c.fixture.run.id]);
    await assert.rejects(service(c, { recordAuditEventFn: async () => { throw failure; } }).searchAgain(command(c)), error => error === failure);
    await assertRunCount(c, 1);
    const intent = await createLibraryExternalRequestReviewStore().getIntentById({ intentId: c.fixture.intent.id });
    assert.equal(intent.operationRunId, c.fixture.run.id);
    assert.equal(intent.emptySearchRecoveryCount, 0);
    assert.equal((await c.pool.query('SELECT summary FROM operation_runs WHERE id=$1', [c.fixture.run.id])).rows[0].summary.externalSearchSuperseded, undefined);
    assert.equal((await recover(c, 'after-rollback')).response.status, 202); await assertRunCount(c, 2);
    assert.equal((await createLibraryExternalRequestReviewStore().getIntentById({ intentId: c.fixture.intent.id })).emptySearchRecoveryCount, 1);
  }));

  test('a stale ordinary Retry waiting behind recovery is refused by the changed row at UPDATE', { timeout: config.scenarioTimeoutMs }, async t => scenario(async c => {
    await failRun(c); const held = deferred(); const release = deferred(); let pid; let recovery; let retry;
    const base = createDatabaseTransactionRunner();
    const owned = service(c, { withTransaction: work => base(async queryable => {
      pid = (await queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const result = await work(queryable); held.resolve(); await release.promise; return result;
    }) });
    try {
      recovery = owned.searchAgain(command(c)); await Promise.race([held.promise, recovery.then(() => assert.fail('Recovery should be held'), error => { throw error; })]);
      retry = createOperationRunControlService().requestOperationRunRetry({ runId: c.fixture.run.id }).then(() => assert.fail('A superseded run cannot be retried'), error => error);
      await waitForBlocked(c, pid, t.signal);
      release.resolve(); await recovery;
      assert.equal((await retry).code, 'operation_run_not_retryable');
      assert.equal(await createOperationQueueStore().scheduleRetry({ runId: c.fixture.run.id }), null);
      await assertRunCount(c, 2);
    } finally { release.resolve(); await Promise.allSettled([recovery, retry].filter(Boolean)); }
  }));

  test('a recipient disabled during the eligibility-lock wait is reread before queuing any replacement', { timeout: config.scenarioTimeoutMs }, async t => scenario(async c => {
    await failRun(c); let pending;
    await withWorkerTaskCleanup(() => withRollbackFixtureClient(c.pool, async writer => {
      await writer.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [c.fixture.recipientId]);
      const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      pending = service(c).searchAgain(command(c)).then(result => ({ result }), error => ({ error }));
      await waitForBlocked(c, pid, t.signal);
      await writer.query('COMMIT');
      assert.equal((await pending).error?.code, 'media_request_target_ineligible');
    }), async () => { await pending; });
    await assertRunCount(c, 1);
    assert.equal((await c.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='external_request_search_again_requested'")).rows[0].count, 0);
  }));
});
