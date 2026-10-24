/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative, seedQualityReviewScanRows } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const path = id => `/api/v1/missing-music/decisions/${id}`;
const read = (client, id, cursor = null) => client.requestJson(`${path(id)}${cursor == null ? '' : `?matchCursor=${encodeURIComponent(cursor)}`}`);
const restart = (client, id) => client.requestJson(`${path(id)}/search-again`, { method: 'POST', json: {}, headers: { 'Idempotency-Key': 'scan-budget-restart' } });
const audits = async pool => (await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count;

suite('Bounded detail scans with independent current restart authority', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('a hidden eligible choice after two hundred weak facts requires continuation and still prevents direct restart', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      const eligible = await seedQualityReviewAlternative(f);
      const first = (await read(context.client, f.wantedId)).payload;
      assert.deepEqual(first.matchChoices, []); assert.equal(first.matchChoicePage.scanIncomplete, true);
      assert.equal(first.permissions.canChooseAnotherMatch, true); assert.equal(first.permissions.canSelectMatch, false);
      assert.equal(first.permissions.canSearchAgain, false); assert.ok(first.matchChoicePage.nextCursor);
      assert.equal((await restart(context.client, f.wantedId)).response.status, 409); assert.equal(await audits(f.pool), 0);
      const second = (await read(context.client, f.wantedId, first.matchChoicePage.nextCursor)).payload;
      assert.deepEqual(second.matchChoices.map(c => c.id), [eligible.id]); assert.equal(second.matchChoicePage.scanIncomplete, false);
      assert.equal(second.permissions.canSearchAgain, false); assert.equal(second.matchChoicePage.nextCursor, null);
      const reverse = (await read(context.client, f.wantedId, second.matchChoicePage.previousCursor)).payload;
      assert.deepEqual(reverse.matchChoices, []); assert.equal(reverse.matchChoicePage.scanIncomplete, true);
      assert.equal(reverse.matchChoicePage.scanDirection, 'previous'); assert.equal(reverse.permissions.canSearchAgain, false);
      const back = (await read(context.client, f.wantedId, reverse.matchChoicePage.nextCursor)).payload;
      assert.deepEqual(back.matchChoices.map(c => c.id), [eligible.id]);
      assert.doesNotMatch(JSON.stringify(first), /fetchedCount|checkedCount|pageReads|normalizedPayload|sourceSearchId/u);
    });
  });

  test('exact-budget exhaustion requires another read and a fresh complete command guard before queueing search', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      const first = (await read(context.client, f.wantedId)).payload;
      assert.equal(first.permissions.canSearchAgain, false); assert.equal(first.matchChoicePage.scanIncomplete, true);
      const end = (await read(context.client, f.wantedId, first.matchChoicePage.nextCursor)).payload;
      assert.deepEqual(end.matchChoices, []); assert.equal(end.matchChoicePage.scanIncomplete, false);
      assert.equal(end.permissions.canSearchAgain, true); assert.equal(end.matchChoicePage.nextCursor, null);
      const response = await restart(context.client, f.wantedId);
      assert.equal(response.response.status, 200, JSON.stringify(response.payload)); assert.equal(response.payload.action.searchPreparationStarted, true);
      assert.equal(await audits(f.pool), 1);
      const queued = (await read(context.client, f.wantedId)).payload;
      assert.equal(queued.decision.status.code, 'queued_for_search'); assert.equal(queued.matchChoicePage, null);
      assert.equal(queued.permissions.canChooseAnotherMatch, false); assert.equal(queued.permissions.canSearchAgain, false);
      assert.equal((await read(context.client, f.wantedId, first.matchChoicePage.nextCursor)).response.status, 409);
    });
  });

  test('a completed empty walk cannot authorize restart after an eligible choice appears behind its cursor', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); await seedQualityReviewScanRows(f);
      const first = (await read(context.client, f.wantedId)).payload;
      await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{extensions}','["flac"]')
        WHERE id='00000000-0000-4000-8000-000000000001'`);
      const end = (await read(context.client, f.wantedId, first.matchChoicePage.nextCursor)).payload;
      assert.equal(end.permissions.canSearchAgain, true, 'A current-view continuation is a browsing inference, not a write proof');
      assert.equal((await restart(context.client, f.wantedId)).response.status, 409); assert.equal(await audits(f.pool), 0);
      const current = (await read(context.client, f.wantedId)).payload;
      assert.equal(current.matchChoices[0].id, '00000000-0000-4000-8000-000000000001');
      assert.equal(current.permissions.canSearchAgain, false);
    });
  });
});
