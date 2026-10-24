/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative, seedHiddenQualityReviewChoice } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const path = id => `/api/v1/missing-music/decisions/${id}`;
const read = async (client, id, cursor = null) => client.requestJson(`${path(id)}${cursor == null ? '' : `?matchCursor=${encodeURIComponent(cursor)}`}`);
suite('Current quality-review pages through PostgreSQL and HTTP', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('sparse forward and reverse traversal exposes every eligible choice once and later-page selection remains explicit', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      const { eligible } = await seedHiddenQualityReviewChoice(f); const all = [eligible];
      for (let n = 0; n < 24; n++) all.push(await seedQualityReviewAlternative(f));
      const first = (await read(context.client, f.wantedId)).payload;
      const second = (await read(context.client, f.wantedId, first.matchChoicePage.nextCursor)).payload;
      const third = (await read(context.client, f.wantedId, second.matchChoicePage.nextCursor)).payload;
      assert.deepEqual([first, second, third].map(p => p.matchChoices.length), [12, 12, 1]);
      assert.deepEqual([first, second, third].flatMap(p => p.matchChoices.map(c => c.id)), all.map(c => c.id).sort());
      assert.equal(first.matchChoicePage.previousCursor, null); assert.equal(third.matchChoicePage.nextCursor, null);
      const back = (await read(context.client, f.wantedId, third.matchChoicePage.previousCursor)).payload;
      assert.deepEqual(back.matchChoices, second.matchChoices);
      const start = (await read(context.client, f.wantedId, back.matchChoicePage.previousCursor)).payload;
      assert.deepEqual(start.matchChoices, first.matchChoices); assert.equal(start.matchChoicePage.previousCursor, null);
      for (const page of [first, second, third]) {
        assert.equal(page.permissions.canSearchAgain, false);
        assert.doesNotMatch(JSON.stringify(page), /sourceSearchId|normalizedPayload|folderPath|rawPayload/u);
      }
      const selected = third.matchChoices[0].id;
      const response = await context.client.requestJson(`${path(f.wantedId)}/matches/${selected}/select`, {
        method: 'POST', json: {}, headers: { 'Idempotency-Key': 'pagination-later-selection' },
      });
      assert.equal(response.response.status, 200, JSON.stringify(response.payload)); assert.equal(response.payload.action.downloadStarted, false);
      assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')")).rows[0].count, 0);
      assert.equal((await read(context.client, f.wantedId, second.matchChoicePage.nextCursor)).response.status, 409);
    });
  });

  test('cursors cannot cross actors or targets, survive policy changes or imply exhaustion after candidates disappear', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      for (let n = 0; n < 13; n++) await seedQualityReviewAlternative(f);
      const first = (await read(context.client, f.wantedId)).payload; const cursor = first.matchChoicePage.nextCursor;
      const owner = createSessionHttpClient(context.baseUrl); await loginWithPassword(owner, { username: f.owner.username, password: 'InitialPass123!' });
      assert.equal((await read(owner, f.wantedId, cursor)).response.status, 409);
      assert.equal((await read(owner, f.sibling.wantedId, cursor)).response.status, 404);
      assert.equal((await read(context.client, f.sibling.wantedId, cursor)).response.status, 409);
      assert.equal((await read(context.client, f.wantedId, `${cursor}x`)).response.status, 409);
      assert.equal((await context.client.requestJson(`${path(f.wantedId)}?matchCursor=bad&matchCursor=other`)).response.status, 409);
      const preferences = (await f.pool.query('SELECT user_preferences FROM app_users WHERE id=$1', [f.owner.id])).rows[0].user_preferences;
      await f.pool.query("UPDATE app_users SET user_preferences=jsonb_set(user_preferences,'{preferredFormat}','\"alac\"') WHERE id=$1", [f.owner.id]);
      assert.equal((await read(context.client, f.wantedId, cursor)).response.status, 409);
      await f.pool.query('UPDATE app_users SET user_preferences=$2::jsonb WHERE id=$1', [f.owner.id, JSON.stringify(preferences)]);
      await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.sibling.id]);
      assert.equal((await read(context.client, f.wantedId, cursor)).response.status, 409);
      await f.pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [f.sibling.id]);
      await f.pool.query("UPDATE import_candidates SET status='rejected' WHERE source_search_id=$1 AND status IN ('pending','held') AND id>$2", [f.searchId, first.matchChoices.at(-1).id]);
      assert.equal((await read(context.client, f.wantedId, cursor)).response.status, 409);
      const current = (await read(context.client, f.wantedId)).payload;
      assert.equal(current.matchChoices.length, 12); assert.equal(current.matchChoicePage.nextCursor, null);
      assert.equal(current.permissions.canSearchAgain, false);
    });
  });
});
