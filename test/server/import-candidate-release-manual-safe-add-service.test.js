import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseManualSafeAddService } from '../../src/server/import-candidates/import-candidate-release-manual-safe-add-service.js';

const wantedReleaseId = '00000000-0000-4000-8000-000000000001';
function fixture(overrides = {}) {
  const candidate = { id: 'candidate-1', status: 'import_pending', files: [{ id: 'file-1' }], normalizedPayload: {
    musicQueue: { wantedReleaseId, profileCode: 'any_available' } } };
  const release = { id: wantedReleaseId, metadataReleaseId: 'metadata-1', wantedStatus: 'missing', missingTrackCount: 1,
    discoveryLinkExists: true, targetUser: { id: 'user-1' }, libraryAddFacts: {
      candidateId: candidate.id, candidateStatus: candidate.status, fileCount: 1, hasConflictingCandidate: false } };
  const participants = [{ wantedReleaseId, metadataReleaseId: 'metadata-1', appUserId: 'user-1', qualityPreferences: {},
    discoveryLinkExists: true, wantedStatus: 'missing', missingTrackCount: 1 }];
  const commit = test.mock.fn(async () => ({ outcome: 'queued', runId: 'run-1' }));
  const preview = test.mock.fn(async () => ({ summary: { status: 'ready' }, counts: { readyCount: 1 }, files: [{ status: { code: 'ready' } }] }));
  const service = createImportCandidateReleaseManualSafeAddService({
    recheckStore: { readOwnedRelease: async () => release, readParticipantPolicies: async () => participants },
    getImportCandidate: async () => candidate, listFileDecisions: async () => [], previewImportCandidateApply: preview,
    safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async () => ({ eligible: true }) },
    commitPreparedReleaseLibraryAdd: commit, ...overrides });
  return { service, candidate, release, participants, commit, preview };
}
test('prepared add selects the current server candidate and retains actor, recipient and strict current policy', async () => {
  const { service, participants, commit } = fixture();
  participants[0].qualityPreferences = { minimumQuality: 'high', preferredFormat: 'any' };
  assert.deepEqual(await service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId, actorUserId: 'admin-1' }), { outcome: 'queued', runId: 'run-1' });
  const input = commit.mock.calls[0].arguments[0];
  assert.equal(input.prepared.candidate.id, 'candidate-1');
  assert.equal(input.actorUserId, 'admin-1');
  assert.equal(input.prepared.qualityContext.libraryAddRequestedForWantedReleaseId, wantedReleaseId);
  assert.equal(input.prepared.qualityContext.minimumBitrateKbps, 320);
});
test('legacy candidate identity is an expected value and never bypasses current owned scope', async () => {
  const { service, candidate, preview, commit } = fixture();
  assert.deepEqual(await service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId, importCandidateId: 'other' }), { outcome: 'not_available' });
  assert.equal(preview.mock.callCount(), 0);
  candidate.normalizedPayload = { musicQueueContext: { wantedReleaseIds: [wantedReleaseId], profileCode: 'any_available' } };
  assert.equal((await service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId, importCandidateId: candidate.id })).outcome, 'queued');
  assert.equal(commit.mock.callCount(), 1);
});
test('prepared Any refuses empty, unsafe, warning and measured-quality-blocked plans', async () => {
  for (const override of [
    { previewImportCandidateApply: async () => ({ summary: { status: 'ready' }, files: [], counts: { readyCount: 0 } }) },
    { previewImportCandidateApply: async () => ({ summary: { status: 'blocked' } }) },
    { previewImportCandidateApply: async () => ({ summary: { status: 'attention' } }) },
    { safeAutoAddQualityGateService: { evaluateSafeAutoAddQuality: async () => ({ eligible: false }) } },
  ]) {
    const { service, commit } = fixture(override);
    assert.deepEqual(await service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { outcome: 'still_needs_review' });
    assert.equal(commit.mock.callCount(), 0);
  }
});
test('prepared add refuses stale, missing, duplicate or disabled recipients before expensive preview', async () => {
  for (const patch of [{ isDisabled: true }, { wantedStatus: 'complete' }, { discoveryLinkExists: false }]) {
    const { service, participants, preview } = fixture();
    Object.assign(participants[0], patch);
    assert.deepEqual(await service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { outcome: 'not_available' });
    assert.equal(preview.mock.callCount(), 0);
  }
});
test('only marked guarded work coalesces, while automatic, old unmarked and manual work defer without preparation', async () => {
  for (const [triggerSource, markerValid, outcome] of [['music_queue_manual_add', true, 'queued'],
    ['music_queue_prerequisite_recheck', true, 'queued'], ['music_queue_manual_add', false, 'deferred'], ['download_completed', false, 'deferred']]) {
    const { service, release, preview, commit } = fixture();
    Object.assign(release.libraryAddFacts, { activeRunId: 'run-1', activeRunStatus: 'pending', activeRunSafetyMode: 'safe_auto',
      activeRunTriggerSource: triggerSource, runMatchesCandidate: true, owningTargetMarkerValid: markerValid });
    assert.equal((await service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId })).outcome, outcome);
    assert.equal(preview.mock.callCount(), 0);
    assert.equal(commit.mock.callCount(), outcome === 'queued' ? 1 : 0);
  }
});
test('disabled recipient is read-only at the owning preparation boundary', async () => {
  const { service, release } = fixture();
  release.targetUser.isDisabled = true;
  await assert.rejects(service.startReleaseManualSafeAdd({ appUserId: 'user-1', wantedReleaseId }), { code: 'missing_music_decision_read_only' });
});
