/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { createQualityReviewFailedCandidateStore } from '../../src/server/import-candidates/quality-review-failed-candidate-store.js';
import { createImportCandidateService } from '../../src/server/import-candidates/import-candidate-service.js';
import { createImportCandidateReleaseRecheckStore } from '../../src/server/import-candidates/import-candidate-release-recheck-store.js';
import { buildRecheckQualityContext, getRecheckWantedReleaseIds } from '../../src/server/import-candidates/import-candidate-release-recheck-quality-policy.js';
import { canRetainRecoveryQualityContext } from '../../src/server/import-candidates/import-candidate-recovery-quality-policy.js';
import { buildQualityReviewSearchRequirement } from '../../src/server/library/library-quality-review-search-policy.js';
import { qualityReviewSearchContext } from '../../src/server/import-candidates/quality-review-search-policy.js';
import { qualityReviewCursorContext } from '../../src/server/import-candidates/import-candidate-quality-review-cursor-policy.js';
import { createOperatorTrackCatalogStore } from '../../src/server/metadata/operator-track-catalog-store.js';
import { seedMetadataReleaseFixture } from '../integration/metadata-fixtures.js';

const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function waitForBlock(observer, blockerPid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if ((await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting', [blockerPid])).rows[0].waiting) return;
    await delay(10);
  }
  assert.fail('Expected an independently observed database lock wait');
}
async function outcome(candidate, participants, queryable) {
  try {
    const requiredContext = await buildRecheckQualityContext({ candidate, participants, queryable });
    const wantedReleaseIds = getRecheckWantedReleaseIds(candidate);
    const scope = { failedCandidate: candidate, participants, wantedReleaseIds, requiredContext };
    return { requiredContext, requirement: buildQualityReviewSearchRequirement(scope),
      cursorContext: qualityReviewCursorContext({ actorUserId: id(6), actorRole: 'admin', appUserId: id(4), wantedReleaseId: participants[0]?.wantedReleaseId }, scope, id(7)),
      progressContext: qualityReviewSearchContext({ actorUserId: id(6), appUserId: id(4), wantedReleaseId: participants[0]?.wantedReleaseId }, scope, id(7)),
      retains: canRetainRecoveryQualityContext({ candidate: { normalizedPayload: { musicQueue: requiredContext } }, failedCandidate: candidate, requiredContext }) };
  } catch (error) { return { error: error.code ?? error.name }; }
}

/** Owned disposable database only; shared by host and packaged PostgreSQL. */
export async function qualifyQualificationCandidateFacts({ pool }) {
  const importCandidateId = id(1); const wantedReleaseId = id(2); const siblingId = id(3);
  const metadata = await seedMetadataReleaseFixture({ queryable: pool, artistName: 'Qualification facts', releaseTitle: 'Policy parity' });
  await pool.query(`INSERT INTO metadata_tracks(metadata_medium_id,metadata_recording_id,position,title,length_ms)
    VALUES($1,$2,2,'Second fixture track',2000)`, [metadata.metadataMediumId, metadata.metadataRecordingId]);
  const catalog = await createOperatorTrackCatalogStore({ getPoolFn: () => pool }).listTrackCatalog({ metadataReleaseIds: [metadata.metadataReleaseId] });
  const releaseScope = { version: 1, mode: 'release', metadataReleaseId: metadata.metadataReleaseId, tracks: catalog };
  const trackScope = { ...releaseScope, mode: 'tracks', tracks: [catalog[0]] };
  const participant = { wantedReleaseId, appUserId: id(4), qualityPreferences: {} };
  const consent = { mode: 'allow_fallback_quality', wantedReleaseId, minimumBitrateKbps: 512 };
  const base = { wantedReleaseId, profileCode: 'lossless_archive' };
  const saved = context => ({ musicQueue: context });
  const cases = [
    { payload: saved(base) },
    { payload: saved({ ...base, profileCode: 'any_available' }) },
    { payload: saved({ ...base, profileCode: 'high_quality', minimumBitrateKbps: 512 }) },
    ...[-1, 10001, '320', null].map(minimumBitrateKbps => ({ payload: saved({ ...base, minimumBitrateKbps }) })),
    { payload: saved({ ...base, qualityOverride: consent }), participants: [{ ...participant, qualityOverride: consent, qualityPreferences: { minimumQuality: 'high' } }] },
    { payload: saved({ ...base, qualityOverride: consent }) },
    { payload: saved({ ...base, qualityOverride: { ...consent, wantedReleaseId: siblingId } }) },
    { payload: saved({ ...base, wantedReleaseId: siblingId, wantedReleaseIds: [siblingId, wantedReleaseId], sharedOperatorDiscovery: true }),
      participants: [participant, { ...participant, wantedReleaseId: siblingId, appUserId: id(5), qualityPreferences: { minimumQuality: 'high' } }] },
    { payload: { musicQueueContext: { ...base, minimumBitrateKbps: 640 } } },
    { payload: { musicQueue: null, musicQueueContext: base } },
    { payload: { musicQueue: {}, musicQueueContext: base } },
    ...[null, [], {}, false].map(operatorTrackScopes => ({ payload: saved({ ...base, operatorTrackScopes }), refused: true })),
    ...[null, [], false].map(operatorTrackParticipants => ({ payload: saved({ ...base, operatorTrackParticipants }) })),
    { payload: saved({ ...base, operatorTrackScopes: [{ wantedReleaseId, scope: releaseScope }] }),
      participants: [{ ...participant, operatorTrackScope: releaseScope }] },
    { payload: { ...saved({ ...base, operatorTrackScopes: [{ wantedReleaseId, scope: trackScope }] }),
      requestOwnership: { sourceMediaRequestId: id(6), sourceRequestedForUserId: participant.appUserId } },
      participants: [{ ...participant, operatorTrackScope: trackScope }] },
    { payload: saved({ ...base, operatorTrackScopes: [{ wantedReleaseId, scope: { ...releaseScope, tracks: [{ ...catalog[0], title: 'Stale title' }] } }] }), refused: true },
    { payload: null }, { payload: ['malformed'] }, { payload: { musicQueue: ['malformed'], musicQueueContext: base } },
  ];
  const noise = `qualification-private-${randomBytes(64 * 1024).toString('hex')}`;
  await pool.query(`INSERT INTO import_candidates(id,source_provider,source_search_id,source_response_key,username,folder_path,status,raw_payload,normalized_payload,discovered_at)
    VALUES($1,'facts-fixture','qualification-facts','one','private-peer','/private/folder','failed',$2::jsonb,'{}',NOW())`, [importCandidateId, JSON.stringify({ providerDetail: noise })]);
  await pool.query(`INSERT INTO import_candidate_files(import_candidate_id,source_file_index,filename,folder_path,extension,size_bytes,raw_payload)
    SELECT $1,n,'fixture-'||n||'.flac','/private/folder','flac',1,jsonb_build_object('privateDetail',repeat('x',128)) FROM generate_series(1,2048) n`, [importCandidateId]);
  await pool.query(`INSERT INTO import_candidate_file_decisions(import_candidate_id,import_candidate_file_id,decision_type)
    SELECT import_candidate_id,id,'skip' FROM import_candidate_files WHERE import_candidate_id=$1`, [importCandidateId]);
  const narrow = createQualityReviewFailedCandidateStore({ getPoolFn: () => pool });
  const fullService = createImportCandidateService({ pool });
  let largestFactsBytes = 0; let smallestFullBytes = Infinity; let refusals = 0;
  for (const scenario of cases) {
    const payload = scenario.payload && !Array.isArray(scenario.payload) ? { unrelated: noise, ...structuredClone(scenario.payload) } : scenario.payload;
    if (payload?.musicQueue && !Array.isArray(payload.musicQueue)) payload.musicQueue.unrelatedDetail = noise;
    await pool.query('UPDATE import_candidates SET normalized_payload=$2::jsonb WHERE id=$1', [importCandidateId, JSON.stringify(payload)]);
    const readQueries = [];
    const queryable = { query: (sql, values) => { readQueries.push(sql); assert.doesNotMatch(sql, /import_candidate_files|import_candidate_file_decisions|raw_payload/u); return pool.query(sql, values); } };
    const facts = await narrow.readFacts({ importCandidateId, queryable });
    assert.equal(readQueries.length, 1);
    const full = await fullService.getImportCandidate({ importCandidateId, queryable: pool });
    assert.equal(full.files.length, 2048); assert.deepEqual(getRecheckWantedReleaseIds(facts), getRecheckWantedReleaseIds(full));
    const participants = scenario.participants ?? [participant];
    const expected = await outcome(full, participants, pool); const actual = await outcome(facts, participants, pool);
    assert.deepEqual(actual, expected);
    if (scenario.refused) { assert.equal(actual.error, 'operator_track_scope_verification_required'); refusals++; }
    assert.doesNotMatch(JSON.stringify(facts), /qualification-private-|private-peer|privateDetail|private\/folder|unrelatedDetail/u);
    assert.deepEqual(Object.keys(facts).sort(), ['id','normalizedPayload','sourceSearchId','status']);
    largestFactsBytes = Math.max(largestFactsBytes, Buffer.byteLength(JSON.stringify(facts)));
    smallestFullBytes = Math.min(smallestFullBytes, Buffer.byteLength(JSON.stringify(full)));
  }
  assert.ok(largestFactsBytes < smallestFullBytes);
  const locker = await pool.connect(); const guard = await pool.connect(); const observer = new pg.Client(pool.options);
  let pending;
  try {
    await observer.connect();
    const lockerPid = (await locker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const guardPid = (await guard.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const file = (await observer.query('SELECT id FROM import_candidate_files WHERE import_candidate_id=$1 ORDER BY id LIMIT 1', [importCandidateId])).rows[0].id;
    await locker.query('BEGIN');
    await locker.query('SELECT id FROM import_candidate_files WHERE id=$1 FOR UPDATE', [file]);
    await locker.query('SELECT id FROM import_candidate_file_decisions WHERE import_candidate_file_id=$1 FOR UPDATE', [file]);
    await guard.query('BEGIN'); await guard.query("SET LOCAL lock_timeout='250ms'");
    await narrow.lockFailedCandidate({ importCandidateId, queryable: guard }); await guard.query('ROLLBACK');
    await guard.query('BEGIN'); await guard.query("SET LOCAL statement_timeout='15s'");
    const legacy = createImportCandidateReleaseRecheckStore({ getPoolFn: () => pool });
    pending = legacy.lockCandidate({ importCandidateId, queryable: guard }).then(() => null, error => error);
    await waitForBlock(observer, lockerPid); await locker.query('COMMIT'); assert.equal(await pending, null); await guard.query('ROLLBACK');
    // Keep parent mutation and incoming evidence FK serialization unchanged.
    for (const sql of ['UPDATE import_candidates SET updated_at=NOW() WHERE id=$1',
      "INSERT INTO import_candidate_events(import_candidate_id,event_type,occurred_at) VALUES($1,'import_candidate_held',NOW())",
      'DELETE FROM import_candidates WHERE id=$1']) {
      await guard.query('BEGIN'); await narrow.lockFailedCandidate({ importCandidateId, queryable: guard });
      await locker.query('BEGIN'); await locker.query("SET LOCAL statement_timeout='15s'");
      pending = locker.query(sql, [importCandidateId]).then(() => null, error => error);
      await waitForBlock(observer, guardPid); await guard.query('ROLLBACK'); assert.equal(await pending, null); await locker.query('ROLLBACK');
    }
  } finally {
    await guard.query('ROLLBACK'); await locker.query('ROLLBACK'); await pending;
    guard.release(); locker.release(); await observer.end();
  }
  return { version: (await pool.query('SHOW server_version')).rows[0].server_version,
    policyCases: cases.length, presenceRefusals: refusals, files: 2048, decisions: 2048, largestFactsBytes, smallestFullBytes,
    childLocksIndependent: true, legacyChildWaitObserved: true, parentMutationAndDeleteSerialized: true, evidenceForeignKeySerialized: true };
}
