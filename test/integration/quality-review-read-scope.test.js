/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { before, after, suite, test } from 'node:test';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { seedQualityReviewAlternative } from '../../testing/integration/quality-review-match-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createQualityReviewPageService } from '../../src/server/import-candidates/import-candidate-quality-review-page-service.js';
import { createQualityReviewScanService } from '../../src/server/import-candidates/import-candidate-quality-review-scan-service.js';
import { createQualityReviewCursorPolicy } from '../../src/server/import-candidates/import-candidate-quality-review-cursor-policy.js';
import { createImportCandidateQualityReviewCandidateStore } from '../../src/server/import-candidates/import-candidate-quality-review-candidate-store.js';
import { createImportCandidateSearchRevisionStore } from '../../src/server/import-candidates/import-candidate-search-revision-store.js';
import { createQualityReviewSearchRunStore } from '../../src/server/import-candidates/quality-review-search-run-store.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const read = (client, id, cursor = null) => client.requestJson(`/api/v1/missing-music/decisions/${id}${cursor == null ? '' : `?matchCursor=${encodeURIComponent(cursor)}`}`);
function compareReaders(f) {
  const scope = f.module.importCandidateQualityReviewScopeService; const getPoolFn = () => f.pool;
  // Both actual readers use the same navigation key/clock so cursor equality is observable.
  const dependencies = { cursorPolicy: createQualityReviewCursorPolicy({ key: Buffer.alloc(32, 7), now: () => 1 }),
    scanCandidates: createQualityReviewScanService({ candidateStore: createImportCandidateQualityReviewCandidateStore({ getPoolFn }), isEligible: scope.isEligible }),
    revisionStore: createImportCandidateSearchRevisionStore({ getPoolFn }), searchRunStore: createQualityReviewSearchRunStore({ getPoolFn }) };
  const full = createQualityReviewPageService({ ...dependencies, readScope: scope.readScope });
  const minimal = createQualityReviewPageService({ ...dependencies, readScope: scope.readQualificationScope });
  const input = { actorUserId: f.admin.id, actorRole: 'admin', appUserId: f.owner.id, wantedReleaseId: f.wantedId };
  return { full, minimal, input, compare: async extra => {
    const expected = await full({ ...input, ...extra }); assert.deepEqual(await minimal({ ...input, ...extra }), expected); return expected;
  } };
}
const domainCounts = async pool => (await pool.query(`SELECT
  (SELECT count(*)::int FROM operation_runs) AS runs,
  (SELECT count(*)::int FROM audit_events) AS audits,
  (SELECT count(*)::int FROM import_candidate_events) AS events,
  (SELECT jsonb_agg(evidence ORDER BY id) FROM library_discovery_requests) AS discovery`)).rows[0];

suite('Minimal read-only quality-review scope through real PostgreSQL and HTTP', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('large failed detail stays out of real GET reads while full/minimal choices and bidirectional cursors match', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      for (let n = 0; n < 13; n++) await seedQualityReviewAlternative(f);
      const noise = `read-scope-private-${randomBytes(64 * 1024).toString('hex')}`;
      await f.pool.query(`UPDATE import_candidates SET raw_payload=jsonb_build_object('privateDetail',$2::text),
        normalized_payload=normalized_payload||jsonb_build_object('unrelated',$2::text) WHERE id=$1`, [f.candidateId, noise]);
      await f.pool.query(`INSERT INTO import_candidate_files(import_candidate_id,source_file_index,filename,folder_path,extension,size_bytes,raw_payload)
        SELECT $1,10000+n,'private-'||n||'.flac','/private/failed','flac',1,jsonb_build_object('detail',$2::text)
        FROM generate_series(1,2048) n`, [f.candidateId, 'read-scope-private-file']);
      const parity = compareReaders(f); const first = await parity.compare();
      const second = await parity.compare({ matchCursor: first.matchChoicePage.nextCursor });
      const back = await parity.compare({ matchCursor: second.matchChoicePage.previousCursor });
      assert.deepEqual(back.candidates, first.candidates); assert.deepEqual([first.candidates.length, second.candidates.length], [12, 1]);
      assert.equal(second.canSearchAgain, false);
      const beforeReads = await domainCounts(f.pool); const queries = []; const original = f.pool.query;
      const observed = t.mock.method(f.pool, 'query', function (...args) {
        const sql = typeof args[0] === 'string' ? args[0] : args[0].text;
        const values = typeof args[0] === 'string' ? args[1] : args[0].values;
        if (values?.[0] === f.candidateId) queries.push(sql);
        return Reflect.apply(original, this, args);
      });
      try {
        const page = await read(context.client, f.wantedId); assert.equal(page.response.status, 200);
        const next = await read(context.client, f.wantedId, page.payload.matchChoicePage.nextCursor); assert.equal(next.response.status, 200);
        assert.deepEqual(page.payload.matchChoices.map(c => c.id), first.candidates.map(c => c.id));
        assert.deepEqual(next.payload.matchChoices.map(c => c.id), second.candidates.map(c => c.id));
        for (const result of [page.payload, next.payload]) {
          assert.equal(result.permissions.canSearchAgain, false); assert.equal(result.permissions.canSelectMatch, true);
          assert.equal(result.libraryAddReview.reasonCode, 'suspicious_lossless');
          assert.doesNotMatch(JSON.stringify(result), /read-scope-private|normalizedPayload|rawPayload|sourceSearchId|folderPath/u);
        }
      } finally { observed.mock.restore(); }
      assert.equal(queries.filter(sql => sql.includes('WITH saved AS MATERIALIZED')).length, 2);
      assert.doesNotMatch(queries.join('\n'), /SELECT\s+\*|import_candidate_files|import_candidate_file_decisions|FOR UPDATE|raw_payload/u);
      assert.deepEqual(await domainCounts(f.pool), beforeReads, 'GET must not queue work or publish domain evidence');
    });
  });
  test('fresh access, legacy policy and malformed or disabled shared scope retain refusal and cursor freshness', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context, { shared: true }); await f.start();
      for (let n = 0; n < 13; n++) await seedQualityReviewAlternative(f);
      const first = (await read(context.client, f.wantedId)).payload; const cursor = first.matchChoicePage.nextCursor;
      const owner = createSessionHttpClient(context.baseUrl); await loginWithPassword(owner, { username: f.owner.username, password: 'InitialPass123!' });
      assert.equal((await read(owner, f.wantedId)).response.status, 200);
      assert.equal((await read(owner, f.sibling.wantedId)).response.status, 404);
      assert.equal((await read(owner, f.wantedId, cursor)).response.status, 409);
      await f.pool.query(`UPDATE import_candidates SET normalized_payload=(normalized_payload-'musicQueue')
        ||jsonb_build_object('musicQueue',NULL,'musicQueueContext',normalized_payload->'musicQueue'||'{"minimumBitrateKbps":640}'::jsonb) WHERE id=$1`, [f.candidateId]);
      assert.equal((await read(context.client, f.wantedId, cursor)).response.status, 409);
      const parity = compareReaders(f); await parity.compare();
      const legacy = await f.module.importCandidateQualityReviewScopeService.readQualificationScope(parity.input);
      assert.equal(legacy.requiredContext.minimumBitrateKbps, 640);
      await f.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueueContext,operatorTrackScopes}','null') WHERE id=$1", [f.candidateId]);
      assert.deepEqual(await parity.compare(), { candidates: [], canSearchAgain: false });
      const malformed = await read(context.client, f.wantedId); assert.equal(malformed.response.status, 200);
      assert.deepEqual(malformed.payload.matchChoices, []); assert.equal(malformed.payload.permissions.canSearchAgain, false);
      await f.pool.query("UPDATE import_candidates SET normalized_payload=normalized_payload#-'{musicQueueContext,operatorTrackScopes}' WHERE id=$1", [f.candidateId]);
      await f.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [f.sibling.id]);
      assert.deepEqual(await parity.compare(), { candidates: [], canSearchAgain: false });
      const disabled = await read(context.client, f.wantedId); assert.equal(disabled.response.status, 200);
      assert.deepEqual(disabled.payload.matchChoices, []); assert.equal(disabled.payload.permissions.canSelectMatch, false);
      assert.equal(disabled.payload.permissions.canSearchAgain, false);
    });
  });
});
