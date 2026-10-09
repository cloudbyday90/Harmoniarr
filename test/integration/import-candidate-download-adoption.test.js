/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createImportCandidateDownloadAdoptionService } from '../../src/server/import-candidates/import-candidate-download-adoption-service.js';
import { createImportCandidateDownloadAdoptionStore } from '../../src/server/import-candidates/import-candidate-download-adoption-store.js';
import { createImportExecutionHandoffService } from '../../src/server/import-candidates/import-execution-handoff-service.js';
import { createImportExecutionHandoffStore } from '../../src/server/import-candidates/import-execution-handoff-store.js';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { createImportCandidateExecutionRunStore } from '../../src/server/import-candidates/import-candidate-execution-run-store.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createDownloadAttempt } from '../../src/server/slskd/slskd-download-attempt-policy.js';
import { validateDownloadAdoptionSelection } from '../../src/server/slskd/slskd-download-adoption-policy.js';
import { createControlPlaneIdempotencyService } from '../../src/server/recovery/control-plane-idempotency-service.js';
import { createControlPlaneIdempotencyStore } from '../../src/server/recovery/control-plane-idempotency-store.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture } from '../../testing/integration/music-queue-recovery-fixtures.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailableReason;
const providerBinding = { protocol: 'legacy', version: '0.25.1', endpointFingerprint: 'a'.repeat(64) };
async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const recovery = createMusicQueueRecoveryFixtureContext({ getPoolFn });
    const store = createImportCandidateDownloadAdoptionStore({ getPoolFn });
    const evidenceStore = createImportExecutionHandoffStore({ getPoolFn });
    const links = createImportExecutionTransferLinkStore({ getPoolFn });
    const runs = createImportCandidateExecutionRunStore({ getPoolFn });
    const handoff = createImportExecutionHandoffService({ store: evidenceStore, transferLinkStore: links,
      withTransaction: createDatabaseTransactionRunner({ getPoolFn }) });
    await run({ ...recovery, adoptionStore: store, evidenceStore, links, runs, handoff });
  });
}

async function admin(context) {
  const user = (await context.pool.query(`INSERT INTO app_users(username,password_hash,role,must_change_password,user_preferences)
    VALUES($1,'controlled-test-hash','admin',false,'{}'::jsonb) RETURNING id`, [`adoption-${randomUUID()}`])).rows[0];
  const session = (await context.pool.query(`INSERT INTO refresh_tokens(app_user_id,token_hash,token_family_id,issued_at,expires_at)
    VALUES($1,$2,$3,NOW(),NOW()+INTERVAL '1 day') RETURNING id`, [user.id, randomUUID(), randomUUID()])).rows[0];
  return { actorUserId: user.id, refreshTokenId: session.id };
}

async function seed(context, { shared = false, files = 1, attempt = true } = {}) {
  let candidate; let run;
  if (shared) {
    const f = await seedMusicQueueRecoveryFixture(context, { shared: true, fallback: true });
    await context.pool.query("UPDATE import_candidates SET status='selected',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
    await context.pool.query("UPDATE operation_runs SET status='failed' WHERE id=$1", [f.originRunId]);
    candidate = await context.evidenceStore.getCandidate(f.candidate.id);
    run = { id: f.originRunId };
  } else {
    candidate = await seedImportCandidateFixture({ queryable: context.pool,
      candidateOverrides: { status: 'selected', username: 'adoption-peer' },
      files: Array.from({ length: files }, (_, index) => ({ filename: `${index + 1}.flac`, extension: 'flac', sizeBytes: 1000 + index, isLocked: false })) });
    run = await context.runs.createOperationRun({ status: 'failed', requestedCandidateCount: 1,
      summary: { executionMode: 'download_enqueue', selectedCandidateId: candidate.id, sourceSearchId: candidate.sourceSearchId, triggerSource: 'manual' } });
  }
  const sourceObservation = captureRecoveryObservation(candidate);
  const requestedFiles = candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes }));
  const originalAttempt = attempt ? createDownloadAttempt({ importCandidateId: candidate.id, operationRunId: run.id,
    requestedFiles, username: candidate.username, sourceObservation }) : null;
  const execution = { sourceObservation, requestedFiles, handoff: { state: 'dispatching', ...(originalAttempt ? { attempt: originalAttempt } : {}) } };
  await context.pool.query(`INSERT INTO import_execution_run_items(operation_run_id,import_candidate_id,position,item_status,status_message,planning_snapshot)
    VALUES($1,$2,1,'awaiting_confirmation','Controlled uncertain dispatch',$3::jsonb)
    ON CONFLICT(operation_run_id,import_candidate_id) DO UPDATE SET item_status=EXCLUDED.item_status,status_message=EXCLUDED.status_message,planning_snapshot=EXCLUDED.planning_snapshot`,
  [run.id, candidate.id, JSON.stringify({ candidate: { id: candidate.id, username: candidate.username }, execution })]);
  const actor = await admin(context);
  const owner = { ...actor, importCandidateId: candidate.id, operationRunId: run.id };
  const transfers = requestedFiles.map((file) => ({ ...file, id: randomUUID(), username: candidate.username,
    direction: 'Download', state: 'Queued, Remotely', removed: false }));
  return { owner, candidate, requestedFiles, sourceObservation, originalAttempt, transfers };
}

function adoption(context, f, afterEvidence = null) {
  let reads = 0;
  const service = createImportCandidateDownloadAdoptionService({ store: context.adoptionStore,
    adoptDownloadHandoff: context.handoff.adoptDownloadHandoff, withTransaction: context.withTransaction,
    assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed,
    listAdoptionTransfers: async () => { reads += 1; return { binding: providerBinding, transfers: structuredClone(f.transfers) }; },
    validateSelectedAdoptionTransfers: async (input) => {
      reads += 1; const result = validateDownloadAdoptionSelection({ ...input, transfers: f.transfers });
      await afterEvidence?.(); return result;
    } });
  return { service, reads: () => reads };
}
async function review(service, f) {
  const result = await service.getDownloadAdoptionReview(f.owner);
  assert.equal(result.downloadAdoptionReview.canAdopt, true);
  return { reviewDigest: result.downloadAdoptionReview.reviewDigest,
    transferIds: result.downloadAdoptionReview.files.map((file) => file.choices[0].id) };
}
async function counts(context) {
  return { links: (await context.pool.query('SELECT COUNT(*)::int AS count FROM import_execution_transfer_links')).rows[0].count,
    phaseAudits: (await context.pool.query("SELECT COUNT(*)::int AS count FROM audit_events WHERE event_type='import_candidate_downloading'")).rows[0].count,
    adoptionAudits: (await context.pool.query("SELECT COUNT(*)::int AS count FROM audit_events WHERE event_type='import_execution_downloads_adopted'")).rows[0].count };
}

suite('Explicit existing-download adoption with real PostgreSQL authority and pure provider-evidence controls', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error; unavailableReason = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('terminal legacy and modern uncertainty become separate operator tracking with atomic links, phase and required audits', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const attempt of [false, true]) {
        const f = await seed(context, { attempt, files: 2 }); const h = adoption(context, f); const command = await review(h.service, f);
        const original = (await context.evidenceStore.getItem(f.owner)).planningSnapshot.execution.handoff;
        const result = await h.service.adoptExistingDownloads({ ...f.owner, command });
        assert.equal(result.downloadAdoption.outcome, 'adopted'); assert.equal(result.downloadAdoption.adoptedFileCount, 2);
        const item = await context.evidenceStore.getItem(f.owner);
        assert.deepEqual(item.planningSnapshot.execution.handoff.attempt ?? null, original.attempt ?? null);
        assert.equal(item.planningSnapshot.execution.handoff.adoption.source, 'operator_adoption');
        assert.equal(item.planningSnapshot.execution.handoff.adoption.originalUncertainty, true);
        assert.equal(item.planningSnapshot.execution.handoff.adoption.automaticRecoveryAllowed, false);
        assert.equal((await context.evidenceStore.getCandidate(f.owner.importCandidateId)).status, 'downloading');
        const beforeReplay = await counts(context); const reads = h.reads();
        assert.equal((await h.service.adoptExistingDownloads({ ...f.owner, command })).downloadAdoption.replayed, true);
        assert.equal(h.reads(), reads); assert.deepEqual(await counts(context), beforeReplay);
      }
      assert.deepEqual(await counts(context), { links: 4, phaseAudits: 2, adoptionAudits: 2 });
    });
  });

  test('lost command completion and expired reservation replay the saved adoption outcome without new links, audits or provider reads', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context); const h = adoption(context, f); const command = await review(h.service, f);
      const store = createControlPlaneIdempotencyStore({ getPoolFn: context.getPoolFn });
      const broken = createControlPlaneIdempotencyService({ idempotencyStore: store, completeRecord: async () => { throw new Error('Controlled lost completion'); } });
      const input = { actorUserId: f.owner.actorUserId, idempotencyKey: 'same-adoption-intent', operationScope: 'adoption-test',
        requestPayload: { operationRunId: f.owner.operationRunId, importCandidateId: f.owner.importCandidateId, ...command },
        executeMutation: async () => ({ body: await h.service.adoptExistingDownloads({ ...f.owner, command }), statusCode: 200 }) };
      await assert.rejects(broken.executeIdempotentMutation(input), /Controlled lost completion/);
      const committed = await counts(context); const reads = h.reads();
      await context.pool.query("UPDATE control_plane_idempotency_records SET expires_at=NOW()-INTERVAL '1 second'");
      const retry = await createControlPlaneIdempotencyService({ idempotencyStore: store }).executeIdempotentMutation(input);
      assert.equal(retry.body.downloadAdoption.replayed, true); assert.equal(h.reads(), reads); assert.deepEqual(await counts(context), committed);
    });
  });

  test('required operator audit failure and mixed foreign transfer identity roll back the entire adoption', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context, { files: 2 }); const h = adoption(context, f); const command = await review(h.service, f);
      await context.pool.query(`CREATE FUNCTION reject_adoption_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='import_execution_downloads_adopted' THEN RAISE EXCEPTION 'Controlled operator audit fault'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_adoption_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_adoption_audit()`);
      await assert.rejects(h.service.adoptExistingDownloads({ ...f.owner, command }), /Controlled operator audit fault/);
      assert.deepEqual(await counts(context), { links: 0, phaseAudits: 0, adoptionAudits: 0 });
      assert.equal((await context.evidenceStore.getCandidate(f.owner.importCandidateId)).status, 'selected');
      assert.equal((await context.evidenceStore.getItem(f.owner)).planningSnapshot.execution.handoff.adoption, undefined);
      await context.pool.query('DROP TRIGGER reject_adoption_audit ON audit_events');
      const foreign = await seed(context);
      await context.links.recordConfirmedTransfers({ ...foreign.owner, transfers: [{ id: f.transfers[0].id, username: f.candidate.username }] });
      await assert.rejects(h.service.adoptExistingDownloads({ ...f.owner, command }), { code: 'import_execution_transfer_link_conflict' });
      assert.deepEqual(await counts(context), { links: 1, phaseAudits: 0, adoptionAudits: 0 });
      assert.equal((await context.evidenceStore.getCandidate(f.owner.importCandidateId)).status, 'selected');
    });
  });

  test('simultaneous commands produce one adoption and same-hash replay rather than duplicate operator decisions', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context); const h = adoption(context, f); const command = await review(h.service, f);
      const results = await Promise.all([h.service.adoptExistingDownloads({ ...f.owner, command }), h.service.adoptExistingDownloads({ ...f.owner, command })]);
      assert.equal(results.filter((result) => result.downloadAdoption.replayed === false).length, 1);
      assert.equal(results.filter((result) => result.downloadAdoption.replayed === true).length, 1);
      assert.deepEqual(await counts(context), { links: 1, phaseAudits: 1, adoptionAudits: 1 });
    });
  });

  test('current actor role, session and password eligibility are reauthorized after awaited evidence before links', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const kind of ['role', 'disabled', 'session', 'password']) {
        const f = await seed(context); let applying = false;
        const h = adoption(context, f, async () => { if (!applying) return;
          if (kind === 'role') await context.pool.query("UPDATE app_users SET role='requester' WHERE id=$1", [f.owner.actorUserId]);
          if (kind === 'disabled') await context.pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [f.owner.actorUserId]);
          if (kind === 'session') await context.pool.query('UPDATE refresh_tokens SET is_revoked=true WHERE id=$1', [f.owner.refreshTokenId]);
          if (kind === 'password') await context.pool.query('UPDATE app_users SET must_change_password=true WHERE id=$1', [f.owner.actorUserId]);
        });
        const command = await review(h.service, f); applying = true;
        await assert.rejects(h.service.adoptExistingDownloads({ ...f.owner, command }), (error) => ['admin_required', 'reauth_required'].includes(error.code));
        assert.equal((await context.evidenceStore.getCandidate(f.owner.importCandidateId)).status, 'selected');
      }
      assert.deepEqual(await counts(context), { links: 0, phaseAudits: 0, adoptionAudits: 0 });
    });
  });

  test('physical source and newer allocated origin drift during awaited provider evidence refuse the old terminal episode', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const kind of ['source', 'origin']) {
        const f = await seed(context); let applying = false;
        const h = adoption(context, f, async () => { if (!applying) return;
          if (kind === 'source') await context.pool.query('UPDATE import_candidates SET folder_path=$2 WHERE id=$1', [f.candidate.id, 'Changed physical source']);
          else await context.runs.createOperationRun({ status: 'pending', requestedCandidateCount: 1,
            summary: { selectedCandidateId: f.candidate.id, executionMode: 'download_enqueue', triggerSource: 'manual' } });
        });
        const command = await review(h.service, f); applying = true;
        await assert.rejects(h.service.adoptExistingDownloads({ ...f.owner, command }), { code: 'import_execution_download_adoption_not_current' });
      }
      assert.deepEqual(await counts(context), { links: 0, phaseAudits: 0, adoptionAudits: 0 });
    });
  });

  test('shared consent, sibling floor and discovery membership changed after provider reads cannot adopt under the earlier review', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      for (const kind of ['consent', 'floor', 'unlink']) {
        const f = await seed(context, { shared: true }); let applying = false;
        const ids = f.candidate.normalizedPayload.musicQueue.wantedReleaseIds;
        const sibling = ids.find((id) => id !== f.candidate.normalizedPayload.musicQueue.wantedReleaseId);
        const h = adoption(context, f, async () => { if (!applying) return;
          if (kind === 'consent') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=evidence-'musicQueueQualityOverride' WHERE wanted_release_id=$1", [sibling]);
          if (kind === 'floor') await context.pool.query("UPDATE library_discovery_request_wanted_release_links SET evidence=jsonb_set(evidence,'{musicQueueQualityOverride,minimumBitrateKbps}','384'::jsonb) WHERE wanted_release_id=$1", [sibling]);
          if (kind === 'unlink') await context.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=$1', [sibling]);
        });
        const command = await review(h.service, f); applying = true;
        await assert.rejects(h.service.adoptExistingDownloads({ ...f.owner, command }), { code: 'import_execution_download_adoption_not_current' });
      }
      assert.deepEqual(await counts(context), { links: 0, phaseAudits: 0, adoptionAudits: 0 });
    });
  });

  test('a batch UUID already owned by another saved unknown attempt refuses even without any transfer link', { timeout: config.scenarioTimeoutMs }, async (t) => {
    await scenario(t, async (context) => {
      const f = await seed(context); const foreign = await seed(context);
      const batchId = randomUUID();
      const foreignAttempt = createDownloadAttempt({ importCandidateId: foreign.candidate.id, operationRunId: foreign.owner.operationRunId,
        attemptId: batchId, requestedFiles: foreign.requestedFiles, username: foreign.candidate.username, sourceObservation: foreign.sourceObservation,
        providerBinding: { ...providerBinding, protocol: 'batch', version: '0.26.0' } });
      await context.pool.query("UPDATE import_execution_run_items SET planning_snapshot=jsonb_set(planning_snapshot,'{execution,handoff,attempt}',$2::jsonb) WHERE operation_run_id=$1", [foreign.owner.operationRunId, JSON.stringify(foreignAttempt)]);
      f.transfers[0].batchId = batchId;
      const h = adoption(context, f);
      await assert.rejects(h.service.getDownloadAdoptionReview(f.owner), { code: 'import_execution_download_adoption_not_current' });
      assert.deepEqual(await counts(context), { links: 0, phaseAudits: 0, adoptionAudits: 0 });
    });
  });
});
