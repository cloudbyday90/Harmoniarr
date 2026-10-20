/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';

export async function startCanonicalNativeAudio({ client, pool, fixture, awaitQueuedActivity }) {
  const root = '/api/v1/missing-music/decisions/' + fixture.wantedId;
  const detail = await client.requestJson(root);
  assert.equal(detail.response.status, 200, JSON.stringify(detail.payload));
  assert.equal(detail.payload.permissions.canSelectMatch, true, JSON.stringify(detail.payload));
  assert.ok(detail.payload.matchChoices.some(row => row.id === fixture.candidateId));
  const selectPath = root + '/matches/' + fixture.candidateId + '/select';
  const post = (path, key) => client.requestJson(path, { method: 'POST', json: {}, headers: { 'Idempotency-Key': key } });
  const selection = await post(selectPath, 'native-audio-select-' + fixture.wantedId);
  assert.equal(selection.response.status, 200, JSON.stringify(selection.payload));
  assert.equal(selection.payload.action.downloadStarted, false);
  assert.equal(selection.payload.action.targetUserId, fixture.owner.id);
  const repeatedSelection = await post(selectPath, 'native-audio-select-' + fixture.wantedId);
  assert.equal(repeatedSelection.response.status, 200); assert.deepEqual(repeatedSelection.payload, selection.payload);
  const selected = await client.requestJson(root);
  assert.equal(selected.payload.permissions.canStartDownload, true, JSON.stringify(selected.payload));
  const started = await post(root + '/start-download', 'native-audio-start-' + fixture.wantedId);
  assert.equal(started.response.status, 202, JSON.stringify(started.payload));
  assert.equal(started.payload.action.targetUserId, fixture.owner.id);
  assert.equal(started.payload.action.matchId, fixture.candidateId);
  const repeatedStart = await post(root + '/start-download', 'native-audio-start-' + fixture.wantedId);
  assert.equal(repeatedStart.response.status, 202); assert.deepEqual(repeatedStart.payload, started.payload);
  const conflictingStart = await post(root + '/start-download', 'native-audio-conflict-' + fixture.wantedId);
  assert.equal(conflictingStart.response.status, 409);
  const runId = started.payload.action.operationRunId;
  assert.ok(runId);
  await awaitQueuedActivity();
  const runs = (await pool.query('SELECT id,triggered_by_user_id,summary FROM operation_runs WHERE id=$1', [runId])).rows;
  assert.equal(runs.length, 1); assert.equal(runs[0].summary.sourceWantedReleaseId, fixture.wantedId);
  assert.equal(runs[0].summary.selectedCandidateId, fixture.candidateId);
  assert.equal(runs[0].summary.triggerSource, 'missing_music_manual');
  assert.notEqual(runs[0].triggered_by_user_id, fixture.owner.id);
  const events = (await pool.query("SELECT actor_user_id,details FROM import_candidate_events WHERE import_candidate_id=$1 AND event_type='import_candidate_selected'", [fixture.candidateId])).rows;
  assert.equal(events.length, 1); assert.equal(events[0].actor_user_id, runs[0].triggered_by_user_id);
  assert.equal(events[0].details.missingMusic.targetUserId, fixture.owner.id);
  const activity = (await pool.query("SELECT actor_user_id,extra_payload FROM activity_events WHERE entity_id=$1 AND event_type='music_queue_download_queued'", [fixture.wantedId])).rows;
  assert.equal(activity.length, 1); assert.equal(activity[0].actor_user_id, runs[0].triggered_by_user_id);
  assert.equal(activity[0].extra_payload.operationRunId, runId);
  assert.equal(activity[0].extra_payload.importCandidateId, fixture.candidateId);
  const feed = await client.requestJson('/api/v1/activity/feed?eventType=music_queue_download_queued');
  assert.equal(feed.response.status, 200);
  assert.ok(feed.payload.events.every(row => row.eventType === 'music_queue_download_queued'));
  assert.equal(feed.payload.events.filter(row => row.entityId === fixture.wantedId).length, 1);
  const audit = (await pool.query("SELECT actor_user_id,actor_type FROM audit_events WHERE entity_id=$1 AND event_type='import_candidate_execution_started'", [runId])).rows;
  assert.equal(audit.length, 1); assert.equal(audit[0].actor_type, 'user'); assert.equal(audit[0].actor_user_id, runs[0].triggered_by_user_id);
  assert.equal((await pool.query("SELECT count(*)::int count FROM operation_runs WHERE operation_type='import_candidate_execution_planning' AND summary->>'sourceWantedReleaseId'=$1", [fixture.wantedId])).rows[0].count, 1);
  return { operationRunId: runId, actorUserId: runs[0].triggered_by_user_id, selectionReplayed: true, startReplayed: true, activeRunRefused: true, queuedActivity: true, requiredAudit: true };
}
