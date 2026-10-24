/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createPreflightReviewFixture } from '../../testing/integration/preflight-review-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { seedOperatorTrackUnionFixture } from '../../testing/integration/operator-track-union-fixture.js';
import { createQualityReviewFailedCandidateStore } from '../../src/server/import-candidates/quality-review-failed-candidate-store.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { buildRecheckQualityContext } from '../../src/server/import-candidates/import-candidate-release-recheck-quality-policy.js';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';

const fixture = createPreflightReviewFixture(); const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const post = (client, id) => client.requestJson(`/api/v1/missing-music/decisions/${id}/search-again`, { method: 'POST', json: {}, headers: { 'Idempotency-Key': 'qualification-facts' } });
const audits = async pool => (await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='missing_music_search_again_requested'")).rows[0].count;
async function observeWait(observer, blockerPid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting', [blockerPid])).rows[0].waiting) return;
    await delay(10);
  }
  assert.fail('Expected the actual guarded command to wait for the candidate parent');
}
suite('Minimal current qualification scope through HTTP and shared track policy', () => {
  before(async () => { runtime = await fixture.createRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('restart succeeds while failed-candidate file and decision rows remain locked elsewhere', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      const fileId = (await f.pool.query('SELECT id FROM import_candidate_files WHERE import_candidate_id=$1 LIMIT 1', [f.candidateId])).rows[0].id;
      await f.pool.query("INSERT INTO import_candidate_file_decisions(import_candidate_id,import_candidate_file_id,decision_type) VALUES($1,$2,'skip') ON CONFLICT DO NOTHING", [f.candidateId, fileId]);
      const locker = new pg.Client(f.pool.options); let pending; let timer;
      try {
        await locker.connect(); await locker.query('BEGIN');
        await locker.query('SELECT id FROM import_candidate_files WHERE id=$1 FOR UPDATE', [fileId]);
        await locker.query('SELECT id FROM import_candidate_file_decisions WHERE import_candidate_file_id=$1 FOR UPDATE', [fileId]);
        pending = post(context.client, f.wantedId);
        const response = await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Qualification waited on unrelated child locks')), 5000); })]);
        assert.equal(response.response.status, 200, JSON.stringify(response.payload)); assert.equal(await audits(f.pool), 1);
        assert.equal(response.payload.action.searchPreparationStarted, true);
      } finally { clearTimeout(timer); await locker.query('ROLLBACK'); await locker.end(); await pending; }
    });
  });
  test('a parent lock wait rereads the committed original floor before publishing restart intent', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      const writer = new pg.Client(f.pool.options); const observer = new pg.Client(f.pool.options); let pending;
      try {
        await writer.connect(); await observer.connect(); await writer.query('BEGIN');
        const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await writer.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,minimumBitrateKbps}','512') WHERE id=$1", [f.candidateId]);
        pending = post(context.client, f.wantedId); await observeWait(observer, pid); await writer.query('COMMIT');
        const response = await pending; assert.equal(response.response.status, 200, JSON.stringify(response.payload));
        const requirement = (await f.pool.query('SELECT evidence FROM library_discovery_requests WHERE id=$1', [f.discoveryId])).rows[0].evidence.musicQueueRediscovery.qualityReviewRequirement;
        assert.equal(requirement.minimumBitrateKbps, 512); assert.equal(await audits(f.pool), 1);
      } finally { await writer.query('ROLLBACK'); await writer.end(); await observer.end(); await pending; }
    });
  });
  test('legacy nullish context keeps its floor while an explicit null track-scope marker still refuses', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const mode of ['legacy', 'malformed']) await runtime.runScenario(async context => {
      const f = await fixture.setup(context); await f.start();
      if (mode === 'legacy') await f.pool.query(`UPDATE import_candidates SET normalized_payload=(normalized_payload-'musicQueue')
        ||jsonb_build_object('musicQueue',NULL,'musicQueueContext',normalized_payload->'musicQueue'||'{"minimumBitrateKbps":640}'::jsonb) WHERE id=$1`, [f.candidateId]);
      else await f.pool.query("UPDATE import_candidates SET normalized_payload=jsonb_set(normalized_payload,'{musicQueue,operatorTrackScopes}','null') WHERE id=$1", [f.candidateId]);
      const response = await post(context.client, f.wantedId); assert.equal(response.response.status, mode === 'legacy' ? 200 : 409, JSON.stringify(response.payload));
      assert.equal(await audits(f.pool), mode === 'legacy' ? 1 : 0);
      if (mode === 'legacy') assert.equal((await f.pool.query('SELECT evidence FROM library_discovery_requests WHERE id=$1', [f.discoveryId])).rows[0].evidence.musicQueueRediscovery.qualityReviewRequirement.minimumBitrateKbps, 640);
    });
  });
  test('a real shared track union preserves source ownership, participants and current catalog refusal', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ getPoolFn }) => {
      const seeded = await seedOperatorTrackUnionFixture(); const pool = getPoolFn(); const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const participants = seeded.wanted.map(wanted => ({ wantedReleaseId: wanted.id, appUserId: wanted.app_user_id,
          operatorTrackScope: wanted.evidence.operatorTrackScope, qualityPreferences: {} }));
        const ownership = { sourceMediaRequestId: seeded.primary.id, sourceRequestedForUserId: seeded.user.id };
        const quality = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext({ metadataReleaseId: seeded.metadata.metadataReleaseId,
          evidence: ownership, operatorLinks: participants }, { queryable: client });
        const row = (await client.query(`INSERT INTO import_candidates(source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
          VALUES('facts-union','facts-union','one','private','/private','failed','{}',$1::jsonb,NOW()) RETURNING id`,
        [JSON.stringify({ musicQueue: quality, requestOwnership: { ...ownership, privateDetail: 'omit' } })])).rows[0];
        const store = createQualityReviewFailedCandidateStore({ getPoolFn }); const fullService = createImportCandidateService({ pool });
        const compare = async () => {
          const full = await fullService.getImportCandidate({ importCandidateId: row.id, queryable: client });
          const facts = await store.readFacts({ importCandidateId: row.id, queryable: client });
          assert.deepEqual(facts.normalizedPayload.requestOwnership, ownership);
          const expected = await buildRecheckQualityContext({ candidate: full, participants, queryable: client });
          assert.deepEqual(await buildRecheckQualityContext({ candidate: facts, participants, queryable: client }), expected);
          assert.equal(expected.operatorTrackParticipants.length, 2);
        };
        await compare();
        await client.query("UPDATE metadata_tracks SET title='Changed current catalog' WHERE id=$1", [seeded.metadata.metadataTrackId]);
        for (const candidate of [await fullService.getImportCandidate({ importCandidateId: row.id, queryable: client }), await store.readFacts({ importCandidateId: row.id, queryable: client })]) {
          await assert.rejects(buildRecheckQualityContext({ candidate, participants, queryable: client }), { code: 'operator_track_scope_verification_required' });
        }
      } finally { await client.query('ROLLBACK'); client.release(); }
    });
  });
});
