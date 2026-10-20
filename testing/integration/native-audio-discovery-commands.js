/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createSessionHttpClient } from '../server/http-session-client.js';
import { loginWithPassword } from './auth-helpers.js';
import { nativePeer } from '../slskd/fixture-data.js';

export async function discoverCanonicalNativeAudio({ client, baseUrl, pool, library, fixtures, assertSearchIdle }) {
  const root = fixture => '/api/v1/missing-music/decisions/' + fixture.wantedId;
  const post = key => ({ method: 'POST', json: {}, headers: { 'Idempotency-Key': 'native-find-' + key } });
  const requester = createSessionHttpClient(baseUrl);
  assert.equal((await loginWithPassword(requester, { username: fixtures[0].owner.username, password: 'InitialPass123!' })).response.status, 200);
  const refusals = [];
  async function refused(label, result, status) {
    assert.equal(result.response.status, status, JSON.stringify(result.payload));
    refusals.push({ label, status });
  }
  const path = root(fixtures[0]) + '/find-matches';
  await refused('anonymous search', await createSessionHttpClient(baseUrl).requestJson(path, post('anonymous')), 401);
  await refused('missing search CSRF', await client.requestJson(path, { ...post('csrf'), csrf: false }), 403);
  await refused('out-of-scope search', await requester.requestJson(root(fixtures[1]) + '/find-matches', post('scope')), 404);
  await refused('forged search recipient', await client.requestJson(path, { ...post('body'), json: { appUserId: fixtures[1].owner.id } }), 400);
  await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [fixtures[0].owner.id]);
  try { await refused('disabled-target search', await client.requestJson(path, post('disabled')), 409); }
  finally { await pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [fixtures[0].owner.id]); }
  assert.equal((await pool.query("SELECT count(*)::int count FROM operation_runs WHERE operation_type='library_discovery_dispatch'")).rows[0].count, 0);
  assert.equal((await pool.query('SELECT count(*)::int count FROM import_candidates')).rows[0].count, 0);
  assert.ok(fixtures.every(fixture => !fixture.searchId), 'Refused commands must not reach search transport');
  await assertSearchIdle();
  const commands = [];
  for (const fixture of fixtures) {
    const before = await client.requestJson(root(fixture));
    assert.equal(before.response.status, 200);
    assert.equal(before.payload.permissions.canFindMatches, true, JSON.stringify(before.payload));
    const options = post(fixture.wantedId);
    const accepted = await client.requestJson(root(fixture) + '/find-matches', options);
    assert.equal(accepted.response.status, 200, JSON.stringify(accepted.payload));
    assert.equal(accepted.payload.action.targetUserId, fixture.owner.id);
    const replay = await client.requestJson(root(fixture) + '/find-matches', options);
    assert.equal(replay.response.status, 200); assert.deepEqual(replay.payload, accepted.payload);
    const repeatedIntent = await client.requestJson(root(fixture) + '/find-matches', post('repeat-' + fixture.wantedId));
    assert.equal(repeatedIntent.response.status, 200, JSON.stringify(repeatedIntent.payload));
    assert.equal(repeatedIntent.payload.action.intentAlreadyRecorded, true);
    assert.equal(repeatedIntent.payload.action.searchPreparationStarted, false);
    commands.push(accepted.payload.action);
  }
  assert.equal(commands[0].searchPreparationStarted, true);
  assert.equal(commands[1].dispatchAlreadyActive, true);
  const claimed = await createOperationQueueStore({ getPoolFn: () => pool }).claimNextRunnableRun({ operationTypes: ['library_discovery_dispatch'] });
  assert.equal(claimed?.id, commands[0].discoveryRunId);
  assert.equal(claimed.summary.triggerSource, 'missing_music_find_matches');
  const { completion } = await library.libraryDiscoveryWorker.startWorkerRun({ runId: claimed.id,
    triggeredByUserId: claimed.triggeredByUserId, triggerSource: claimed.summary.triggerSource });
  assert.ok(completion && typeof completion.then === 'function');
  await completion;
  const run = await library.libraryDiscoveryRunStore.getRunById(claimed.id);
  assert.equal(run.status, 'completed', JSON.stringify(run));
  const persisted = (await pool.query('SELECT summary FROM operation_runs WHERE id=$1', [claimed.id])).rows[0];
  assert.equal(run.dispatchedCount, fixtures.length, JSON.stringify({ run, summary: persisted.summary })); assert.equal(run.failedCount, 0);
  assert.equal(run.candidateCount, fixtures.length * 2); assert.equal(run.fileCount, fixtures.length * 2);
  for (const fixture of fixtures) {
    const candidates = (await pool.query('SELECT id,username,status,normalized_payload FROM import_candidates WHERE source_search_id=$1', [fixture.searchId])).rows;
    assert.equal(candidates.length, 2); assert.ok(candidates.every(candidate => candidate.status === 'pending'));
    assert.ok(Number.isFinite(candidates[0].normalized_payload.compositeScore));
    assert.equal(candidates[0].normalized_payload.compositeScore, candidates[1].normalized_payload.compositeScore);
    const candidate = candidates.find(row => row.username === nativePeer);
    assert.ok(candidate);
    assert.equal(candidate.normalized_payload.discoveryScope.metadataReleaseId, fixture.metadata.metadataReleaseId);
    fixture.candidateId = candidate.id;
    fixture.importCandidateId = candidate.id;
    const files = (await pool.query('SELECT filename,size_bytes FROM import_candidate_files WHERE import_candidate_id=$1', [candidate.id])).rows;
    assert.equal(files.length, 1); assert.equal(files[0].filename, fixture.file.filename.split('\\').at(-1));
    assert.equal(Number(files[0].size_bytes), fixture.file.size);
    const discovery = (await pool.query('SELECT evidence FROM library_discovery_requests WHERE id=$1', [fixture.discoveryId])).rows[0];
    assert.equal(discovery.evidence.lastSearchId, fixture.searchId);
    const audits = (await pool.query("SELECT actor_user_id,details FROM audit_events WHERE event_type='missing_music_initial_search_requested' AND entity_id=$1", [fixture.wantedId])).rows;
    assert.equal(audits.length, 1); assert.equal(audits[0].actor_user_id, claimed.triggeredByUserId);
    assert.equal(audits[0].details.requestedForUserId, fixture.owner.id);
    assert.notEqual(audits[0].actor_user_id, fixture.owner.id);
    const refreshed = await client.requestJson(root(fixture));
    assert.equal(refreshed.payload.permissions.canFindMatches, false);
    assert.equal(refreshed.payload.permissions.canSelectMatch, true, JSON.stringify(refreshed.payload));
    assert.ok(refreshed.payload.matchChoices.some(row => row.id === candidate.id));
  }
  assert.equal((await pool.query("SELECT count(*)::int count FROM operation_runs WHERE operation_type='library_discovery_dispatch'")).rows[0].count, 1);
  return { refusals, commands, discoveryRunId: claimed.id, realWorkerCompleted: true, candidateCount: fixtures.length * 2, requiredAudit: true };
}
