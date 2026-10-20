/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createSessionHttpClient } from '../server/http-session-client.js';
import { loginWithPassword } from './auth-helpers.js';

export async function qualifyNativeAudioCommandRefusals({ client, baseUrl, pool, fixtures }) {
  const [fixture, other] = fixtures;
  const root = '/api/v1/missing-music/decisions/' + fixture.wantedId;
  const select = root + '/matches/' + fixture.candidateId + '/select';
  const requester = createSessionHttpClient(baseUrl);
  const login = await loginWithPassword(requester, { username: fixture.owner.username, password: 'InitialPass123!' });
  assert.equal(login.response.status, 200);
  const refusals = [];
  async function refused(label, response, status) {
    assert.equal(response.response.status, status, JSON.stringify(response.payload));
    refusals.push({ label, status });
  }
  const post = (key, options = {}) => ({ method: 'POST', json: {}, headers: { 'Idempotency-Key': 'native-refusal-' + key }, ...options });
  await refused('anonymous detail', await createSessionHttpClient(baseUrl).requestJson(root), 401);
  await refused('own-scope detail', await requester.requestJson('/api/v1/missing-music/decisions/' + other.wantedId), 404);
  await refused('own-scope selection', await requester.requestJson('/api/v1/missing-music/decisions/' + other.wantedId + '/matches/' + other.candidateId + '/select', post('scope')), 404);
  await refused('requester start', await requester.requestJson(root + '/start-download', post('role')), 403);
  await refused('missing selection CSRF', await client.requestJson(select, post('select-csrf', { csrf: false })), 403);
  await refused('missing start CSRF', await client.requestJson(root + '/start-download', post('start-csrf', { csrf: false })), 403);
  await refused('different release match', await client.requestJson(root + '/matches/' + other.candidateId + '/select', post('match')), 404);
  await refused('no selected match', await client.requestJson(root + '/start-download', post('eligibility')), 409);
  await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [fixture.owner.id]);
  try {
    await refused('disabled target selection', await client.requestJson(select, post('disabled-select')), 409);
    await refused('disabled target start', await client.requestJson(root + '/start-download', post('disabled-start')), 409);
  } finally { await pool.query('UPDATE app_users SET is_disabled=false WHERE id=$1', [fixture.owner.id]); }
  assert.equal((await pool.query("SELECT count(*)::int count FROM import_candidate_events WHERE event_type='import_candidate_selected'")).rows[0].count, 0);
  assert.equal((await pool.query("SELECT count(*)::int count FROM operation_runs WHERE operation_type='import_candidate_execution_planning'")).rows[0].count, 0);
  assert.equal((await pool.query("SELECT count(*)::int count FROM import_candidates WHERE status='pending'")).rows[0].count, 2);
  await assert.rejects(pool.query("INSERT INTO activity_events (event_type) VALUES ('unregistered_fixture_event')"),
    { code: '23514', constraint: 'activity_events_event_type_check' });
  return { refusals, selectionEvents: 0, executionRuns: 0, unknownActivityTypeRefused: true };
}
