import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicModule } from '../../src/server/missing-music/missing-music-module.js';

function createModule(overrides = {}) {
  const release = { id: 'wanted-amber', appUserId: 'listener-1', artistName: 'Autechre', releaseTitle: 'Amber',
    wantedStatus: 'missing', missingTrackCount: 10, discoveryLinkExists: true,
    libraryAddRecoveryFacts: { candidateStatus: 'failed', hasConflictingCandidate: false,
      addBlockerCode: 'source_path_unavailable', recoveryReasonCode: 'source_path_unavailable' } };
  const users = [{ id: 'admin-1', username: 'admin', isDisabled: false },
    { id: 'listener-1', username: 'Jamie', isDisabled: false },
    { id: 'disabled-1', username: 'former-listener', isDisabled: true }];
  const module = createMissingMusicModule({
    listAppUsers: async () => users,
    listWantedReleaseIdentityPage: async () => ({ rows: [{ id: release.id, createdAtKey: '2026-10-03T00:00:00.000000Z' }], hasMore: false }),
    listWantedReleasesWithMetadata: async ({ appUserIds, wantedReleaseId }) => appUserIds.includes(release.appUserId)
      && (!wantedReleaseId || wantedReleaseId === release.id) ? [release] : [],
    allowMusicQueueReleaseFallbackQuality: async () => ({}), requestMusicQueueReleaseRediscovery: async () => ({}),
    requestInitialMusicSearch: async () => ({}), startLibraryDiscoveryRun: async () => ({}),
    selectImportCandidate: async () => ({}), startImportCandidateExecutionRun: async () => ({}),
    ...overrides,
  });
  return { module, release };
}

test('Missing Music module composes canonical target resolution, recheck delegation and refreshed queued public projection', async (t) => {
  const recheckReleaseSafeAdd = t.mock.fn(async () => ({ outcome: 'queued', runId: 'run-add',
    sourcePath: '/private/download', candidateId: 'private-candidate', message: 'private-probe-error' }));
  const executeIdempotentMutation = t.mock.fn(async ({ executeMutation }) => executeMutation());
  const { module, release } = createModule({ recheckReleaseSafeAdd, executeIdempotentMutation });
  const actorUser = { id: 'admin-1', role: 'admin', username: 'admin' };
  const requestMetadata = { ipAddress: '127.0.0.1' };
  const before = await module.routeDependencies.getMissingMusicDecisionDetail({ actorUser, decisionId: release.id });
  assert.equal(before.permissions.canRecheckLibraryAdd, true);
  assert.equal(before.permissions.canRepairFolders, true);
  assert.equal(before.decision.requestedFor.id, 'listener-1');
  assert.equal(module.routeDependencies.executeIdempotentMutation, executeIdempotentMutation);
  const command = await module.routeDependencies.recheckMissingMusicDecisionLibraryAdd({ actorUser,
    decisionId: release.id, targetUserId: 'untrusted', requestMetadata });
  assert.deepEqual(recheckReleaseSafeAdd.mock.calls[0].arguments[0], {
    actorUserId: 'admin-1', appUserId: 'listener-1', wantedReleaseId: release.id, requestMetadata,
  });
  assert.deepEqual(command, { action: { code: 'recheck_library_add', decisionId: release.id,
    targetUserId: 'listener-1', outcome: 'queued', runId: 'run-add' } });
  release.libraryAddRecoveryFacts = { ...release.libraryAddRecoveryFacts, candidateStatus: 'import_pending',
    activeRunId: 'run-add', runMatchesCandidate: true, activeRunStatus: 'pending', activeRunSafetyMode: 'safe_auto' };
  const after = await module.routeDependencies.getMissingMusicDecisionDetail({ actorUser, decisionId: release.id });
  assert.equal(after.permissions.canRecheckLibraryAdd, false);
  assert.equal(after.permissions.canRepairFolders, false);
  assert.equal(after.decision.state, 'downloading');
  assert.deepEqual(after.decision.status, { code: 'adding_to_library', label: 'Adding to library',
    message: 'Harmoniarr has queued a safe library add and will check the files again before changing the library.',
    nextAction: null, tone: 'info' });
  assert.deepEqual(after.libraryAddRecovery, { reasonCode: 'source_path_unavailable', queued: true, runId: 'run-add' });
  assert.doesNotMatch(JSON.stringify({ command, after }), /private\/download|private-candidate|private-probe-error/u);
});

test('Missing Music module prevents cross-account and disabled-target recheck before reaching safe-add work', async (t) => {
  const recheckReleaseSafeAdd = t.mock.fn(async () => ({ outcome: 'queued', runId: 'run-add' }));
  const { module, release } = createModule({ recheckReleaseSafeAdd });
  await assert.rejects(() => module.routeDependencies.recheckMissingMusicDecisionLibraryAdd({
    actorUser: { id: 'requester-other', role: 'requester' }, decisionId: release.id,
  }), (error) => error.status === 404 && error.code === 'missing_music_decision_not_found');
  release.appUserId = 'disabled-1';
  const actorUser = { id: 'admin-1', role: 'admin' };
  const detail = await module.routeDependencies.getMissingMusicDecisionDetail({ actorUser, decisionId: release.id });
  assert.equal(detail.permissions.isReadOnly, true);
  assert.equal(detail.permissions.canRecheckLibraryAdd, false);
  assert.equal(detail.permissions.canRepairFolders, false);
  await assert.rejects(() => module.routeDependencies.recheckMissingMusicDecisionLibraryAdd({ actorUser, decisionId: release.id }),
    (error) => error.status === 409 && error.code === 'missing_music_decision_read_only');
  assert.equal(recheckReleaseSafeAdd.mock.callCount(), 0);
});
