import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseSafeAddPolicyService } from '../../src/server/import-candidates/import-candidate-release-safe-add-policy-service.js';

const wantedReleaseId = '00000000-0000-4000-8000-000000000001';
function fixture(triggerSource = 'music_queue_manual_add') {
  const marker = triggerSource === 'music_queue_manual_add' ? 'libraryAddRequestedForWantedReleaseId' : 'recheckRequestedForWantedReleaseId';
  const candidate = { id: 'candidate-1', status: 'import_pending', normalizedPayload: {
    musicQueue: { wantedReleaseId, profileCode: 'any_available', [marker]: wantedReleaseId } } };
  const participants = [{ wantedReleaseId, appUserId: 'owner-1', metadataReleaseId: 'metadata-1', qualityPreferences: {},
    wantedStatus: 'missing', missingTrackCount: 1, discoveryLinkExists: true }];
  const facts = { candidateId: candidate.id, candidateStatus: candidate.status, hasConflictingCandidate: false,
    activeRunId: 'run-1', activeRunStatus: 'running', activeRunSafetyMode: 'safe_auto', activeRunTriggerSource: triggerSource,
    runMatchesCandidate: true, owningTargetMarkerValid: true };
  const release = { targetUser: {}, discoveryLinkExists: true, wantedStatus: 'missing', missingTrackCount: 1,
    libraryAddFacts: facts, libraryAddRecoveryFacts: facts };
  const service = createImportCandidateReleaseSafeAddPolicyService({ getImportCandidate: async () => structuredClone(candidate),
    recheckStore: { readParticipantPolicies: async () => structuredClone(participants), readOwnedRelease: async () => structuredClone(release) } });
  return { service, candidate, participants, facts, input: { summaryCandidate: { id: candidate.id }, triggerSource, runId: 'run-1' }, marker };
}
test('both guarded sources reconstruct current stricter requirements and retain a pre-measurement snapshot', async () => {
  for (const source of ['music_queue_manual_add', 'music_queue_prerequisite_recheck']) {
    const { service, participants, input } = fixture(source);
    const first = await service.resolveCurrentQueuedSafeAddCandidate(input);
    participants[0].qualityPreferences = { minimumQuality: 'high', preferredFormat: 'any' };
    const fresh = await service.resolveCurrentQueuedSafeAddCandidate(input);
    assert.equal(fresh.musicQueueContext.minimumBitrateKbps, 320);
    await assert.rejects(service.assertQueuedSafeAddCandidateCurrent({ ...input, summaryCandidate: first }), { code: 'import_candidate_apply_not_ready' });
    await service.assertQueuedSafeAddCandidateCurrent({ ...input, summaryCandidate: fresh });
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
test('automatic and generic jobs keep their existing policy semantics outside this slice', async () => {
  const { service, input } = fixture();
  assert.equal(await service.resolveCurrentQueuedSafeAddCandidate({ ...input, triggerSource: 'download_completed' }), input.summaryCandidate);
  await service.assertQueuedSafeAddCandidateCurrent({ ...input, triggerSource: 'manual' });
});
