/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createSessionHttpClient } from '../../src/shared/http-session-client.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { seedDeploymentReviewCatalog } from './deployment-review-catalog.js';

/** Serve the already composed app on loopback inside the isolated container. */
export async function withDeploymentReviewWorkload({ application, pool, observation, signal }, work) {
  assert.equal(typeof application.app, 'function');
  const server = createServer(application.app); let client; let loggedIn = false;
  return withWorkerTaskCleanup(async () => {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    client = createSessionHttpClient(`http://127.0.0.1:${server.address().port}`);
    const bootstrapped = await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'mixed-review-admin', password: 'MixedReviewFixture123!' } });
    assert.equal(bootstrapped.response.status, 201); loggedIn = true;
    await pool.query('UPDATE app_users SET user_preferences=$2::jsonb WHERE id=$1', [bootstrapped.payload.user.id, JSON.stringify({ minimumQuality: 'lossless', preferredFormat: 'flac' })]);
    const { targets, corpus } = await seedDeploymentReviewCatalog({ pool, appUserId: bootstrapped.payload.user.id });
    const path = target => `/api/v1/missing-music/decisions/${target.wantedReleaseId}`;
    const get = async (target, phase, cursor = null) => observation.measure(phase, async () => {
      signal?.throwIfAborted();
      const result = await client.requestJson(`${path(target)}${cursor == null ? '' : `?matchCursor=${encodeURIComponent(cursor)}`}`);
      assert.equal(result.response.status, 200); assert.doesNotMatch(JSON.stringify(result.payload), /private-fixture-peer|normalizedPayload|rawPayload|folderPath/u);
      return result.payload;
    });
    return await work(async () => {
      const navigation = targets.navigation; let page = await get(navigation, 'page');
      assert.equal(page.matchChoices.length, 0); assert.equal(page.matchChoicePage.scanIncomplete, true);
      page = await get(navigation, 'page', page.matchChoicePage.nextCursor); assert.equal(page.matchChoices.length, 0);
      page = await get(navigation, 'page', page.matchChoicePage.nextCursor); assert.equal(page.matchChoices.length, 12);
      const choices = page.matchChoices.map(row => row.id);
      const last = await get(navigation, 'page', page.matchChoicePage.nextCursor); assert.equal(last.matchChoices.length, 1);
      const back = await get(navigation, 'reverse', last.matchChoicePage.previousCursor); assert.deepEqual(back.matchChoices.map(row => row.id), choices);
      const restarted = await observation.measure('restart', () => client.requestJson(`${path(targets.restart)}/search-again`, {
        method: 'POST', json: {}, headers: { 'Idempotency-Key': 'mixed-review-restart' },
      }));
      assert.equal(restarted.response.status, 200); assert.equal(restarted.payload.action.checkingMatches, true);
      const checking = await get(targets.restart, 'checking'); assert.equal(checking.decision.status.code, 'checking_matches');
      const runId = (await pool.query("SELECT id FROM operation_runs WHERE operation_type='quality_review_search' AND status='pending'")).rows[0].id;
      const queue = createOperationQueueStore({ getPoolFn: () => pool }); const handlers = createOperationQueueHandlers({ libraryModule: application.libraryModule });
      let steps = 0;
      while ((await pool.query('SELECT status FROM operation_runs WHERE id=$1', [runId])).rows[0].status === 'pending') {
        signal?.throwIfAborted(); assert.ok(++steps <= 4);
        await observation.measure('worker', async () => {
          // Explicit fixture scheduling control; retain actual queue claim, lease and owned completion.
          await pool.query("UPDATE operation_runs SET next_attempt_at=NOW() WHERE id=$1 AND operation_type='quality_review_search' AND status='pending'", [runId]);
          const claimed = await queue.claimNextRunnableRun({ operationTypes: ['quality_review_search'] }); assert.equal(claimed.id, runId);
          const accepted = await handlers.quality_review_search({ run: claimed }); await accepted.completion;
        });
      }
      assert.equal((await pool.query('SELECT status FROM operation_runs WHERE id=$1', [runId])).rows[0].status, 'completed');
      const queued = await get(targets.restart, 'queued'); assert.equal(queued.decision.status.code, 'queued_for_search');
      assert.equal(queued.permissions.canSearchAgain, false);
      const leases = (await pool.query(`SELECT count(*)::int AS count,
        count(*) FILTER(WHERE released_at IS NOT NULL AND status='completed')::int AS released,
        count(*) FILTER(WHERE released_at IS NULL AND expires_at>clock_timestamp())::int AS active
        FROM job_leases WHERE lease_key=$1`, [`quality_review_search:${runId}`])).rows[0];
      assert.deepEqual(leases, { count: 1, released: 1, active: 0 }); assert.equal(steps, 3);
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count, 1);
      return { ...observation.getEvidence(), navigationChoices: choices.length + last.matchChoices.length,
        weakFacts: corpus.alternatives - 13, failedCandidates: corpus.failed, failedFileRows: corpus.files,
        workerSteps: steps, queuedIntents: 1, releasedQualificationLeases: leases.released, activeQualificationLeases: leases.active };
    });
  }, async () => {
    let failed = false; let failure;
    const attempt = async operation => { try { await operation(); } catch (error) { if (!failed) { failed = true; failure = error; } } };
    await attempt(() => application.libraryModule.libraryQualityReviewSearchWorker.close());
    if (loggedIn) await attempt(async () => {
      const response = await client.requestJson('/api/v1/auth/logout', { method: 'POST', json: {} }); assert.equal(response.response.status, 200);
    });
    await attempt(async () => {
      server.closeIdleConnections();
      await new Promise((resolve, reject) => { server.close(error => { if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error); else resolve(); }); });
    });
    await attempt(() => observation.close());
    if (failed) throw failure;
  });
}
