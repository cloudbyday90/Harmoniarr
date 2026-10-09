/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateMusicQueueAutoSafeAddService } from '../../src/server/import-candidates/import-candidate-music-queue-auto-safe-add-service.js';
import { hasCompatibleAutomaticRecoveryRequirement, hasPersistedMusicQueueOwnership } from '../../src/server/import-candidates/import-candidate-music-queue-auto-safe-add-policy.js';

const wantedId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000001';
function fixture(overrides = {}) {
  const candidate = { id: 'candidate-1', status: 'import_pending', sourceSearchId: 'current-search', files: [{ id: 'file-1' }],
    normalizedPayload: { musicQueue: { wantedReleaseId: wantedId, profileCode: 'high_quality', minimumBitrateKbps: 320 },
      requestOwnership: { sourceRequestedForUserId: 'owner-1', metadataReleaseId: 'metadata-1' } } };
  const participants = [{ wantedReleaseId: wantedId, appUserId: 'owner-1', metadataReleaseId: 'metadata-1',
    qualityPreferences: { minimumQuality: 'high', preferredFormat: 'any' }, wantedStatus: 'missing', missingTrackCount: 1,
    discoveryLinkExists: true }];
  const release = { metadataReleaseId: 'metadata-1', targetUser: { id: 'owner-1' }, wantedStatus: 'missing', missingTrackCount: 1,
    discoveryLinkExists: true, libraryAddFacts: { candidateId: candidate.id, candidateStatus: 'import_pending', fileCount: 1,
      hasConflictingCandidate: false } };
  const commits = []; const recoveries = []; const gates = []; let previews = 0;
  const service = createImportCandidateMusicQueueAutoSafeAddService({ getImportCandidate: async () => structuredClone(candidate),
    recheckStore: { readOwnedRelease: async () => structuredClone(release), readParticipantPolicies: async () => structuredClone(participants) },
    listFileDecisions: async () => [], previewImportCandidateApply: async () => { previews += 1;
      return { summary: { status: 'ready' }, counts: { readyCount: 1 }, files: [{ status: { code: 'ready' } }] }; },
    safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async (input) => { gates.push(input); return { eligible: true }; } },
    commitPreparedAutomaticLibraryAdd: async (input) => { commits.push(input); return { outcome: 'queued', runId: 'run-1' }; },
    handleImportCandidateImportBlocker: async (input) => { recoveries.push(input); return { recovered: true }; }, ...overrides });
  const start = () => service.startAutomaticMusicQueueLibraryAdd({ candidate: structuredClone(candidate), operationRunId: 'execution-origin-1' });
  return { start, service, candidate, participants, release, commits, recoveries, gates, previews: () => previews };
}

test('automatic authority preserves acquired primary and physical owner while rebuilding all current shared requirements', async () => {
  const f = fixture(); f.candidate.normalizedPayload.musicQueue.wantedReleaseIds = [wantedId, otherId];
  f.participants.push({ ...f.participants[0], wantedReleaseId: otherId, appUserId: 'owner-2', qualityPreferences: {} });
  assert.deepEqual(await f.start(), { outcome: 'queued', runId: 'run-1' });
  const input = f.commits[0]; assert.equal(input.actorUserId, null); assert.equal(input.appUserId, 'owner-1');
  assert.equal(input.prepared.qualityContext.wantedReleaseId, wantedId);
  assert.equal(input.prepared.qualityContext.automaticLibraryAddForWantedReleaseId, wantedId);
  assert.equal(input.prepared.qualityContext.minimumBitrateKbps, 320);
  assert.equal(input.prepared.candidate.normalizedPayload.requestOwnership.sourceRequestedForUserId, 'owner-1');
  assert.equal(f.previews(), 1); assert.equal(f.gates.length, 1);
});

test('present malformed Music Queue data, missing saved primary and changed physical provenance never become generic authority', async () => {
  for (const context of [null, [], {}, 'invalid', { wantedReleaseIds: [wantedId] }, { wantedReleaseId: 'invalid' },
    { wantedReleaseId: wantedId, wantedReleaseIds: 'invalid' }, { wantedReleaseId: wantedId, wantedReleaseIds: [wantedId, null] }]) {
    const f = fixture(); f.candidate.normalizedPayload.musicQueue = context;
    assert.equal(hasPersistedMusicQueueOwnership(f.candidate), true);
    assert.deepEqual(await f.start(), { outcome: 'not_available' }); assert.equal(f.previews(), 0); assert.equal(f.recoveries.length, 0);
  }
  for (const ownership of [{ sourceRequestedForUserId: 'outsider' }, { metadataReleaseId: 'other-metadata' },
    { sourceRequestedForUserId: '' }, { sourceRequestedForUserId: 0 }, { sourceRequestedForUserId: false }, 'invalid']) {
    const f = fixture(); f.candidate.normalizedPayload.requestOwnership = ownership;
    assert.deepEqual(await f.start(), { outcome: 'not_available' }); assert.equal(f.previews(), 0);
  }
});

test('automatic add refuses disabled, unlinked, late, duplicate, ignored or resolved recipients before preview/recovery', async () => {
  for (const patch of [{ isDisabled: true }, { discoveryLinkExists: false }, { visibilityState: 'ignored' },
    { wantedStatus: 'resolved' }, { missingTrackCount: 0 }]) {
    const f = fixture(); Object.assign(f.participants[0], patch);
    assert.deepEqual(await f.start(), { outcome: 'not_available' }); assert.equal(f.previews(), 0); assert.equal(f.commits.length, 0);
  }
  const f = fixture(); f.participants.push({ ...f.participants[0], wantedReleaseId: otherId });
  assert.deepEqual(await f.start(), { outcome: 'not_available' });
});

test('automatic aliases must agree on primary and membership while legacy quality fields may remain different', async () => {
  const f = fixture();
  f.candidate.normalizedPayload.musicQueueContext = { wantedReleaseId: wantedId, profileCode: 'any_available' };
  assert.equal((await f.start()).outcome, 'queued');
  f.candidate.normalizedPayload.musicQueueContext.wantedReleaseId = otherId;
  assert.deepEqual(await f.start(), { outcome: 'not_available' });
});

test('automatic safe-auto preparation preserves all-ready and positive file requirements even for Any', async () => {
  for (const preview of [{ summary: { status: 'attention' } }, { summary: { status: 'ready' }, files: [], counts: { readyCount: 0 } },
    { summary: { status: 'ready' }, files: [{ status: { code: 'collision' } }], counts: { readyCount: 1 } }]) {
    const f = fixture({ previewImportCandidateApply: async () => preview });
    f.candidate.normalizedPayload.musicQueue.profileCode = 'any_available'; f.participants[0].qualityPreferences = {};
    assert.deepEqual(await f.start(), { outcome: 'still_needs_review' }); assert.equal(f.commits.length, 0);
  }
});

test('only exact guarded sources and markers coalesce; generic or unmarked active work defers without audio checks', async () => {
  for (const source of ['music_queue_download_completed', 'music_queue_manual_add', 'music_queue_prerequisite_recheck', 'download_completed']) {
    const f = fixture(); Object.assign(f.release.libraryAddFacts, { activeRunId: 'run-1', activeRunStatus: 'pending',
      activeRunSafetyMode: 'safe_auto', activeRunTriggerSource: source, runMatchesCandidate: true, owningTargetMarkerValid: true });
    assert.equal((await f.start()).outcome, source === 'download_completed' ? 'deferred' : 'queued'); assert.equal(f.previews(), 0);
  }
  const f = fixture(); Object.assign(f.release.libraryAddFacts, { activeRunId: 'run-1', activeRunStatus: 'pending',
    activeRunSafetyMode: 'safe_auto', activeRunTriggerSource: 'music_queue_download_completed', runMatchesCandidate: true, owningTargetMarkerValid: false });
  assert.deepEqual(await f.start(), { outcome: 'deferred' }); assert.equal(f.previews(), 0);
});

const missingPreview = { summary: { status: 'blocked', message: 'missing source' }, counts: { missingSourceCount: 1 }, preview: { validation: { blockers: [] } } };
test('missing-source blocker forwards its original execution attempt to owning recovery even when current policy is stricter', async () => {
  const f = fixture({ previewImportCandidateApply: async () => missingPreview });
  assert.equal((await f.start()).skippedReason, 'completed_source_unavailable'); assert.equal(f.recoveries.length, 1);
  assert.equal(f.recoveries[0].canRecover, true); assert.equal(f.commits.length, 0);
  assert.equal(f.recoveries[0].operationRunId, 'execution-origin-1');
  assert.equal(f.recoveries[0].observation.candidateId, 'candidate-1');
  assert.equal(f.recoveries[0].observation.sourceSearchId, 'current-search');
  const changed = fixture({ previewImportCandidateApply: async () => missingPreview });
  changed.candidate.normalizedPayload.musicQueue.minimumBitrateKbps = 256;
  assert.equal((await changed.start()).outcome, 'still_needs_review');
  assert.equal(changed.recoveries.length, 1);
  assert.equal(changed.recoveries[0].operationRunId, 'execution-origin-1');
  assert.equal(changed.recoveries[0].canRecover, true);
  assert.equal(changed.commits.length, 0);
  assert.equal(Object.hasOwn(changed.recoveries[0], 'qualityOverride'), false);
});

test('blocker preview drift forwards the pre-await observation rather than treating changed provenance as current', async () => {
  let f;
  f = fixture({ previewImportCandidateApply: async () => { await Promise.resolve(); f.candidate.folderPath = 'changed';
    f.candidate.sourceSearchId = 'newer-search'; return missingPreview; } });
  f.candidate.folderPath = 'original-folder';
  assert.equal((await f.start()).outcome, 'still_needs_review');
  assert.equal(f.recoveries.length, 1);
  assert.equal(f.recoveries[0].observation.folderPath, 'original-folder');
  assert.equal(f.recoveries[0].observation.sourceSearchId, 'current-search');
  assert.equal(f.recoveries[0].operationRunId, 'execution-origin-1');
  assert.equal(f.commits.length, 0);
});

test('legacy compatibility policy does not infer revoked or malformed fallback consent', () => {
  const consent = { mode: 'allow_fallback_quality', wantedReleaseId: wantedId };
  const candidate = { normalizedPayload: { musicQueue: { wantedReleaseId: wantedId, profileCode: 'lossless_archive', qualityOverride: consent } } };
  assert.equal(hasCompatibleAutomaticRecoveryRequirement(candidate, { profileCode: 'lossless_archive', qualityOverride: null }), false);
  assert.equal(hasCompatibleAutomaticRecoveryRequirement(candidate, { profileCode: 'lossless_archive', qualityOverride: consent }), true);
  candidate.normalizedPayload.musicQueue.qualityOverride = { ...consent, mode: 'ALLOW_FALLBACK_QUALITY' };
  assert.equal(hasCompatibleAutomaticRecoveryRequirement(candidate, { profileCode: 'lossless_archive', qualityOverride: null }), false);
});
