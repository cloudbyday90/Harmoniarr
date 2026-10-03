import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseSafeAddRecheckService } from '../../src/server/import-candidates/import-candidate-release-safe-add-recheck-service.js';

const wantedReleaseId = '00000000-0000-4000-8000-000000000001';
function fixture(overrides = {}) {
  const candidate = { id: 'candidate-1', status: 'failed', files: [{ id: 'file-1' }], normalizedPayload: {
    musicQueue: { wantedReleaseId, profileCode: 'any_available', recheckRequestedForWantedReleaseId: wantedReleaseId } } };
  const release = { id: wantedReleaseId, metadataReleaseId: 'metadata-1', wantedStatus: 'missing', missingTrackCount: 1,
    discoveryLinkExists: true, targetUser: { id: 'user-1' }, libraryAddRecoveryFacts: {
      candidateId: candidate.id, candidateStatus: 'failed', hasConflictingCandidate: false, addBlockerCode: 'source_path_unavailable' } };
  const participants = [{ wantedReleaseId, metadataReleaseId: 'metadata-1', appUserId: 'user-1', qualityPreferences: {},
    discoveryLinkExists: true, wantedStatus: 'missing', missingTrackCount: 1 }];
  const commit = test.mock.fn(async () => ({ outcome: 'queued', runId: 'run-1' }));
  const service = createImportCandidateReleaseSafeAddRecheckService({
    recheckStore: { readOwnedRelease: async () => release, readParticipantPolicies: async () => participants },
    getImportCandidate: async () => candidate, listFileDecisions: async () => [], getMediaToolingStatus: async () => ({ status: 'healthy' }),
    previewImportCandidateApply: async () => ({ summary: { status: 'ready' }, counts: { readyCount: 1 }, files: [{ status: { code: 'ready' } }] }),
    safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async () => ({ eligible: true }) },
    commitPreparedReleaseRecheck: commit, ...overrides,
  });
  return { service, commit, candidate, participants, release };
}
test('recheck prepares a nonempty safe plan before delegating atomic acceptance without browser candidate authority', async () => {
  const { service, commit } = fixture();
  assert.deepEqual(await service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId, actorUserId: 'admin-1' }), { outcome: 'queued', runId: 'run-1' });
  const input = commit.mock.calls[0].arguments[0];
  assert.equal(input.actorUserId, 'admin-1');
  assert.equal(input.prepared.qualityContext.recheckRequestedForWantedReleaseId, wantedReleaseId);
  assert.equal(input.prepared.qualityContext.profileCode, 'any_available');
});
test('Any still refuses empty plans, unsafe previews and failed measured gates before any candidate reopen', async () => {
  for (const overrides of [
    { previewImportCandidateApply: async () => ({ summary: { status: 'ready' }, files: [], counts: { readyCount: 0 } }) },
    { previewImportCandidateApply: async () => ({ summary: { status: 'blocked' } }) },
    { safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async () => ({ eligible: false }) } },
  ]) {
    const { service, commit } = fixture(overrides);
    assert.deepEqual(await service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { outcome: 'still_needs_review' });
    assert.equal(commit.mock.callCount(), 0);
  }
});
test('broken audio tools and unrelated active work leave the failed candidate untouched', async () => {
  const first = fixture();
  first.release.libraryAddRecoveryFacts.addBlockerCode = 'media_verification';
  first.release.libraryAddRecoveryFacts.recoveryReasonCode = 'audio_check_failed';
  const audio = fixture({ recheckStore: { readOwnedRelease: async () => first.release, readParticipantPolicies: async () => first.participants },
    getMediaToolingStatus: async () => ({ status: 'degraded' }) });
  assert.deepEqual(await audio.service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { outcome: 'prerequisite_not_ready' });
  const active = fixture();
  active.release.libraryAddRecoveryFacts.activeRunId = 'unrelated-run';
  assert.deepEqual(await active.service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { outcome: 'deferred' });
  assert.equal(active.commit.mock.callCount(), 0);
});
test('preparation refuses duplicate, newly linked or disabled recipient scope before queuing', async () => {
  for (const patch of [{ wantedReleaseId: '00000000-0000-4000-8000-000000000002' }, { isDisabled: true }, { discoveryLinkExists: false }]) {
    const { service, participants, commit } = fixture();
    Object.assign(participants[0], patch);
    assert.deepEqual(await service.recheckReleaseSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { outcome: 'not_available' });
    assert.equal(commit.mock.callCount(), 0);
  }
});
test('queued worker snapshots current eligibility and refuses policy changes after measured checks', async () => {
  const { service, candidate, release, participants } = fixture();
  candidate.status = 'import_pending';
  Object.assign(release.libraryAddRecoveryFacts, { candidateStatus: 'import_pending', runMatchesCandidate: true,
    activeRunStatus: 'pending', activeRunSafetyMode: 'safe_auto', activeRunId: 'run-1' });
  const input = { summaryCandidate: { id: candidate.id }, triggerSource: 'music_queue_prerequisite_recheck' };
  const current = await service.resolveCurrentQueuedRecheckCandidate(input);
  // Database readers return fresh objects; a changed policy cannot mutate the saved snapshot.
  const snapshot = structuredClone(current);
  participants[0].qualityPreferences = { minimumQuality: 'high', preferredFormat: 'any' };
  await assert.rejects(service.assertQueuedRecheckCandidateCurrent({ ...input, summaryCandidate: snapshot }), { code: 'import_candidate_apply_not_ready' });
  participants[0].isDisabled = true;
  await assert.rejects(service.resolveCurrentQueuedRecheckCandidate(input), { code: 'import_candidate_apply_not_ready' });
});
