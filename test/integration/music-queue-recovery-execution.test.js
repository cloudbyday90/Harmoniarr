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
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createImportCandidateExecutionReconciliationService } from '../../src/server/import-candidates/import-candidate-execution-reconciliation-service.js';
import { MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { listImportExecutionRunItems, updateImportExecutionRunItem } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture as fixture,
  seedMusicQueueRecoveryReplacement as replacement, recoverMusicQueueFixture as recover }
  from '../../testing/integration/music-queue-recovery-fixtures.js';

import { createRecoveryExecutionOwners as owners, runMusicQueueRecoveryExecutionWorker as runWorker }
  from '../../testing/integration/music-queue-recovery-execution-fixtures.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;

async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    await run(createMusicQueueRecoveryFixtureContext({ getPoolFn }));
  });
}
async function makeChild(context, options = {}) {
  const f = await fixture(context, options);
  const candidate = await replacement(context, f, { searchId: `older-${randomUUID()}` });
  const result = await recover(context, f);
  assert.equal(result.nextCandidateId, candidate.id);
  await context.pool.query("UPDATE operation_runs SET status='completed' WHERE id=$1", [f.originRunId]);
  return { f, candidate, runId: result.recoveryRunId };
}

suite('Scoped recovery execution and reconciliation with isolated PostgreSQL', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('the actual failed enqueue worker queues a child while its parent is running and rolls back owned failure on queue or audit error', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const fault of [null, 'queue', 'audit']) {
        const f = await fixture(context); const next = await replacement(context, f);
        await context.pool.query("UPDATE import_candidates SET status='selected',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
        if (fault) await context.pool.query(`CREATE FUNCTION fail_recovery_${fault}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF ${fault === 'queue' ? "NEW.summary->>'triggerSource'='music_queue_fallback_recovery'" : "NEW.event_type='import_candidate_download_failed'"}
          THEN RAISE EXCEPTION 'controlled recovery ${fault} fault'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER fail_recovery_${fault} BEFORE INSERT ON ${fault === 'queue' ? 'operation_runs' : 'audit_events'}
          FOR EACH ROW EXECUTE FUNCTION fail_recovery_${fault}()`);
        let requested = 0;
        const calls = await runWorker(context, f.originRunId, f.candidate.id, { enqueueDownloads: async ({ files }) => {
          requested += 1; return { enqueued: [], failed: files.map((file) => file.filename) };
        } });
        assert.equal(requested, 1); assert.equal(calls.genericFailure, 0);
        const failed = await context.store.getCandidate(f.candidate.id);
        const children = (await context.pool.query("SELECT id FROM operation_runs WHERE summary #>> '{musicQueueRecovery,originRunId}'=$1", [f.originRunId])).rows;
        if (!fault) {
          assert.equal(failed.status, 'failed'); assert.equal(failed.downloadAttemptCount, 1); assert.equal(children.length, 1);
          assert.equal((await context.store.getCandidate(next.id)).status, 'selected');
          assert.equal((await listImportExecutionRunItems(f.originRunId, context.pool)).length, 1, 'No child was inline appended');
        } else {
          assert.equal(failed.status, 'selected'); assert.equal(failed.downloadAttemptCount, 0); assert.equal(children.length, 0);
          assert.equal((await context.store.getCandidate(next.id)).status, 'pending');
          assert.equal((await context.pool.query("SELECT count(*)::int count FROM import_candidate_events WHERE import_candidate_id=$1 AND event_type='import_candidate_download_failed'", [failed.id])).rows[0].count, 0);
          await context.pool.query(`DROP TRIGGER fail_recovery_${fault} ON ${fault === 'queue' ? 'operation_runs' : 'audit_events'}; DROP FUNCTION fail_recovery_${fault}()`);
        }
      }
    });
  });

  test('an exact older-search shared child uses the live sibling floor before its single provider request and retains private authority after completion', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const child = await makeChild(context, { shared: true, fallback: true });
      const calls = await runWorker(context, child.runId, child.candidate.id);
      assert.equal(calls.enqueue, 1); assert.equal((await context.store.getCandidate(child.candidate.id)).status, 'downloading');
      const run = await context.store.getOrigin(child.runId, child.candidate.id);
      assert.equal(run.status, 'completed'); assert.equal(run.summary.musicQueueRecovery.baselineRequirement.minimumBitrateKbps, 320);
      assert.equal(run.execution_snapshot.execution.acceptedCandidateObservation.status, 'downloading');
      assert.equal(run.summary.sourceWantedReleaseId, child.f.wantedId);
      assert.equal(run.summary.triggerSource, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE);
    });
  });

  test('pre-start current authority, private baseline, metadata and physical provenance losses refuse before provider IO', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const change of ['disabled','unlinked','context','baseline','record','metadata','physical','file']) {
        const child = await makeChild(context);
        if (change === 'disabled') await context.pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [child.f.owner.id]);
        if (change === 'unlinked') await context.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [child.f.wantedId]);
        if (change === 'context') await context.pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'musicQueue' WHERE id=$1", [child.candidate.id]);
        if (change === 'baseline') await context.pool.query("UPDATE operation_runs SET summary=summary #- '{musicQueueRecovery,baselineRequirement}' WHERE id=$1", [child.runId]);
        if (change === 'record') await context.pool.query("UPDATE operation_runs SET summary=summary-'musicQueueRecovery' WHERE id=$1", [child.runId]);
        if (change === 'metadata') await context.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{musicQueueRecovery,metadataReleaseId}','\"invalid-metadata\"') WHERE id=$1", [child.runId]);
        if (change === 'physical') await context.pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload-'requestOwnership' WHERE id=$1", [child.candidate.id]);
        if (change === 'file') await context.pool.query('UPDATE import_candidate_files SET size_bytes=size_bytes+1 WHERE import_candidate_id=$1', [child.candidate.id]);
        const calls = await runWorker(context, child.runId, child.candidate.id);
        assert.equal(calls.enqueue, 0, change);
        assert.equal((await context.store.getOrigin(child.runId, child.candidate.id)).summary.musicQueueRecovery.retired, true, change);
      }
    });
  });

  test('a changed policy during durable checkpoint persistence is refused and proves that no provider request was sent', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const child = await makeChild(context, { fallback: true });
      const calls = await runWorker(context, child.runId, child.candidate.id, { updateImportExecutionRunItem: async (input) => {
        const item = await updateImportExecutionRunItem(input, context.pool);
        if (input.planningSnapshot.execution?.handoff?.state === 'dispatching') await context.pool.query(
          "UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [child.f.wantedId]);
        return item;
      } });
      assert.equal(calls.enqueue, 0);
      const run = await context.store.getOrigin(child.runId, child.candidate.id);
      assert.equal(run.execution_snapshot.execution.handoff.state, 'not_dispatched');
      assert.equal(run.summary.musicQueueRecovery.retired, true);
      assert.equal((await context.store.getCandidate(child.candidate.id)).status, 'held');
      const newer = await makeChild(context);
      let newerOrigin;
      const changedOrigin = await runWorker(context, newer.runId, newer.candidate.id, { updateImportExecutionRunItem: async (input) => {
        const item = await updateImportExecutionRunItem(input, context.pool);
        if (input.planningSnapshot.execution?.handoff?.state === 'dispatching') newerOrigin = await context.executionRuns.createOperationRun({
          requestedCandidateCount: 1, summary: { triggerSource: 'missing_music_manual', selectedCandidateId: newer.candidate.id,
            sourceWantedReleaseId: newer.f.wantedId, sourceSearchId: newer.candidate.sourceSearchId } });
        return item;
      } });
      assert.equal(changedOrigin.enqueue, 0);
      const staleRun = await context.store.getOrigin(newer.runId, newer.candidate.id);
      assert.equal(staleRun.execution_snapshot.execution.handoff.state, 'not_dispatched');
      assert.equal(staleRun.summary.musicQueueRecovery.retired, true);
      assert.equal((await context.store.getCandidate(newer.candidate.id)).status, 'selected', 'Do not demote the newer origin');
      assert.equal((await context.store.getOrigin(newerOrigin.id, newer.candidate.id)).status, 'pending');
    });
  });

  test('unknown provider outcomes retain reservation, survive pruning, and confirm the same request without sending another POST', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const child = await makeChild(context);
      let posts = 0;
      await runWorker(context, child.runId, child.candidate.id, { enqueueDownloads: async () => { posts += 1; throw new Error('Controlled lost provider response'); } });
      let run = await context.store.getOrigin(child.runId, child.candidate.id);
      assert.equal(run.status, 'failed'); assert.equal(run.summary.musicQueueRecovery.retired, undefined);
      assert.equal(run.execution_snapshot.execution.handoff.state, 'dispatching');
      const policy = owners(context).policy;
      const generic = await context.executionRuns.createOperationRun({ requestedCandidateCount: 1, summary: { triggerSource: 'manual', selectedCandidateId: child.candidate.id } });
      await assert.rejects(policy.resolveRecoveryExecution({ candidate: await context.store.getCandidate(child.candidate.id), runId: generic.id, triggerSource: 'manual' }), { code: 'music_queue_recovery_not_current' });
      await context.pool.query("UPDATE operation_runs SET created_at=NOW()-INTERVAL '30 days' WHERE id=$1", [child.runId]);
      await createOperationRunStore({ getPoolFn: context.getPoolFn, operationType: 'import_candidate_execution_planning' }).pruneOldRuns({ retainCount: 1 });
      assert.ok(await context.store.getOrigin(child.runId, child.candidate.id));
      await context.pool.query("UPDATE operation_runs SET status='cancelled' WHERE id=$1", [generic.id]);
      await context.pool.query("UPDATE operation_runs SET status='pending',created_at=NOW() WHERE id=$1", [child.runId]);
      const confirmations = await runWorker(context, child.runId, child.candidate.id, {
        enqueueDownloads: async () => { posts += 1; throw new Error('Must confirm instead of POST'); },
        findMatchingTransfers: async ({ requestedFiles }) => ({ allRequestedFilesMatched: true,
          matchedTransfers: requestedFiles.map((file) => ({ ...file, id: randomUUID() })) }),
      });
      assert.equal(posts, 1); assert.equal(confirmations.confirmed, 1);
      run = await context.store.getOrigin(child.runId, child.candidate.id);
      assert.equal(run.execution_snapshot.execution.handoff.state, 'confirmed');
      assert.equal((await context.store.getCandidate(child.candidate.id)).status, 'downloading');
    });
  });

  test('legacy owned context loss refuses while genuine generic work retains its provider contract and a fresh protected selection can follow safe retirement', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context);
      await context.pool.query("UPDATE import_candidates SET status='selected',normalized_payload=normalized_payload-'musicQueue' WHERE id=$1", [f.candidate.id]);
      const refused = await runWorker(context, f.originRunId, f.candidate.id);
      assert.equal(refused.enqueue, 0); assert.equal((await context.store.getCandidate(f.candidate.id)).status, 'held');
      const child = await makeChild(context, { fallback: true });
      await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [child.f.wantedId]);
      await runWorker(context, child.runId, child.candidate.id);
      await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=jsonb_build_object('musicQueueQualityOverride',jsonb_build_object('mode','allow_fallback_quality','wantedReleaseId',$1::text)) WHERE wanted_release_id=$1", [child.f.wantedId]);
      await context.pool.query("UPDATE import_candidates SET status='selected',updated_at=NOW() WHERE id=$1", [child.candidate.id]);
      const explicit = await context.executionRuns.createOperationRun({ requestedCandidateCount: 1, summary: { triggerSource: 'missing_music_manual',
        selectedCandidateId: child.candidate.id, sourceWantedReleaseId: child.f.wantedId, sourceSearchId: child.candidate.sourceSearchId } });
      assert.equal((await runWorker(context, explicit.id, child.candidate.id)).enqueue, 1);
      const generic = await replacement(context, child.f);
      await context.pool.query("UPDATE import_candidates SET status='selected',normalized_payload=normalized_payload-'musicQueue'-'requestOwnership'-'discoveryScope' WHERE id=$1", [generic.id]);
      const genericRun = await context.executionRuns.createOperationRun({ requestedCandidateCount: 1, summary: { triggerSource: 'manual', selectedCandidateId: generic.id } });
      assert.equal((await runWorker(context, genericRun.id, generic.id)).enqueue, 1);
    });
  });

  test('actual transfer reconciliation rolls back owned terminal decisions and rejects delayed completion from changed or superseded provider provenance', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context); await replacement(context, f);
      const { recovery, observation } = owners(context);
      let genericFailed = 0; let autoStarted = 0;
      const service = createImportCandidateExecutionReconciliationService({
        getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId),
        ownsRecoveryCandidate: recovery.ownsRecoveryCandidate,
        isCurrentExecutionObservation: context.service.isCurrentExecutionObservation,
        transitionOwnedExecutionCandidate: observation.transitionOwnedExecutionCandidate,
        handleImportCandidateDownloadFailure: recovery.handleImportCandidateDownloadFailure,
        markImportCandidateDownloadFailed: async () => { genericFailed += 1; },
        startSafeApplyRunAfterDownloadCompleted: async () => { autoStarted += 1; return { started: false }; },
        updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool),
      });
      const summary = async (status) => ({ currentRun: { id: f.originRunId, status: 'completed',
        items: (await listImportExecutionRunItems(f.originRunId, context.pool)).map((item) => ({ ...item,
          liveTransferSummary: { status, message: 'Controlled provider terminal observation' } })) } });
      await context.pool.query(`CREATE FUNCTION fail_reconciliation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='import_candidate_download_failed' THEN RAISE EXCEPTION 'controlled reconciliation fault'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fail_reconciliation_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION fail_reconciliation_audit()`);
      await assert.rejects(service.reconcileImportCandidateExecutionSummary({ executionSummary: await summary('failed') }), /controlled reconciliation fault/);
      assert.equal(genericFailed, 0); assert.equal((await context.store.getCandidate(f.candidate.id)).status, 'downloading');
      await context.pool.query('DROP TRIGGER fail_reconciliation_audit ON audit_events; DROP FUNCTION fail_reconciliation_audit()');
      await context.pool.query('UPDATE import_candidate_files SET size_bytes=size_bytes+1 WHERE import_candidate_id=$1', [f.candidate.id]);
      await service.reconcileImportCandidateExecutionSummary({ executionSummary: await summary('completed') });
      assert.equal(autoStarted, 0); assert.equal((await context.store.getCandidate(f.candidate.id)).status, 'downloading');
      await context.pool.query('UPDATE import_candidate_files SET size_bytes=size_bytes-1 WHERE import_candidate_id=$1', [f.candidate.id]);
      await context.executionRuns.createOperationRun({ requestedCandidateCount: 1, summary: { triggerSource: 'missing_music_manual', selectedCandidateId: f.candidate.id, sourceWantedReleaseId: f.wantedId } });
      await service.reconcileImportCandidateExecutionSummary({ executionSummary: await summary('completed') });
      assert.equal(autoStarted, 0); assert.equal((await context.store.getCandidate(f.candidate.id)).status, 'downloading');
    });
  });
});
