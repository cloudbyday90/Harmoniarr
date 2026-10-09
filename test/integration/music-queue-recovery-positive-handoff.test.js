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
import { recordAuditEvent } from '../../src/server/audit.js';
import { createMusicQueueRecoveryService } from '../../src/server/import-candidates/music-queue-recovery-service.js';
import { createMusicQueueRecoveryDiscoveryHandoffService } from '../../src/server/import-candidates/music-queue-recovery-discovery-handoff-service.js';
import { createMusicQueueRecoveryDiscoveryHandoffStore } from '../../src/server/import-candidates/music-queue-recovery-discovery-handoff-store.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createImportCandidateAutoDownloadRunService } from '../../src/server/import-candidates/import-candidate-auto-download-run-service.js';
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createLibraryMusicQueueRecoveryDiscoveryService } from '../../src/server/library/library-music-queue-recovery-discovery-service.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture, recoverMusicQueueFixture }
  from '../../testing/integration/music-queue-recovery-fixtures.js';
import { runMusicQueueRecoveryExecutionWorker } from '../../testing/integration/music-queue-recovery-execution-fixtures.js';

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
    context.requests = createLibraryDiscoveryRequestStore({ getPoolFn, withTransaction: context.withTransaction, recoveryStore: context.store });
    context.scoped = createLibraryMusicQueueRecoveryDiscoveryService({ store: context.store, withTransaction: context.withTransaction,
      assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed });
    context.handoff = createMusicQueueRecoveryDiscoveryHandoffService({
      store: createMusicQueueRecoveryDiscoveryHandoffStore({ getPoolFn, recoveryStore: context.store }),
      scopedDiscoveryService: context.scoped, withTransaction: context.withTransaction, assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed,
      createExecutionRun: context.executionRuns.createOperationRun, recordDiscoverySearchSuccess: context.requests.recordDiscoverySearchSuccess,
    });
    await run(context);
  });
}
async function queued(context, options = {}) {
  const f = await seedMusicQueueRecoveryFixture(context, options);
  const result = await recoverMusicQueueFixture(context, f);
  assert.equal(result.reason, 'rediscovery_scheduled');
  return { ...f, runId: result.rediscovery.discoveryRunId };
}
function responses(searchId, { ambiguous = false, lowConfidence = false } = {}) {
  const response = { username: 'controlled-positive-peer', hasFreeUploadSlot: !lowConfidence, queueLength: 0,
    uploadSpeed: lowConfidence ? 1 : 10_000_000,
    files: [{ filename: `Amber\\01 ${lowConfidence ? 'Unrelated Song' : 'Foil'}.mp3`, size: 1000, bitRate: 320, length: 322 }] };
  return { searchId, responses: [response, ...(ambiguous ? [{ ...response, username: 'second-positive-peer' }] : [])] };
}
async function dispatchPositive(context, f, { afterResponse = async () => {}, afterReadiness = async () => {}, enabled = true,
  folderReady = true, providerHealthy = true, ambiguous = false, lowConfidence = false } = {}) {
  const searchId = `positive-${randomUUID()}`;
  let searches = 0; let ordinarySelection = 0; let ordinaryStart = 0;
  const importCandidates = createImportCandidateService({ pool: context.pool, loadSettingsFn: async () => ({}),
    recordAuditEventFn: (event) => recordAuditEvent(event, context.pool),
    slskdService: { getSearchResponses: async () => { await afterResponse(); return responses(searchId, { ambiguous, lowConfidence }); } },
  });
  const autoDownload = createImportCandidateAutoDownloadRunService({
    loadSettingsFn: async () => ({ library: { autoStartDownloadsAfterSelection: enabled } }),
    getAutomaticDownloadFolderReadiness: async () => ({ ready: folderReady, reason: 'download_folder_unavailable' }),
    getProviderStatus: async () => { await afterReadiness(); return { status: providerHealthy ? 'healthy' : 'unavailable' }; },
    startImportCandidateExecutionRun: async () => { ordinaryStart += 1; throw new Error('Scoped continuation must not start an ordinary job'); },
  });
  const dispatch = createLibraryDiscoveryDispatchService({ libraryDiscoveryRequestStore: context.requests,
    musicQueueRecoveryDiscoveryService: context.scoped, musicQueueRecoveryDiscoveryHandoffService: context.handoff,
    importCandidateService: importCandidates, importCandidateAutoDownloadRunService: autoDownload,
    importCandidateAutoSelectionService: { selectHighConfidenceCandidate: async () => { ordinarySelection += 1; throw new Error('Scoped continuation must not select through the ordinary owner'); } },
    loadSettingsFn: async () => ({ library: { discoveryBatchSize: 5 } }),
    getReleaseTracklistExpectationsFn: async () => ({ expectedTrackCount: 1, expectedTrackTitles: ['Foil'], expectedDurationSeconds: 322 }),
    slskdService: { startSearch: async () => { searches += 1; return { id: searchId }; } },
  });
  const result = await dispatch.dispatchReadyDiscoveryRequests({ runId: f.runId, triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE });
  assert.equal(searches, 1); assert.equal(ordinarySelection, 0); assert.equal(ordinaryStart, 0);
  const candidates = (await context.pool.query('SELECT id,status FROM import_candidates WHERE source_search_id=$1 ORDER BY id', [searchId])).rows;
  assert.ok(candidates.length > 0, 'Controlled responses were normalized, scored and persisted by real ingestion');
  return { result, searchId, candidates };
}
async function children(context, runId) {
  return (await context.pool.query("SELECT id,status,summary FROM operation_runs WHERE summary #>> '{musicQueueRecovery,discoveryRunId}'=$1", [runId])).rows;
}

suite('Positive scoped recovery search continuation with persisted ingestion and PostgreSQL', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a real scored shared result atomically queues one exact typed child, preserves budgets and passes the actual execution worker guard', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context, { shared: true, fallback: true });
      const attemptedBefore = (await context.store.getCandidate(f.candidate.id)).downloadAttemptCount;
      const researchBefore = (await context.store.getDiscovery(f.metadata.metadataReleaseId)).researchAttemptCount;
      const positive = await dispatchPositive(context, f);
      assert.equal(positive.result.failedCount, 0, JSON.stringify(positive.result));
      const [child] = await children(context, f.runId); assert.ok(child, JSON.stringify(positive.result));
      assert.equal((await children(context, f.runId)).length, 1);
      assert.equal(child.summary.triggerSource, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE);
      assert.equal(child.summary.sourceSearchId, positive.searchId);
      assert.equal(child.summary.musicQueueRecovery.failedSourceSearchId, positive.searchId);
      assert.equal(child.summary.musicQueueRecovery.previousSearchId, f.searchId);
      assert.equal(child.summary.musicQueueRecovery.baselineRequirement.minimumBitrateKbps, 320);
      assert.equal(child.summary.musicQueueRecovery.selectedObservation.candidateId, positive.candidates[0].id);
      const selected = await context.store.getCandidate(positive.candidates[0].id);
      assert.ok(selected.normalizedPayload.compositeScore >= 85);
      assert.equal(selected.normalizedPayload.musicQueue.qualityOverride.minimumBitrateKbps, 320);
      const discovery = await context.store.getDiscovery(f.metadata.metadataReleaseId);
      assert.equal(discovery.evidence.lastSearchId, positive.searchId);
      assert.equal(discovery.evidence.downloadRecoveryRediscovery.state, 'completed');
      assert.equal(discovery.researchAttemptCount, researchBefore);
      assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, attemptedBefore);
      assert.equal((await context.pool.query("SELECT count(*)::int count FROM operation_runs WHERE summary->>'triggerSource'='auto_selection'", [])).rows[0].count, 0);
      const result = await runMusicQueueRecoveryExecutionWorker(context, child.id, selected.id);
      assert.equal(result.enqueue, 1); assert.equal((await context.store.getCandidate(selected.id)).status, 'downloading');
      const ownRun = await context.store.getOrigin(f.runId, null);
      const auditsBeforeReplay = (await context.pool.query('SELECT count(*)::int count FROM audit_events')).rows[0].count;
      const replay = await context.handoff.finishScopedDiscovery({ runId: f.runId,
        prepared: { metadataReleaseId: f.metadata.metadataReleaseId, record: ownRun.summary.musicQueueRecovery },
        ingestionResult: { candidateCount: 1, fileCount: 1 },
        successPayload: { searchId: positive.searchId, metadataReleaseId: f.metadata.metadataReleaseId }, readiness: { ready: true } });
      assert.equal(replay.autoDownloadStart.runId, child.id);
      assert.equal((await children(context, f.runId)).length, 1);
      assert.equal((await context.pool.query('SELECT count(*)::int count FROM audit_events')).rows[0].count, auditsBeforeReplay);
    });
  });

  test('current consent, physical ownership and eligibility drift after search or readiness cannot bless the ingested matches', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const drift of ['consent','disabled','physical','floor']) {
        const f = await queued(context, { shared: true, fallback: true });
        const mutate = async () => {
          if (drift === 'consent') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [f.wantedIds[1]]);
          if (drift === 'disabled') await context.pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [f.owner.id]);
          if (drift === 'physical') await context.pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'requestOwnership' WHERE id=$1", [f.candidate.id]);
          if (drift === 'floor') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=jsonb_set(evidence,'{musicQueueQualityOverride,minimumBitrateKbps}','384') WHERE wanted_release_id=$1", [f.wantedIds[1]]);
        };
        const positive = await dispatchPositive(context, f, drift === 'floor' ? { afterReadiness: mutate } : { afterResponse: mutate });
        assert.equal((await children(context, f.runId)).length, 0, drift);
        assert.ok(positive.candidates.every((candidate) => candidate.status === 'pending'), drift);
        assert.equal((await context.store.getDiscovery(f.metadata.metadataReleaseId)).evidence.lastSearchId, f.searchId, drift);
      }
    });
  });

  test('required selection, child queue and success audit rejection roll back the complete positive acceptance', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const fault of ['queue','selection','success']) {
        const f = await queued(context);
        await context.pool.query(`CREATE FUNCTION reject_positive_${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF ${fault === 'queue' ? "NEW.summary->>'triggerSource'='music_queue_fallback_recovery'" : `NEW.event_type='${fault === 'selection' ? 'import_candidate_selected' : 'music_queue_recovery_search_completed'}'`}
          THEN RAISE EXCEPTION 'controlled positive ${fault} rejection'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER reject_positive_${fault} BEFORE INSERT ON ${fault === 'queue' ? 'operation_runs' : 'audit_events'}
          FOR EACH ROW EXECUTE FUNCTION reject_positive_${fault}()`);
        const positive = await dispatchPositive(context, f);
        assert.equal((await children(context, f.runId)).length, 0);
        assert.ok(positive.candidates.every((candidate) => candidate.status === 'pending'));
        assert.equal((await context.store.getDiscovery(f.metadata.metadataReleaseId)).evidence.lastSearchId, f.searchId);
        assert.equal((await context.store.getDiscovery(f.metadata.metadataReleaseId)).evidence.downloadRecoveryRediscovery.state, undefined);
        assert.equal((await context.pool.query("SELECT count(*)::int count FROM import_candidate_events WHERE import_candidate_id=ANY($1::uuid[]) AND event_type='import_candidate_selected'", [positive.candidates.map((candidate) => candidate.id)])).rows[0].count, 0);
        await context.pool.query(`DROP TRIGGER reject_positive_${fault} ON ${fault === 'queue' ? 'operation_runs' : 'audit_events'}; DROP FUNCTION reject_positive_${fault}()`);
      }
    });
  });

  test('existing disabled automation, unavailable folders/provider and ambiguous or low confidence remain pending review without ordinary selected work', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const options of [{ enabled: false }, { folderReady: false }, { providerHealthy: false }, { ambiguous: true }, { lowConfidence: true }]) {
        const f = await queued(context);
        const positive = await dispatchPositive(context, f, options);
        assert.equal((await children(context, f.runId)).length, 0, JSON.stringify(options));
        assert.ok(positive.candidates.every((candidate) => candidate.status === 'pending'), JSON.stringify(options));
        const discovery = await context.store.getDiscovery(f.metadata.metadataReleaseId);
        assert.equal(discovery.evidence.lastSearchId, positive.searchId);
        assert.equal(discovery.evidence.downloadRecoveryRediscovery.state, 'completed');
        assert.equal(discovery.evidence.lastSearchResult.autoSelection.selected, false);
      }
    });
  });

  test('the resulting child still refuses revoked consent at the actual later provider boundary', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await queued(context, { shared: true, fallback: true });
      await dispatchPositive(context, f);
      const [child] = await children(context, f.runId); assert.ok(child);
      await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [f.wantedIds[1]]);
      const result = await runMusicQueueRecoveryExecutionWorker(context, child.id, child.summary.selectedCandidateId);
      assert.equal(result.enqueue, 0);
      assert.equal((await context.store.getCandidate(child.summary.selectedCandidateId)).status, 'held');
    });
  });
});
