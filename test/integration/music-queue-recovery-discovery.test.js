/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createMusicQueueRecoveryService } from '../../src/server/import-candidates/music-queue-recovery-service.js';
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createLibraryMusicQueueRecoveryDiscoveryService } from '../../src/server/library/library-music-queue-recovery-discovery-service.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture, recoverMusicQueueFixture }
  from '../../testing/integration/music-queue-recovery-fixtures.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createFixtureWorkerObserver, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;
async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const context = createMusicQueueRecoveryFixtureContext({ getPoolFn });
    context.service = createMusicQueueRecoveryService({ store: context.store, withTransaction: context.withTransaction,
      assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed, createExecutionRun: context.executionRuns.createOperationRun,
      createDiscoveryRun: context.discoveryRuns.createOperationRun, rediscoveryDelayMs: 0, getNow: () => new Date(Date.now() - 50) });
    context.requestStore = createLibraryDiscoveryRequestStore({ getPoolFn, withTransaction: context.withTransaction, recoveryStore: context.store });
    context.scoped = createLibraryMusicQueueRecoveryDiscoveryService({ store: context.store, withTransaction: context.withTransaction,
      assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed });
    context.fixtureSignal = t.signal;
    await run(context);
  });
}
async function queued(context, options = {}) {
  const fixture = await seedMusicQueueRecoveryFixture(context, options);
  const result = await recoverMusicQueueFixture(context, fixture);
  assert.equal(result.reason, 'rediscovery_scheduled', JSON.stringify(result));
  return { ...fixture, runId: result.rediscovery.discoveryRunId };
}
async function runWorker(context, fixture, { prepare = async () => null, provider = async () => ({ id: randomUUID() }),
  signal = context.fixtureSignal } = {}) {
  return withFixtureLifecycle({ signal }, async (scope) => {
  const searches = []; const ingestions = []; const globalCalls = [];
  const dispatch = createLibraryDiscoveryDispatchService({ loadSettingsFn: async () => ({ library: { discoveryBatchSize: 5 } }),
    libraryDiscoveryRequestStore: context.requestStore, musicQueueRecoveryDiscoveryService: context.scoped,
    getReleaseTracklistExpectationsFn: prepare,
    slskdService: { startSearch: async (input) => { searches.push(input); return provider(input); } },
    importCandidateService: { ingestSlskdSearchResponses: async (input) => { ingestions.push(input); return { candidateCount: 0, fileCount: 0 }; } },
  });
  let terminalOutcome;
  const runs = context.discoveryRuns;
  const callbacks = { acquireLease: runs.acquireLease,
    releaseLease: runs.releaseLease,
    isCancellationRequested: runs.isCancellationRequested, markRunStarted: runs.markRunStarted,
    markRunCompleted: async (input) => { await runs.markRunCompleted(input); terminalOutcome = { state: 'completed', summary: input.summary }; },
    markRunFailed: async (input) => { await runs.markRunFailed(input); terminalOutcome = { state: 'failed', error: input.errorMessage }; },
    markRunCancelled: async (input) => { await runs.markRunCancelled(input); terminalOutcome = { state: 'cancelled' }; },
    markRunPaused: async (input) => { await runs.markRunPaused(input); terminalOutcome = { state: 'paused' }; },
    dispatchDiscoveryRequests: dispatch.dispatchReadyDiscoveryRequests,
    reconcileWantedReleases: async () => globalCalls.push('wanted'), reconcileDiscoveryRequests: async () => globalCalls.push('discovery'),
    prefetchMonitoredArtistArtwork: async () => globalCalls.push('artwork'),
  };
  const observer = createFixtureWorkerObserver({ callbacks });
  const worker = createLibraryDiscoveryWorker({ ...callbacks, ...observer.callbacks,
    isCancellationRequested: async (input) => scope.signal.aborted || await runs.isCancellationRequested(input),
  });
  scope.track(observer.finished);
  await worker.startWorkerRun({ runId: fixture.runId, triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE });
  await observer.finished;
  assert.deepEqual(globalCalls, []);
  return { outcome: terminalOutcome, searches, ingestions, dispatch };
  });
}
async function reconcile(context) {
  const service = createLibraryDiscoveryRequestService({ getPoolFn: context.getPoolFn, libraryDiscoveryRequestStore: context.requestStore,
    getNow: () => new Date(Date.now() + 8 * 60 * 60 * 1000) });
  await service.reconcileDiscoveryRequests();
}
const ordinaryClaim = (context) => context.requestStore.claimNextReadyAutomaticDiscoveryRequest({
  dispatchedAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(), nextSearchAfter: new Date(Date.now() + 15 * 60 * 60 * 1000).toISOString(),
});
const requestState = (context, fixture) => context.requestStore.getDownloadRecoveryRediscoveryState({ metadataReleaseId: fixture.metadata.metadataReleaseId });

suite('Guarded delayed Music Queue discovery with PostgreSQL and controlled provider adapters', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('the actual worker dispatches only its reserved target and retains current shared 320 consent', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context, { shared: true, fallback: true });
      assert.equal(await ordinaryClaim(context), null);
      const other = await seedMusicQueueRecoveryFixture(context);
      await context.pool.query("UPDATE library_discovery_requests SET request_status='ready',blocked_reason=NULL,next_search_after=NOW() WHERE id=$1", [other.discoveryId]);
      const result = await runWorker(context, f);
      assert.equal(result.outcome.state, 'completed', JSON.stringify(result.outcome)); assert.equal(result.searches.length, 1); assert.equal(result.ingestions.length, 1);
      const input = result.ingestions[0];
      assert.equal(input.discoveryScope.metadataReleaseId, f.metadata.metadataReleaseId);
      assert.equal(input.musicQueueContext.wantedReleaseId, f.wantedId);
      assert.deepEqual([...input.musicQueueContext.wantedReleaseIds].sort(), [...f.wantedIds].sort());
      assert.equal(input.musicQueueContext.qualityOverride.minimumBitrateKbps, 320);
      assert.equal(input.formatPreferences.minimumBitrateKbps, 320);
      assert.equal(input.requestOwnership.sourceRequestedForUserId, f.owner.id);
      assert.equal((await context.store.getDiscovery(other.metadata.metadataReleaseId)).requestStatus, 'ready');
      assert.equal((await context.store.getDiscovery(f.metadata.metadataReleaseId)).evidence.downloadRecoveryRediscovery.state, 'completed');
    });
  });

  test('current consent, floor and membership drift during awaited preparation refuses before provider search and stays quarantined', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['consent', 'floor', 'link']) await scenario(t, async (context) => {
      const f = await queued(context, { shared: true, fallback: true });
      const result = await runWorker(context, f, { prepare: async () => {
        if (drift === 'consent') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [f.wantedIds[1]]);
        if (drift === 'floor') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=jsonb_set(evidence,'{musicQueueQualityOverride,minimumBitrateKbps}','384'::jsonb) WHERE wanted_release_id=$1", [f.wantedIds[1]]);
        if (drift === 'link') await context.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.wantedIds[1]]);
      } });
      assert.equal(result.outcome.state, 'failed', drift); assert.equal(result.searches.length, 0, drift);
      const stopped = await context.store.getDiscovery(f.metadata.metadataReleaseId);
      assert.equal(stopped.requestStatus, 'blocked'); assert.equal(stopped.evidence.downloadRecoveryRediscovery.state, 'guard_refused');
      assert.equal(stopped.nextSearchAfter, null);
      await reconcile(context);
      assert.equal((await requestState(context, f)).blockedReason, 'recovery_scope_changed');
      assert.equal(await ordinaryClaim(context), null);
    });
  });

  test('private source still guards lost context, malformed baseline/authority and a different valid physical recipient', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['context', 'baseline', 'authority', 'recipient']) await scenario(t, async (context) => {
      const f = await queued(context, { shared: true, fallback: true });
      if (drift === 'context') await context.pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'musicQueue' WHERE id=$1", [f.candidate.id]);
      if (drift === 'baseline') await context.pool.query("UPDATE operation_runs SET summary=summary #- '{musicQueueRecovery,baselineRequirement,minimumBitrateKbps}' WHERE id=$1", [f.runId]);
      if (drift === 'authority') await context.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{musicQueueRecovery,authority}','null'::jsonb) WHERE id=$1", [f.runId]);
      if (drift === 'recipient') {
        const owner = (await context.pool.query('SELECT app_user_id FROM library_wanted_releases WHERE id=$1', [f.wantedIds[1]])).rows[0].app_user_id;
        await context.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{requestOwnership,sourceRequestedForUserId}',to_jsonb($2::text)) WHERE id=$1", [f.candidate.id, owner]);
      }
      const result = await runWorker(context, f);
      assert.equal(result.outcome.state, 'failed', drift); assert.equal(result.searches.length, 0, drift);
      assert.equal((await requestState(context, f)).blockedReason, 'recovery_scope_changed', JSON.stringify(result.outcome));
    });
  });

  test('a fresh canonical request supersedes the old reservation without the stale worker quarantining it', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context);
      const result = await runWorker(context, f, { prepare: async () => {
        const fresh = await context.requestStore.requestMusicQueueRediscovery({ metadataReleaseId: f.metadata.metadataReleaseId,
          requestedAt: new Date().toISOString(), requestedByUserId: f.owner.id, wantedReleaseId: f.wantedId });
        assert.equal(fresh.restartDisposition, 'started');
      } });
      assert.equal(result.searches.length, 0); assert.equal(result.outcome.state, 'failed');
      const current = await context.store.getDiscovery(f.metadata.metadataReleaseId);
      assert.equal(current.requestStatus, 'ready'); assert.equal(current.evidence.downloadRecoveryRediscovery, undefined);
      const run = await context.store.getOrigin(f.runId, null);
      assert.equal(run.summary.musicQueueRecovery.superseded, true);
      assert.equal((await ordinaryClaim(context)).metadataReleaseId, f.metadata.metadataReleaseId);
    });
  });

  test('a lost provider response keeps its owning uncertainty and is not quarantined or adopted by ordinary dispatch', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context);
      const result = await runWorker(context, f, { provider: async () => { throw new Error('Controlled accepted-but-response-lost uncertainty'); } });
      assert.equal(result.searches.length, 1); assert.equal(result.outcome.summary.failedCount, 1);
      assert.notEqual((await context.store.getDiscovery(f.metadata.metadataReleaseId)).evidence.downloadRecoveryRediscovery.state, 'guard_refused');
      await reconcile(context);
      assert.equal(await ordinaryClaim(context), null);
      await assert.rejects(result.dispatch.dispatchReadyDiscoveryRequests({ runId: f.runId, triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE }),
        (error) => error.code === 'music_queue_recovery_not_current');
      assert.notEqual((await context.store.getDiscovery(f.metadata.metadataReleaseId)).evidence.downloadRecoveryRediscovery.state, 'guard_refused');
      assert.equal(result.searches.length, 1);
    });
  });

  test('required private supersession failure rolls back a fresh request reset', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context); const beforeRequest = await context.store.getDiscovery(f.metadata.metadataReleaseId);
      await context.pool.query(`CREATE FUNCTION reject_recovery_supersession() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.summary #>> '{musicQueueRecovery,superseded}'='true' THEN RAISE EXCEPTION 'Controlled supersession rejection'; END IF; RETURN NEW; END $$`);
      await context.pool.query('CREATE TRIGGER reject_recovery_supersession BEFORE UPDATE ON operation_runs FOR EACH ROW EXECUTE FUNCTION reject_recovery_supersession()');
      await assert.rejects(context.requestStore.requestMusicQueueRediscovery({ metadataReleaseId: f.metadata.metadataReleaseId,
        requestedAt: new Date().toISOString(), wantedReleaseId: f.wantedId }), /Controlled supersession rejection/u);
      assert.deepEqual(await context.store.getDiscovery(f.metadata.metadataReleaseId), beforeRequest);
      assert.notEqual((await context.store.getOrigin(f.runId, null)).summary.musicQueueRecovery.superseded, true);
    });
  });

  test('a stale refusal reconciliation snapshot cannot overwrite a newer explicit request', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context);
      await context.pool.query("UPDATE app_users SET is_disabled=true WHERE id=$1", [f.owner.id]);
      await runWorker(context, f);
      const old = await requestState(context, f);
      assert.equal(old.blockedReason, 'recovery_scope_changed');
      await context.pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [f.owner.id]);
      await context.requestStore.requestMusicQueueRediscovery({ metadataReleaseId: f.metadata.metadataReleaseId,
        requestedAt: new Date().toISOString(), wantedReleaseId: f.wantedId });
      await context.requestStore.replaceLibraryDiscoveryRequests({ discoveryRequests: [old] });
      const current = await requestState(context, f);
      assert.equal(current.requestStatus, 'ready'); assert.equal(current.blockedReason, null);
      assert.equal(current.evidence.downloadRecoveryRediscovery, undefined);
      assert.equal((await ordinaryClaim(context)).metadataReleaseId, f.metadata.metadataReleaseId);
    });
  });

  test('an early worker respects the saved deadline without retiring its current intent', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      context.service = createMusicQueueRecoveryService({ store: context.store, withTransaction: context.withTransaction,
        assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed, createExecutionRun: context.executionRuns.createOperationRun,
        createDiscoveryRun: context.discoveryRuns.createOperationRun, rediscoveryDelayMs: 60_000 });
      const f = await queued(context);
      const beforeRequest = await requestState(context, f);
      const result = await runWorker(context, f);
      assert.equal(result.outcome.state, 'paused'); assert.equal(result.searches.length, 0);
      const current = await requestState(context, f);
      assert.equal(current.requestStatus, 'ready'); assert.equal(current.blockedReason, null);
      assert.deepEqual(current.evidence, beforeRequest.evidence);
      assert.equal((await context.store.getOrigin(f.runId, null)).status, 'pending');
      assert.equal(await ordinaryClaim(context), null);
    });
  });

  test('stale ordinary reconciliation cannot drop a newer reservation while same-generation normal updates still apply', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seedMusicQueueRecoveryFixture(context);
      const stale = await requestState(context, f);
      stale.requestStatus = 'ready'; stale.blockedReason = null;
      const result = await recoverMusicQueueFixture(context, f);
      assert.equal(result.reason, 'rediscovery_scheduled');
      const current = await requestState(context, f);
      await context.requestStore.replaceLibraryDiscoveryRequests({ discoveryRequests: [stale] });
      const retained = await requestState(context, f);
      assert.equal(retained.evidence.downloadRecoveryRediscovery.owningRunId, result.rediscovery.discoveryRunId);
      assert.equal(new Date(retained.nextSearchAfter).toISOString(), new Date(current.nextSearchAfter).toISOString());
      assert.equal(await ordinaryClaim(context), null);
      await context.requestStore.replaceLibraryDiscoveryRequests({ discoveryRequests: [{ ...retained,
        evidence: { ...retained.evidence, normalReconciled: true } }] });
      assert.equal((await requestState(context, f)).evidence.normalReconciled, true);
      assert.equal((await requestState(context, f)).evidence.downloadRecoveryRediscovery.owningRunId, result.rediscovery.discoveryRunId);
    });
  });
});
