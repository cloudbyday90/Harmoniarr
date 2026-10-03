import assert from 'node:assert/strict';
import test from 'node:test';
import { canAddPreparedReleaseToLibrary, hasQueuedGuardedLibraryAdd, isPreparedReleaseLibraryAddEligible } from '../../src/server/acquisition/acquisition-library-add-policy.js';

const release = { wantedStatus: 'missing', missingTrackCount: 1, discoveryLinkExists: true,
  libraryAddFacts: { candidateId: 'private-candidate', candidateStatus: 'import_pending', fileCount: 1, hasConflictingCandidate: false } };
test('prepared add requires a live owned missing release and one current nonempty completed candidate', () => {
  assert.equal(canAddPreparedReleaseToLibrary({ release, targetUser: {} }), true);
  for (const patch of [{ candidateStatus: 'failed' }, { candidateStatus: 'selected' }, { fileCount: 0 }, { hasConflictingCandidate: true }]) {
    assert.equal(canAddPreparedReleaseToLibrary({ release: { ...release, libraryAddFacts: { ...release.libraryAddFacts, ...patch } }, targetUser: {} }), false);
  }
  for (const patch of [{ discoveryLinkExists: false }, { wantedStatus: 'complete' }, { missingTrackCount: 0 }, { evidence: { visibilityState: 'ignored' } }]) {
    assert.equal(canAddPreparedReleaseToLibrary({ release: { ...release, ...patch }, targetUser: {} }), false);
  }
  assert.equal(canAddPreparedReleaseToLibrary({ release, targetUser: { isDisabled: true } }), false);
});
test('active work suppresses the offered command while retaining structural eligibility for a deferred response', () => {
  const active = { ...release, libraryAddFacts: { ...release.libraryAddFacts, activeRunId: 'run-1' } };
  assert.equal(canAddPreparedReleaseToLibrary({ release: active, targetUser: {} }), false);
  assert.equal(isPreparedReleaseLibraryAddEligible({ release: active, targetUser: {} }), true);
});
test('only guarded current work with a valid owning marker and exact membership coalesces', () => {
  const facts = { ...release.libraryAddFacts, activeRunId: 'run-1', activeRunStatus: 'pending', activeRunSafetyMode: 'safe_auto',
    activeRunTriggerSource: 'music_queue_manual_add', runMatchesCandidate: true, owningTargetMarkerValid: true };
  assert.equal(hasQueuedGuardedLibraryAdd(facts), true);
  assert.equal(hasQueuedGuardedLibraryAdd({ ...facts, activeRunTriggerSource: 'music_queue_prerequisite_recheck' }), true);
  for (const patch of [{ owningTargetMarkerValid: false }, { runMatchesCandidate: false }, { hasConflictingCandidate: true },
    { activeRunSafetyMode: 'manual' }, { activeRunTriggerSource: 'download_completed' }, { activeRunTriggerSource: 'manual' },
    { activeRunStatus: 'completed' }]) assert.equal(hasQueuedGuardedLibraryAdd({ ...facts, ...patch }), false);
});
