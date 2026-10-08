import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseSafeAddPolicyService } from '../../src/server/import-candidates/import-candidate-release-safe-add-policy-service.js';
import { buildAutomaticLibraryAddAuthority } from '../../src/server/import-candidates/import-candidate-music-queue-auto-safe-add-policy.js';

const wantedReleaseId = '00000000-0000-4000-8000-000000000001';
function fixture(triggerSource = 'music_queue_manual_add') {
  const marker = triggerSource === 'music_queue_download_completed' ? 'automaticLibraryAddForWantedReleaseId' : triggerSource === 'music_queue_manual_add' ? 'libraryAddRequestedForWantedReleaseId' : 'recheckRequestedForWantedReleaseId';
  const candidate = { id: 'candidate-1', status: 'import_pending', normalizedPayload: {
    musicQueue: { wantedReleaseId, profileCode: 'any_available', [marker]: wantedReleaseId } } };
  const participants = [{ wantedReleaseId, appUserId: 'owner-1', metadataReleaseId: 'metadata-1', qualityPreferences: {},
    wantedStatus: 'missing', missingTrackCount: 1, discoveryLinkExists: true }];
  const facts = { candidateId: candidate.id, candidateStatus: candidate.status, hasConflictingCandidate: false,
    activeRunId: 'run-1', activeRunStatus: 'running', activeRunSafetyMode: 'safe_auto', activeRunTriggerSource: triggerSource,
    runMatchesCandidate: true, owningTargetMarkerValid: true };
  const release = { targetUser: {}, discoveryLinkExists: true, wantedStatus: 'missing', missingTrackCount: 1,
    libraryAddFacts: facts, libraryAddRecoveryFacts: facts };
  const authority = buildAutomaticLibraryAddAuthority(candidate);
  const service = createImportCandidateReleaseSafeAddPolicyService({ getImportCandidate: async () => structuredClone(candidate),
    recheckStore: { readParticipantPolicies: async () => structuredClone(participants), readOwnedRelease: async () => structuredClone(release),
      readAutomaticLibraryAddAuthority: async () => structuredClone(authority) } });
  return { service, candidate, participants, facts, input: { summaryCandidate: { id: candidate.id }, triggerSource, runId: 'run-1' }, marker };
}
test('all guarded sources reconstruct current stricter requirements and retain a pre-measurement snapshot', async () => {
  for (const source of ['music_queue_manual_add', 'music_queue_prerequisite_recheck', 'music_queue_download_completed']) {
    const { service, participants, input } = fixture(source);
    const first = await service.resolveCurrentQueuedSafeAddCandidate(input);
    participants[0].qualityPreferences = { minimumQuality: 'high', preferredFormat: 'any' };
    const fresh = await service.resolveCurrentQueuedSafeAddCandidate(input);
    assert.equal(fresh.musicQueueContext.minimumBitrateKbps, 320);
    await assert.rejects(service.assertQueuedSafeAddCandidateCurrent({ ...input, summaryCandidate: first }), { code: 'import_candidate_apply_not_ready' });
    await service.assertQueuedSafeAddCandidateCurrent({ ...input, summaryCandidate: fresh });
  }
});

test('automatic durable authority refuses pre-start primary, membership and present-versus-absent request ownership changes', async () => {
  for (const patch of ['ownership_added', 'ownership_null', 'primary_changed', 'participants_changed']) {
    const { service, candidate, input } = fixture('music_queue_download_completed');
    if (patch === 'ownership_added') candidate.normalizedPayload.requestOwnership = { sourceRequestedForUserId: 'owner-1' };
    if (patch === 'ownership_null') candidate.normalizedPayload.requestOwnership = null;
    if (patch === 'primary_changed') candidate.normalizedPayload.musicQueue.wantedReleaseId = '00000000-0000-4000-8000-000000000002';
    if (patch === 'participants_changed') candidate.normalizedPayload.musicQueue.wantedReleaseIds = [wantedReleaseId, '00000000-0000-4000-8000-000000000002'];
    await assert.rejects(service.resolveCurrentQueuedSafeAddCandidate(input), { code: 'import_candidate_apply_not_ready' });
  }
});
test('old unmarked jobs, removed ownership markers, changed membership and wrong active runs refuse before file work', async () => {
  for (const patch of ['removed_marker', 'invalid_marker', 'unmarked_job', 'wrong_run', 'disabled', 'unlinked']) {
    const { service, candidate, facts, participants, input, marker } = fixture();
    if (patch === 'removed_marker') delete candidate.normalizedPayload.musicQueue[marker];
    if (patch === 'invalid_marker') candidate.normalizedPayload.musicQueue[marker] = 'someone-else';
    if (patch === 'unmarked_job') facts.owningTargetMarkerValid = false;
    if (patch === 'wrong_run') facts.activeRunId = 'another-run';
    if (patch === 'disabled') participants[0].isDisabled = true;
    if (patch === 'unlinked') participants[0].discoveryLinkExists = false;
    await assert.rejects(service.resolveCurrentQueuedSafeAddCandidate(input), { code: 'import_candidate_apply_not_ready' });
  }
});
test('legacy owned automatic jobs refuse while genuinely generic completed-download jobs retain their semantics', async () => {
  const { service, input, candidate } = fixture();
  await assert.rejects(service.resolveCurrentQueuedSafeAddCandidate({ ...input, triggerSource: 'download_completed' }), { code: 'import_candidate_apply_not_ready' });
  candidate.normalizedPayload = {};
  assert.equal(await service.resolveCurrentQueuedSafeAddCandidate({ ...input, triggerSource: 'download_completed' }), input.summaryCandidate);
  candidate.normalizedPayload = { musicQueue: null };
  await assert.rejects(service.assertQueuedSafeAddCandidateCurrent({ ...input, triggerSource: 'download_completed' }), { code: 'import_candidate_apply_not_ready' });
  await service.assertQueuedSafeAddCandidateCurrent({ ...input, triggerSource: 'manual' });
});

test('durable automatic source refuses entire context removal, marker removal and changed physical owner or metadata before preview', async () => {
  for (const patch of ['remove_context', 'remove_marker', 'foreign_owner', 'foreign_metadata', 'missing_primary', 'wrong_source']) {
    const { service, candidate, facts, input, marker } = fixture('music_queue_download_completed');
    if (patch === 'remove_context') candidate.normalizedPayload = {};
    if (patch === 'remove_marker') delete candidate.normalizedPayload.musicQueue[marker];
    if (patch === 'foreign_owner') candidate.normalizedPayload.requestOwnership = { sourceRequestedForUserId: 'outsider' };
    if (patch === 'foreign_metadata') candidate.normalizedPayload.discoveryScope = { metadataReleaseId: 'another-release' };
    if (patch === 'missing_primary') delete candidate.normalizedPayload.musicQueue.wantedReleaseId;
    if (patch === 'wrong_source') facts.activeRunTriggerSource = 'download_completed';
    await assert.rejects(service.resolveCurrentQueuedSafeAddCandidate(input), { code: 'import_candidate_apply_not_ready' });
  }
});
