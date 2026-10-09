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
import { captureRecoveryObservation, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE }
  from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { replaceImportExecutionRunItems } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture as fixture, seedMusicQueueRecoveryReplacement as replacement,
  recoverMusicQueueFixture as recover, createRecoveryFixtureOwner as addOwner, createRecoveryFixtureWantedRelease as addWanted }
  from '../../testing/integration/music-queue-recovery-fixtures.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;

async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    await run(createMusicQueueRecoveryFixtureContext({ getPoolFn }));
  });
}
async function childRuns(pool) {
  return (await pool.query(`SELECT id,status,summary,next_attempt_at FROM operation_runs
    WHERE summary->>'triggerSource'=ANY($1::text[]) ORDER BY created_at,id`,
  [[MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE]])).rows;
}
async function episodeCount(pool, candidateId) {
  return (await pool.query("SELECT count(*)::int AS count FROM import_candidate_events WHERE import_candidate_id=$1 AND event_type='import_candidate_recovery_decided'", [candidateId])).rows[0].count;
}

suite('Scoped Music Queue recovery transactions with isolated PostgreSQL', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a running parent queues one exact older-search child and retains a valid sibling 320 floor', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context, { shared: true, fallback: true });
      const weak = await replacement(context, f, { bitrate: 256 });
      const wrong = await replacement(context, f, { scope: { ...f.candidate.normalizedPayload.requestOwnership, sourceRequestedForUserId: 'other-physical-owner' } });
      const chosen = await replacement(context, f, { searchId: `older-${randomUUID()}` });
      const result = await recover(context, f);
      assert.equal(result.nextCandidateId, chosen.id, JSON.stringify(result));
      assert.equal(result.scopedRecoveryQueued, true);
      const runs = await childRuns(context.pool); assert.equal(runs.length, 1);
      assert.equal(runs[0].summary.selectedCandidateId, chosen.id);
      assert.equal(runs[0].summary.sourceSearchId, chosen.sourceSearchId);
      assert.equal(runs[0].summary.musicQueueRecovery.failedSourceSearchId, f.searchId);
      assert.equal(runs[0].summary.musicQueueRecovery.baselineRequirement.minimumBitrateKbps, 320);
      const publicRun = await context.executionRuns.getRunById(runs[0].id);
      assert.equal(Object.hasOwn(publicRun, 'musicQueueRecovery'), false);
      assert.equal(JSON.stringify(publicRun).includes('wantedReleaseIds'), false);
      assert.equal((await context.store.getCandidate(chosen.id)).normalizedPayload.musicQueue.qualityOverride.minimumBitrateKbps, 320);
      assert.equal((await context.store.getCandidate(weak.id)).status, 'pending');
      assert.equal((await context.store.getCandidate(wrong.id)).status, 'pending');
      assert.equal((await context.pool.query('SELECT status FROM operation_runs WHERE id=$1', [f.originRunId])).rows[0].status, 'running');
      const audits = (await context.pool.query("SELECT actor_type,actor_user_id FROM audit_events WHERE entity_type IN ('import_candidate','operation_run')")).rows;
      assert.equal(audits.length, 2); assert.ok(audits.every((row) => row.actor_type === 'system' && row.actor_user_id == null));
    });
  });

  test('competing rejected and failed observations share one episode, attempt and durable child', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context); await replacement(context, f);
      const results = await Promise.all([recover(context, f, 'rejected'), recover(context, f, 'download')]);
      assert.equal(results[0].recoveryRunId, results[1].recoveryRunId);
      assert.equal(results.filter((result) => result.episodeReplayed).length, 1);
      assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, 1);
      assert.equal(await episodeCount(context.pool, f.candidate.id), 1);
      assert.equal((await childRuns(context.pool)).length, 1);
      const replay = await recover(context, f, 'rejected');
      assert.equal(replay.episodeReplayed, true); assert.equal(replay.recoveryRunId, results[0].recoveryRunId);
      assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, 1);
    });
  });

  test('a later retry source run owns a new episode rather than replaying the earlier attempt', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context);
      const first = await recover(context, f, 'rejected'); assert.equal(first.retrySameCandidate, true);
      await context.pool.query("UPDATE operation_runs SET status='completed' WHERE id=$1", [f.originRunId]);
      await context.pool.query("UPDATE operation_runs SET status='running' WHERE id=$1", [first.recoveryRunId]);
      await context.pool.query("UPDATE import_candidates SET status='downloading',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
      const fresh = await context.store.getCandidate(f.candidate.id);
      const observation = captureRecoveryObservation(fresh);
      await replaceImportExecutionRunItems(first.recoveryRunId, [{ importCandidateId: fresh.id, position: 1, itemStatus: 'queued', statusMessage: 'Controlled accepted retry',
        planningSnapshot: { execution: { acceptedCandidateObservation: observation, handoff: { state: 'confirmed' } } } }], context.pool);
      const second = await recover(context, { ...f, observation, originRunId: first.recoveryRunId }, 'download');
      assert.equal(second.episodeReplayed, undefined); assert.equal(second.reason, 'rediscovery_scheduled', JSON.stringify(second));
      assert.equal((await context.store.getCandidate(fresh.id)).downloadAttemptCount, 2);
      assert.equal(await episodeCount(context.pool, fresh.id), 2);
      assert.equal((await childRuns(context.pool)).length, 2);
    });
  });

  test('required audit, child queue and episode-event rejection roll back the whole eligible decision', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context); const next = await replacement(context, f);
      const originals = [await context.store.getCandidate(f.candidate.id), await context.store.getCandidate(next.id)];
      for (const [table, condition] of [['audit_events', 'true'],
        ['operation_runs', `NEW.summary->>'triggerSource'='${MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE}'`],
        ['import_candidate_events', "NEW.event_type='import_candidate_recovery_decided'"]]) {
        await context.pool.query(`CREATE FUNCTION reject_recovery_write() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF ${condition} THEN RAISE EXCEPTION 'Controlled recovery rejection'; END IF; RETURN NEW; END $$`);
        await context.pool.query(`CREATE TRIGGER reject_recovery_write BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_recovery_write()`);
        await assert.rejects(recover(context, f), /Controlled recovery rejection/u);
        assert.deepEqual(await context.store.getCandidate(f.candidate.id), originals[0]);
        assert.deepEqual(await context.store.getCandidate(next.id), originals[1]);
        assert.equal((await childRuns(context.pool)).length, 0);
        assert.equal(await episodeCount(context.pool, f.candidate.id), 0);
        assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM audit_events')).rows[0].count, 0);
        assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM import_candidate_events')).rows[0].count, 0);
        await context.pool.query(`DROP TRIGGER reject_recovery_write ON ${table}`);
        await context.pool.query('DROP FUNCTION reject_recovery_write()');
      }
      assert.equal((await recover(context, f)).nextCandidateId, next.id);
    });
  });

  test('disabled, unlinked and late recipients or a newer dispatch permit stopped history without new acquisition', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['disabled', 'unlinked', 'late', 'dispatch']) {
      await scenario(t, async (context) => {
        const f = await fixture(context); await replacement(context, f);
        if (drift === 'disabled') await context.pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [f.owner.id]);
        if (drift === 'unlinked') await context.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [f.wantedId]);
        if (drift === 'late') {
          const id = await addWanted(context.pool, await addOwner(context.pool), f.metadata);
          await context.pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [f.discoveryId, id]);
        }
        if (drift === 'dispatch') await context.pool.query(`UPDATE library_discovery_requests SET evidence=jsonb_set(evidence,
          '{lastDispatchAttemptedAt}',to_jsonb(NOW()+INTERVAL '1 second')) WHERE id=$1`, [f.discoveryId]);
        const stopped = await recover(context, f);
        assert.equal(stopped.reason, 'recovery_scope_not_current', drift);
        assert.equal(stopped.terminalObservationRecorded, true);
        assert.equal((await context.store.getCandidate(f.candidate.id)).status, 'failed');
        assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, 0);
        assert.equal((await childRuns(context.pool)).length, 0);
        assert.equal((await recover(context, f)).episodeReplayed, true);
        assert.equal(await episodeCount(context.pool, f.candidate.id), 1);
      });
    }
  });

  test('stale provenance cannot stop newer work and missing-origin history cannot mask later owned recovery', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['applied', 'source', 'origin']) {
      await scenario(t, async (context) => {
        const f = await fixture(context); await replacement(context, f);
        if (drift === 'applied') await context.pool.query("UPDATE import_candidates SET status='applied',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
        if (drift === 'source') await context.pool.query("UPDATE import_candidates SET source_response_key='new-source',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
        const result = await recover(context, { ...f, ...(drift === 'origin' ? { originRunId: null } : {}) });
        assert.equal(result.reason, drift === 'origin' ? 'recovery_scope_not_current' : 'recovery_observation_stale');
        assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, 0);
        assert.equal((await childRuns(context.pool)).length, 0);
        assert.equal(await episodeCount(context.pool, f.candidate.id), drift === 'origin' ? 1 : 0);
        if (drift !== 'origin') {
          assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM import_candidate_events')).rows[0].count, 0);
          assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM audit_events')).rows[0].count, 0);
        } else {
          const fresh = captureRecoveryObservation(await context.store.getCandidate(f.candidate.id));
          const identified = await recover(context, { ...f, observation: fresh });
          assert.equal(identified.recovered, true, JSON.stringify(identified));
          assert.equal(identified.episodeReplayed, undefined);
          assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, 1);
          assert.equal(await episodeCount(context.pool, f.candidate.id), 2);
          assert.equal((await childRuns(context.pool)).length, 1);
        }
      });
    }
  });

  test('delayed rediscovery request, budget and deadline roll back with queue or required audit rejection', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context);
      const beforeDiscovery = await context.store.getDiscovery(f.metadata.metadataReleaseId);
      const beforeCandidate = await context.store.getCandidate(f.candidate.id);
      for (const [table, condition] of [['operation_runs', `NEW.summary->>'triggerSource'='${MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE}'`], ['audit_events', 'true']]) {
        await context.pool.query(`CREATE FUNCTION reject_rediscovery_write() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF ${condition} THEN RAISE EXCEPTION 'Controlled rediscovery rejection'; END IF; RETURN NEW; END $$`);
        await context.pool.query(`CREATE TRIGGER reject_rediscovery_write BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_rediscovery_write()`);
        await assert.rejects(recover(context, f), /Controlled rediscovery rejection/u);
        assert.deepEqual(await context.store.getDiscovery(f.metadata.metadataReleaseId), beforeDiscovery);
        assert.deepEqual(await context.store.getCandidate(f.candidate.id), beforeCandidate);
        assert.equal((await childRuns(context.pool)).length, 0);
        assert.equal(await episodeCount(context.pool, f.candidate.id), 0);
        await context.pool.query(`DROP TRIGGER reject_rediscovery_write ON ${table}`);
        await context.pool.query('DROP FUNCTION reject_rediscovery_write()');
      }
      const result = await recover(context, f); assert.equal(result.reason, 'rediscovery_scheduled');
      const current = await context.store.getDiscovery(f.metadata.metadataReleaseId);
      const [run] = await childRuns(context.pool);
      assert.equal(current.researchAttemptCount, 1); assert.equal(current.requestStatus, 'ready');
      assert.equal(current.evidence.downloadRecoveryRediscovery.owningRunId, run.id);
      assert.equal(new Date(current.nextSearchAfter).toISOString(), run.next_attempt_at.toISOString());
    });
  });

  test('revoked sibling consent cannot select a lossy successor despite saved fallback context', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context, { shared: true, fallback: true }); const next = await replacement(context, f);
      await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [f.wantedIds[1]]);
      await context.pool.query("UPDATE import_candidates SET status='import_pending',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
      const observation = captureRecoveryObservation(await context.store.getCandidate(f.candidate.id));
      const result = await recover(context, { ...f, observation }, 'quality');
      assert.equal(result.recovered, false); assert.equal(result.reason, 'no_recovery_candidate_available');
      assert.equal((await context.store.getCandidate(next.id)).status, 'pending');
      assert.equal((await childRuns(context.pool)).length, 0);
      assert.equal((await context.store.getCandidate(f.candidate.id)).downloadAttemptCount, 1);
    });
  });

  test('parent-lock wait rereads changed source provenance before terminal history or promotion', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await fixture(context); const next = await replacement(context, f);
      const writer = await context.pool.connect();
      let pending;
      let transactionOpen = false;
      try {
        await writer.query('BEGIN');
        transactionOpen = true;
        const writerPid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await writer.query("UPDATE import_candidates SET folder_path='Changed after capture',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
        pending = recover(context, f);
        const deadline = Date.now() + 5000;
        let observedWait = false;
        while (Date.now() < deadline) {
          observedWait = (await context.pool.query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
            WHERE $1::int=ANY(pg_blocking_pids(pid))) AS blocked`, [writerPid])).rows[0].blocked;
          if (observedWait) break;
          await new Promise((resolve) => { setTimeout(resolve, 20); });
        }
        assert.equal(observedWait, true, 'Observe the owning database lock wait before releasing the writer');
        await writer.query('COMMIT');
        transactionOpen = false;
      } finally {
        try { if (transactionOpen) await writer.query('ROLLBACK'); }
        finally { writer.release(); }
      }
      const result = await pending;
      assert.equal(result.reason, 'recovery_observation_stale');
      const current = await context.store.getCandidate(f.candidate.id);
      assert.equal(current.folderPath, 'Changed after capture'); assert.equal(current.status, 'downloading');
      assert.equal(current.downloadAttemptCount, 0); assert.equal((await context.store.getCandidate(next.id)).status, 'pending');
      assert.equal(await episodeCount(context.pool, f.candidate.id), 0); assert.equal((await childRuns(context.pool)).length, 0);
      assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM import_candidate_events')).rows[0].count, 0);
      assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM audit_events')).rows[0].count, 0);
    });
  });
});
