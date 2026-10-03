import assert from 'node:assert/strict';
import test from 'node:test';
import { canRecheckLibraryAdd, buildPublicLibraryAddRecovery } from '../../src/server/acquisition/acquisition-library-add-recheck-policy.js';

const release = { wantedStatus: 'missing', missingTrackCount: 1, discoveryLinkExists: true,
  libraryAddRecoveryFacts: { candidateId: 'private-candidate', candidateStatus: 'failed', hasConflictingCandidate: false,
    addBlockerCode: 'source_path_unavailable', recoveryReasonCode: null } };
test('recheck permits only current prerequisite failures on active owned missing releases', () => {
  assert.equal(canRecheckLibraryAdd({ release, targetUser: {} }), true);
  for (const patch of [{ candidateStatus: 'import_pending' }, { hasConflictingCandidate: true },
    { addBlockerCode: 'library_collision' }, { addBlockerCode: 'unsafe_add_plan' },
    { addBlockerCode: 'media_verification', recoveryReasonCode: 'lossy_audio' }]) {
    assert.equal(canRecheckLibraryAdd({ release: { ...release, libraryAddRecoveryFacts: { ...release.libraryAddRecoveryFacts, ...patch } }, targetUser: {} }), false);
  }
  assert.equal(canRecheckLibraryAdd({ release, targetUser: { isDisabled: true } }), false);
  assert.equal(canRecheckLibraryAdd({ release: { ...release, discoveryLinkExists: false }, targetUser: {} }), false);
  assert.equal(canRecheckLibraryAdd({ release: { ...release, wantedStatus: 'complete' }, targetUser: {} }), false);
});
test('public recovery projects only allowed category and exact active safe-auto membership', () => {
  const facts = { ...release.libraryAddRecoveryFacts, candidateStatus: 'import_pending', activeRunId: 'run-1',
    activeRunStatus: 'pending', activeRunSafetyMode: 'safe_auto', runMatchesCandidate: true, rawPath: '/private/path' };
  assert.deepEqual(buildPublicLibraryAddRecovery(facts), { reasonCode: 'source_path_unavailable', queued: true, runId: 'run-1' });
  assert.deepEqual(buildPublicLibraryAddRecovery({ ...facts, activeRunSafetyMode: 'manual' }), { reasonCode: 'source_path_unavailable', queued: false, runId: null });
});
