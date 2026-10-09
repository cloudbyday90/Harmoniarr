/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { createImportCandidateDownloadOriginService } from '../../src/server/import-candidates/import-candidate-download-origin-service.js';
import { createImportCandidateDownloadOriginStore } from '../../src/server/import-candidates/import-candidate-download-origin-store.js';
import { createImportExecutionHandoffService } from '../../src/server/import-candidates/import-execution-handoff-service.js';
import { createImportExecutionHandoffStore } from '../../src/server/import-candidates/import-execution-handoff-store.js';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { initializeImportExecutionRunItems, replaceImportExecutionRunItems } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createMusicQueueRecoveryFixtureContext, seedMusicQueueRecoveryFixture } from './music-queue-recovery-fixtures.js';

export async function seedImportExecutionOriginFixture(t, { getPoolFn, createProvider = null }) {
  const context = createMusicQueueRecoveryFixtureContext({ getPoolFn });
  const f = await seedMusicQueueRecoveryFixture(context, { shared: true, fallback: true });
  const state = { evidence: null, posts: 0, reads: 0, version: '0.26.0' };
  const server = createServer((request, response) => {
    if (request.method !== 'GET') { state.posts += 1; response.writeHead(405); response.end(); return; }
    state.reads += 1;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(request.url === '/api/v0/application/version' ? state.version : state.evidence));
  });
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const settings = { baseUrl: `http://127.0.0.1:${server.address().port}`, apiKey: 'controlled-origin-key', requestTimeoutMs: 1000 };
  const provider = createProvider ? createProvider({ settings, pool: context.pool }) : createSlskdService({ getClientConfig: async () => settings });
  const evidenceStore = createImportExecutionHandoffStore({ getPoolFn });
  const handoff = createImportExecutionHandoffService({ store: evidenceStore, transferLinkStore: createImportExecutionTransferLinkStore({ getPoolFn }),
    withTransaction: context.withTransaction });
  await context.pool.query("UPDATE import_candidates SET status='selected',updated_at=NOW() WHERE id=$1", [f.candidate.id]);
  const candidate = await evidenceStore.getCandidate(f.candidate.id);
  // This fixture represents a persisted uncertain episode from before the
  // future-only preparation protocol, rather than retroactively certifying it.
  await context.pool.query("UPDATE operation_runs SET summary=summary-'downloadPreparationProtocol' WHERE id=$1", [f.originRunId]);
  await replaceImportExecutionRunItems(f.originRunId, [{ importCandidateId: candidate.id, position: 1, itemStatus: 'ready',
    statusMessage: 'Controlled unused planning', planningSnapshot: { candidate: { id: candidate.id }, execution: {} } }], context.pool);
  const dispatch = await provider.prepareDownloadDispatch();
  const prepared = await handoff.prepareDownloadHandoff({ importCandidateId: candidate.id, operationRunId: f.originRunId,
    requestedFiles: candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes })),
    username: candidate.username, sourceObservation: captureRecoveryObservation(candidate), providerBinding: dispatch.binding });
  state.evidence = { id: prepared.attempt.attemptId, username: prepared.attempt.username, direction: 'Download',
    transfers: prepared.attempt.requestedFiles.map((file) => ({ ...file, id: randomUUID(), username: prepared.attempt.username,
      batchId: prepared.attempt.attemptId, direction: 'Download', state: 'InProgress', removed: false, exception: '' })) };
  await context.pool.query(`UPDATE operation_runs SET status='failed',finished_at=NOW(),
    summary=summary||'{"executionMode":"download_enqueue","requestedCandidateCount":1}'::jsonb WHERE id=$1`, [f.originRunId]);
  const newer = await context.executionRuns.createOperationRun({ status: 'pending', requestedCandidateCount: 1,
    summary: { executionMode: 'download_enqueue', selectedCandidateId: candidate.id, requestedCandidateCount: 1,
      sourceSearchId: candidate.sourceSearchId, sourceWantedReleaseId: f.wantedId, triggerSource: 'missing_music_manual' } });
  await initializeImportExecutionRunItems(newer.id, [{ importCandidateId: candidate.id, position: 1, itemStatus: 'ready',
    statusMessage: 'Newer allocated planning', planningSnapshot: { candidate: { id: candidate.id }, execution: {} } }], context.pool);
  const actor = (await context.pool.query(`INSERT INTO app_users(username,password_hash,role,must_change_password,user_preferences)
    VALUES($1,'controlled-origin-hash','admin',false,'{}'::jsonb) RETURNING id`, [`origin-${randomUUID()}`])).rows[0];
  const session = (await context.pool.query(`INSERT INTO refresh_tokens(app_user_id,token_hash,token_family_id,issued_at,expires_at)
    VALUES($1,$2,$3,NOW(),NOW()+INTERVAL '1 day') RETURNING id`, [actor.id, randomUUID(), randomUUID()])).rows[0];
  const store = createImportCandidateDownloadOriginStore({ getPoolFn });
  const owner = { actorUserId: actor.id, refreshTokenId: session.id, operationRunId: f.originRunId, importCandidateId: candidate.id };
  const createService = (overrides = {}) => createImportCandidateDownloadOriginService({ store,
    prepareDownloadDispatch: provider.prepareDownloadDispatch, getDownloadBatchEvidence: provider.getDownloadBatchEvidence,
    confirmDownloadHandoff: handoff.confirmDownloadHandoff, assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed,
    withTransaction: context.withTransaction, ...overrides });
  return { ...context, recoveryStore: context.store, fixture: f, candidate, sourceRunId: f.originRunId, newerRunId: newer.id, state, settings, provider,
    evidenceStore, handoff, store, owner, createService, service: createService() };
}

export async function reviewImportExecutionOrigin(context, service = context.service) {
  const review = await service.getDownloadOriginReview(context.owner);
  if (!review.downloadOriginReview.canRestore) throw new Error(`Origin fixture not eligible: ${review.downloadOriginReview.reasonCode}`);
  return { reviewDigest: review.downloadOriginReview.reviewDigest };
}

export async function readImportExecutionOriginCounts(context) {
  return { links: (await context.pool.query('SELECT COUNT(*)::integer count FROM import_execution_transfer_links')).rows[0].count,
    audits: (await context.pool.query('SELECT COUNT(*)::integer count FROM audit_events')).rows[0].count,
    events: (await context.pool.query('SELECT COUNT(*)::integer count FROM import_candidate_events')).rows[0].count };
}
