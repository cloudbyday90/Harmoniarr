/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative, seedHiddenQualityReviewChoice } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createImportCandidateQualityReviewCandidateStore } from '../../src/server/import-candidates/import-candidate-quality-review-candidate-store.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const detailPath = id => `/api/v1/missing-music/decisions/${id}`;
const select = (client, wanted, match, key = 'eligible-choice') => client.requestJson(`${detailPath(wanted)}/matches/${match}/select`, {
  method: 'POST', json: {}, headers: { 'Idempotency-Key': key },
});
const selectedCount = async pool => (await pool.query("SELECT count(*)::int AS count FROM import_candidate_events WHERE event_type='import_candidate_selected'")).rows[0].count;

suite('Eligible quality-review shortlist through current PostgreSQL and HTTP', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('a recipient can see and select an eligible choice hidden by fifty-one higher raw scores, with replay and no download', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      const { eligible } = await seedHiddenQualityReviewChoice(f); const bytes = await readFile(f.sourcePath);
      const [raw] = await createLibraryWantedReleaseStore({ getPoolFn: () => f.pool }).listWantedReleasesWithMetadata({
        appUserIds: [f.owner.id], wantedReleaseId: f.wantedId, limit: 1,
      });
      assert.equal(raw.discoveryRequest.importReviewSummary.matches.some(match => match.matchId === eligible.id), false,
        'The fixture must actually exclude this candidate from the legacy raw shortlist');
      const owner = createSessionHttpClient(context.baseUrl); await loginWithPassword(owner, { username: f.owner.username, password: 'InitialPass123!' });
      const detail = (await owner.requestJson(detailPath(f.wantedId))).payload;
      assert.deepEqual(detail.matchChoices.map(choice => choice.id), [eligible.id]); assert.equal(detail.permissions.canChooseAnotherMatch, true);
      assert.equal(detail.permissions.canSearchAgain, false);
      assert.deepEqual(Object.keys(detail.matchChoices[0]).sort(), ['fileCount', 'formats', 'id', 'totalSizeBytes']);
      assert.doesNotMatch(JSON.stringify(detail), /normalizedPayload|sourceSearchId|folderPath|source-user|rawPayload/u);
      assert.equal((await select(owner, f.sibling.wantedId, eligible.id, 'foreign-target')).response.status, 404);
      assert.equal((await select(owner, f.wantedId, 'not-a-uuid', 'malformed')).response.status, 400);
      const foreign = await seedQualityReviewAlternative(f, { sourceSearchId: 'another-search' });
      assert.equal((await select(owner, f.wantedId, foreign.id, 'foreign-source')).response.status, 409);
      assert.equal((await select(owner, f.wantedId, f.candidateId, 'rejected-download')).response.status, 409);
      assert.equal(await selectedCount(f.pool), 0);
      const response = await select(owner, f.wantedId, eligible.id);
      assert.equal(response.response.status, 200, JSON.stringify(response.payload)); assert.equal(response.payload.action.downloadStarted, false);
      assert.deepEqual((await select(owner, f.wantedId, eligible.id)).payload, response.payload);
      assert.equal(await selectedCount(f.pool), 1);
      assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='import_candidate_selected'")).rows[0].count, 1);
      assert.equal((await f.pool.query("SELECT count(*)::int AS count FROM operation_runs WHERE operation_type IN ('import_candidate_apply','import_candidate_execution')")).rows[0].count, 0);
      assert.equal((await f.module.importCandidateService.getImportCandidate({ importCandidateId: f.candidateId })).status, 'failed');
      assert.deepEqual(await readFile(f.sourcePath), bytes);
      assert.equal((await owner.requestJson(detailPath(f.wantedId))).payload.decision.status.nextAction, 'download_now');
    });
  });

  test('batch facts agree with full-candidate policy and the stable public projection retains only twelve eligible choices', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start(); const eligible = [];
      for (let index = 0; index < 15; index++) eligible.push(await seedQualityReviewAlternative(f));
      await seedQualityReviewAlternative(f, { extension: 'mp3' });
      await seedQualityReviewAlternative(f, { context: { profileCode: 'any_available', wantedReleaseId: f.wantedId } });
      await f.pool.query(`UPDATE import_candidates SET normalized_payload=normalized_payload ||
        '{"username":"private-peer","folderPath":"/private","bitRateKbps":"320","audioFormat":"flac"}' WHERE id=$1`, [eligible.at(-1).id]);
      const scopeService = f.module.importCandidateQualityReviewScopeService;
      const scope = await scopeService.readScope({ appUserId: f.owner.id, wantedReleaseId: f.wantedId });
      const page = await createImportCandidateQualityReviewCandidateStore({ getPoolFn: () => f.pool }).listCandidatePage({ sourceSearchId: f.searchId });
      for (const candidate of page) {
        const full = await f.module.importCandidateService.getImportCandidate({ importCandidateId: candidate.id });
        assert.equal(scopeService.isEligible(candidate, scope), scopeService.isEligible(full, scope), candidate.id);
        assert.doesNotMatch(JSON.stringify(candidate), /private-peer|\/private|rawPayload|folderPath|username/u);
      }
      const retained = page.find(row => row.id === eligible.at(-1).id);
      assert.equal(retained.normalizedPayload.bitRateKbps, '320'); assert.equal(retained.normalizedPayload.audioFormat, 'flac');
      const first = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.deepEqual(first.matchChoices.map(choice => choice.id), eligible.map(row => row.id).sort().slice(0, 12));
      assert.equal(first.permissions.canSearchAgain, false); assert.equal(await selectedCount(f.pool), 0);
      const second = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.deepEqual(second.matchChoices, first.matchChoices);
    });
  });

  test('an offered choice does not authorize selection after policy or shared-recipient eligibility changes', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start(); const candidate = await seedQualityReviewAlternative(f);
      assert.equal((await context.client.requestJson(detailPath(f.wantedId))).payload.matchChoices[0].id, candidate.id);
      await f.pool.query(`UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,profileCode}','"any_available"') WHERE id=$1`, [candidate.id]);
      assert.equal((await select(context.client, f.wantedId, candidate.id)).response.status, 409);
      await f.pool.query('UPDATE import_candidates SET normalized_payload=$2::jsonb WHERE id=$1', [candidate.id, JSON.stringify(candidate.normalizedPayload)]);
      await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.sibling.id]);
      const detail = (await context.client.requestJson(detailPath(f.wantedId))).payload;
      assert.deepEqual(detail.matchChoices, []); assert.equal(detail.permissions.canSelectMatch, false); assert.equal(detail.permissions.canSearchAgain, false);
      assert.equal((await select(context.client, f.wantedId, candidate.id, 'disabled-participant')).response.status, 409);
      assert.equal(await selectedCount(f.pool), 0);
    });
  });
});
