import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissingMusicDecisionService } from '../../src/server/missing-music/missing-music-decision-service.js';

function createRelease({ appUserId, id, statusCode = 'pick_match' }) {
  return {
    appUserId,
    artistName: 'Portishead',
    discoveryRequest: {
      importReviewSummary: {
        matches: [{
          fileCount: 11,
          formats: ['flac'],
          matchId: `candidate-${id}`,
          sourceUsername: 'must-not-leak',
          status: 'pending',
          totalSizeBytes: 400000000,
        }],
      },
    },
    expectedTrackCount: 11,
    id,
    lastReconciledAt: '2026-08-26T16:00:00.000Z',
    matchedTrackCount: 0,
    metadataReleaseId: `metadata-${id}`,
    missingTrackCount: 11,
    releaseDate: '1994-08-22',
    releaseGroupTitle: 'Dummy',
    releaseGroupType: 'Album',
    releaseTitle: 'Dummy',
    wantedStatus: 'missing',
    privateProviderPayload: { username: 'must-not-leak' },
    statusCode,
  };
}

function projectRelease(release) {
  return {
    artistName: release.artistName,
    expectedTrackCount: release.expectedTrackCount,
    id: release.id,
    lastReconciledAt: release.lastReconciledAt,
    matchedTrackCount: release.matchedTrackCount,
    metadataReleaseId: release.metadataReleaseId,
    missingTrackCount: release.missingTrackCount,
    releaseDate: release.releaseDate,
    releaseGroupTitle: release.releaseGroupTitle,
    releaseGroupType: release.releaseGroupType,
    releaseTitle: release.releaseTitle,
    status: {
      code: release.statusCode,
      label: 'Choose a match',
      message: 'Choose a candidate before Harmoniarr can continue.',
      nextAction: 'review_matches',
      tone: 'warning',
    },
    wantedStatus: release.wantedStatus,
  };
}

function createService(overrides = {}) {
  const users = [
    { id: 'admin-1', isDisabled: false, username: 'admin' },
    { id: 'user-1', isDisabled: false, username: 'listener' },
    { id: 'user-2', isDisabled: true, username: 'former-listener' },
  ];
  const releases = [
    createRelease({ appUserId: 'user-1', id: 'decision-active', statusCode: 'pick_match' }),
    createRelease({ appUserId: 'user-2', id: 'decision-disabled', statusCode: 'downloading' }),
  ];
  const listAppUsers = test.mock.fn(async () => users);
  const listWantedReleasesWithMetadata = test.mock.fn(async ({ appUserIds }) => releases
    .filter((release) => appUserIds.includes(release.appUserId)));
  const listWantedReleaseIdentityPage = test.mock.fn(async ({ appUserIds }) => ({
    rows: releases.filter((release) => appUserIds.includes(release.appUserId)).map((release) => ({ id: release.id, createdAtKey: '2026-09-11T00:00:00.000000Z' })),
    hasMore: false,
  }));
  const service = createMissingMusicDecisionService({
    listAppUsers,
    listWantedReleaseIdentityPage,
    listWantedReleasesWithMetadata,
    now: () => new Date('2026-08-26T16:30:00.000Z'),
    projectMusicQueueReleaseFn: projectRelease,
    ...overrides,
  });

  return { listAppUsers, listWantedReleasesWithMetadata, service };
}

function createLibraryAddRecoveryService({ releaseChanges = {}, factsChanges = {}, nextAction = 'recheck_library_add', statusCode = 'needs_help_adding' } = {}) {
  const release = { ...createRelease({ appUserId: 'user-1', id: 'decision-add', statusCode }),
    discoveryLinkExists: true,
    libraryAddRecoveryFacts: { candidateStatus: 'failed', hasConflictingCandidate: false,
      addBlockerCode: 'media_verification', recoveryReasonCode: 'audio_check_failed',
      candidateId: 'private-candidate', sourcePath: '/private/download',
      verificationError: 'private-probe-error', ...factsChanges }, ...releaseChanges };
  return { release, ...createService({
    listWantedReleaseIdentityPage: async () => ({ rows: [{ id: release.id, createdAtKey: '2026-09-11T00:00:00.000000Z' }], hasMore: false }),
    listWantedReleasesWithMetadata: async ({ appUserIds }) => appUserIds.includes(release.appUserId) ? [release] : [],
    projectMusicQueueReleaseFn: (value) => ({ ...projectRelease(value), status: { code: statusCode, label: 'Needs help',
      message: 'This release needs a safe decision before Harmoniarr can add it to your library.', nextAction, tone: 'warning' } }),
  }) };
}

test('library-add recovery permissions, next step and action worklist agree for current bounded audio and source interruptions', async () => {
  for (const reasonCode of ['source_path_unavailable', 'audio_check_failed']) {
    const { release, service } = createLibraryAddRecoveryService({
      nextAction: reasonCode === 'source_path_unavailable' ? 'set_up_folders' : 'recheck_library_add',
      factsChanges: { addBlockerCode: reasonCode === 'source_path_unavailable' ? reasonCode : 'media_verification' },
    });
    for (const actorUser of [{ id: 'admin-1', role: 'admin' }, { id: 'user-1', role: 'requester' }]) {
      const detail = await service.getMissingMusicDecisionDetail({ actorUser, decisionId: release.id });
      const actions = await service.listMissingMusicDecisions({ actorUser, state: 'action' });
      assert.equal(detail.permissions.canRecheckLibraryAdd, true);
      assert.equal(detail.permissions.canRepairFolders, reasonCode === 'source_path_unavailable' && actorUser.role === 'admin');
      assert.equal(detail.permissions.isReadOnly, false);
      assert.equal(detail.decision.state, 'action');
      assert.equal(detail.decision.status.nextAction, reasonCode === 'source_path_unavailable' ? 'set_up_folders' : 'recheck_library_add');
      assert.deepEqual(detail.libraryAddRecovery, { reasonCode, queued: false, runId: null });
      assert.equal(actions.decisions[0].decisionId, release.id);
      assert.deepEqual(actions.decisions[0].status, detail.decision.status);
      assert.doesNotMatch(JSON.stringify(detail), /private-candidate|private\/download|private-probe-error|candidateStatus|hasConflictingCandidate/u);
    }
  }
});

test('current ineligible recovery facts suppress broad legacy file-recheck and folder-repair next steps', async () => {
  const cases = [
    { factsChanges: { candidateStatus: 'selected' } },
    { factsChanges: { hasConflictingCandidate: true } },
    { factsChanges: { addBlockerCode: 'destination_collision' } },
    { factsChanges: { recoveryReasonCode: 'lossy_source' } },
    { factsChanges: { recoveryReasonCode: 'suspicious_lossless' } },
    { releaseChanges: { wantedStatus: 'downloaded' } },
    { releaseChanges: { missingTrackCount: 0 } },
    { releaseChanges: { discoveryLinkExists: false } },
    { releaseChanges: { visibilityState: 'ignored' } },
    { releaseChanges: { evidence: { visibilityState: 'ignored' } } },
    { releaseChanges: { appUserId: 'user-2' } },
  ];
  for (const input of cases) {
    const { release, service } = createLibraryAddRecoveryService(input);
    const detail = await service.getMissingMusicDecisionDetail({ actorUser: { id: 'admin-1', role: 'admin' }, decisionId: release.id });
    assert.equal(detail.permissions.canRecheckLibraryAdd, false, JSON.stringify(input));
    assert.equal(detail.permissions.canRepairFolders, false);
    assert.equal(detail.decision.status.nextAction, null);
  }
  for (const factsChanges of [{ candidateStatus: 'selected' }, { hasConflictingCandidate: true }]) {
    const { release, service } = createLibraryAddRecoveryService({ nextAction: 'set_up_folders',
      factsChanges: { addBlockerCode: 'source_path_unavailable', ...factsChanges } });
    const detail = await service.getMissingMusicDecisionDetail({ actorUser: { id: 'admin-1', role: 'admin' }, decisionId: release.id });
    const worklist = await service.listMissingMusicDecisions({ actorUser: { id: 'admin-1', role: 'admin' } });
    assert.equal(detail.permissions.canRepairFolders, false);
    assert.equal(detail.decision.status.nextAction, null);
    assert.equal(worklist.decisions[0].status.nextAction, null);
  }
  const { release, service } = createLibraryAddRecoveryService({ statusCode: 'needs_setup', nextAction: 'set_up_folders',
    factsChanges: { candidateStatus: 'selected' } });
  const setup = await service.getMissingMusicDecisionDetail({ actorUser: { id: 'admin-1', role: 'admin' }, decisionId: release.id });
  assert.equal(setup.decision.status.nextAction, 'set_up_folders', 'general setup guidance must remain independent of completed-file recovery');
});

test('only a matching safe-auto pending or running add publishes queued progress and its bounded run ID', async () => {
  const queuedFacts = { candidateStatus: 'import_pending', runMatchesCandidate: true, activeRunStatus: 'pending',
    activeRunSafetyMode: 'safe_auto', activeRunId: 'run-add', addBlockerCode: null, recoveryReasonCode: null };
  for (const [factsChanges, queued] of [[{}, true], [{ activeRunStatus: 'running' }, true],
    [{ runMatchesCandidate: false }, false], [{ activeRunSafetyMode: 'manual' }, false],
    [{ activeRunStatus: 'completed' }, false], [{ candidateStatus: 'selected' }, false]]) {
    const { release, service } = createLibraryAddRecoveryService({ factsChanges: { ...queuedFacts, ...factsChanges } });
    const actorUser = { id: 'admin-1', role: 'admin' };
    const detail = await service.getMissingMusicDecisionDetail({ actorUser, decisionId: release.id });
    const actionPage = await service.listMissingMusicDecisions({ actorUser, state: 'action' });
    assert.deepEqual(detail.libraryAddRecovery, { reasonCode: null, queued, runId: queued ? 'run-add' : null });
    assert.equal(detail.permissions.canRecheckLibraryAdd, false);
    assert.equal(detail.permissions.canRepairFolders, false);
    assert.equal(detail.decision.status.nextAction, null);
    if (queued) {
      assert.deepEqual(detail.decision.status, { code: 'adding_to_library', label: 'Adding to library',
        message: 'Harmoniarr has queued a safe library add and will check the files again before changing the library.',
        nextAction: null, tone: 'info' });
      assert.equal(detail.decision.state, 'downloading');
      assert.equal(actionPage.decisions.length, 0);
      const progress = await service.listMissingMusicDecisions({ actorUser, state: 'downloading' });
      assert.deepEqual(progress.decisions[0].status, detail.decision.status);
    } else {
      assert.equal(detail.decision.status.code, 'needs_help_adding');
      assert.equal(actionPage.decisions.length, 1, 'the underlying unsafe add still belongs in the review worklist');
    }
    assert.doesNotMatch(JSON.stringify(detail), /private-candidate|private\/download|private-probe-error/u);
  }
});

test('Missing Music detail exposes Search again only for current stopped states and active target history', async () => {
  for (const statusCode of ['failed', 'no_matches_left', 'quality_choice_needed', 'downloading', 'pick_match']) {
    const { service } = createService({ projectMusicQueueReleaseFn: (release) => ({ ...projectRelease(release),
      status: { code: statusCode, nextAction: 'try_again' } }) });
    const active = await service.getMissingMusicDecisionDetail({ actorUser: { id: 'user-1', role: 'requester' }, decisionId: 'decision-active' });
    const disabled = await service.getMissingMusicDecisionDetail({ actorUser: { id: 'admin-1', role: 'admin' }, decisionId: 'decision-disabled' });
    assert.equal(active.permissions.canSearchAgain, ['failed', 'no_matches_left', 'quality_choice_needed'].includes(statusCode));
    assert.equal(disabled.permissions.canSearchAgain, false);
  }
});

test('initial Find matches uses the same eligibility for permission, action filtering and bounded next step', async () => {
  const initial = {
    ...createRelease({ appUserId: 'user-1', id: 'decision-initial', statusCode: 'queued_for_search' }),
    discoveryLinkExists: true,
    hasPriorDiscoveryCandidates: false,
    discoveryRequest: { searchMode: 'automatic', requestStatus: 'ready', searchAttemptCount: 0,
      researchAttemptCount: 0, evidence: {} },
  };
  const actorUser = { id: 'user-1', role: 'requester', username: 'listener' };
  for (const savedIntent of [false, true]) {
    const release = { ...initial, discoveryInitialSearch: savedIntent
      ? { wantedReleaseId: initial.id, requestedAt: '2026-08-26T16:00:00.000Z' } : null };
    const { service } = createService({
      listWantedReleaseIdentityPage: async () => ({ rows: [{ id: release.id,
        createdAtKey: '2026-08-26T00:00:00.000000Z' }], hasMore: false }),
      listWantedReleasesWithMetadata: async () => [release],
      projectMusicQueueReleaseFn: (value) => ({ ...projectRelease(value),
        status: { code: 'queued_for_search', nextAction: 'search_now' } }),
    });
    const detail = await service.getMissingMusicDecisionDetail({ actorUser, decisionId: release.id });
    const actions = await service.listMissingMusicDecisions({ actorUser, state: 'action' });
    assert.equal(detail.permissions.canFindMatches, !savedIntent);
    assert.equal(detail.decision.state, savedIntent ? 'searching' : 'action');
    assert.equal(detail.decision.status.nextAction, savedIntent ? null : 'search_now');
    assert.equal(actions.decisions.length, savedIntent ? 0 : 1);
    assert.doesNotMatch(JSON.stringify(detail), /requestedAt|wantedReleaseId/u);
  }
});

test('admins receive active users by default with release-only decision facts', async () => {
  const { listWantedReleasesWithMetadata, service } = createService();

  const result = await service.listMissingMusicDecisions({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
  });

  assert.equal(result.scope, 'all');
  assert.equal(result.filters.accountStatus, 'active');
  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0], {
    appUserIds: ['admin-1', 'user-1'],
    limit: 1,
    search: null,
    wantedReleaseIds: ['decision-active'],
    wantedStatus: null,
  });
  assert.deepEqual(result.users, [
    { accountStatus: 'active', id: 'admin-1', username: 'admin' },
    { accountStatus: 'active', id: 'user-1', username: 'listener' },
  ]);
  assert.deepEqual(result.decisions[0], {
    decisionId: 'decision-active',
    expectedTrackCount: 11,
    lastReconciledAt: '2026-08-26T16:00:00.000Z',
    matchedTrackCount: 0,
    missingTrackCount: 11,
    release: {
      artistName: 'Portishead',
      id: 'metadata-decision-active',
      releaseDate: '1994-08-22',
      releaseGroupTitle: 'Dummy',
      releaseGroupType: 'Album',
      title: 'Dummy',
      wantedStatus: 'missing',
    },
    requestedFor: { accountStatus: 'active', id: 'user-1', username: 'listener' },
    state: 'action',
    status: {
      code: 'pick_match',
      label: 'Choose a match',
      message: 'Choose a candidate before Harmoniarr can continue.',
      nextAction: 'review_matches',
      tone: 'warning',
    },
  });
  assert.doesNotMatch(JSON.stringify(result.decisions), /must-not-leak/u);
});

test('admins can retain a disabled user history and filter by the current decision state', async () => {
  const { listWantedReleasesWithMetadata, service } = createService();

  const result = await service.listMissingMusicDecisions({
    accountStatus: 'disabled',
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    requestedForUserId: 'user-2',
    state: 'downloading',
  });

  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0].appUserIds, ['user-2']);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].decisionId, 'decision-disabled');
  assert.equal(result.decisions[0].requestedFor.accountStatus, 'disabled');
  assert.equal(result.decisions[0].state, 'downloading');
  assert.deepEqual(result.users, [
    { accountStatus: 'disabled', id: 'user-2', username: 'former-listener' },
  ]);
});

test('non-admins never enumerate other users and only query their own decision rows', async () => {
  const { listAppUsers, listWantedReleasesWithMetadata, service } = createService();

  const result = await service.listMissingMusicDecisions({
    actorUser: { id: 'user-1', role: 'requester', username: 'listener' },
    scope: 'all',
  });

  assert.equal(result.scope, 'mine');
  assert.deepEqual(result.users, []);
  assert.equal(listAppUsers.mock.callCount(), 0);
  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0].appUserIds, ['user-1']);
  assert.equal(result.decisions[0].requestedFor.username, 'listener');
});

test('Missing Music detail is server-scoped, preserves disabled history, and excludes private evidence', async () => {
  const { listWantedReleasesWithMetadata, service } = createService();

  const result = await service.getMissingMusicDecisionDetail({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    decisionId: 'decision-disabled',
  });

  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0], {
    appUserIds: ['admin-1', 'user-1', 'user-2'],
    limit: 1,
    search: null,
    wantedReleaseId: 'decision-disabled',
    wantedStatus: null,
  });
  assert.equal(result.scope, 'all');
  assert.equal(result.permissions.isReadOnly, true);
  assert.equal(result.permissions.canStartDownload, false);
  assert.equal(result.permissions.canSelectMatch, false);
  assert.equal(result.permissions.canViewDownloader, false);
  assert.equal(result.decision.decisionId, 'decision-disabled');
  assert.equal(result.decision.requestedFor.username, 'former-listener');
  assert.deepEqual(result.matchChoices, [{
    fileCount: 11,
    formats: ['FLAC'],
    id: 'candidate-decision-disabled',
    totalSizeBytes: 400000000,
  }]);
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/u);
});

test('Missing Music detail does not reveal another user’s release to a non-admin', async () => {
  const { listAppUsers, listWantedReleasesWithMetadata, service } = createService();

  await assert.rejects(
    () => service.getMissingMusicDecisionDetail({
      actorUser: { id: 'user-1', role: 'requester', username: 'listener' },
      decisionId: 'decision-disabled',
    }),
    (error) => error?.status === 404 && error?.code === 'missing_music_decision_not_found',
  );

  assert.equal(listAppUsers.mock.callCount(), 0);
  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0], {
    appUserIds: ['user-1'],
    limit: 1,
    search: null,
    wantedReleaseId: 'decision-disabled',
    wantedStatus: null,
  });
});

test('Missing Music detail rejects empty and oversized decision identifiers', async () => {
  const { service } = createService();
  const actorUser = { id: 'admin-1', role: 'admin', username: 'admin' };

  await assert.rejects(
    () => service.getMissingMusicDecisionDetail({ actorUser, decisionId: '' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
  await assert.rejects(
    () => service.getMissingMusicDecisionDetail({ actorUser, decisionId: 'x'.repeat(201) }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('Missing Music decision search is bounded and delegated to the server data boundary', async () => {
  const { listWantedReleasesWithMetadata, service } = createService();

  await service.listMissingMusicDecisions({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    q: '  portishead  ',
  });

  assert.equal(listWantedReleasesWithMetadata.mock.calls[0].arguments[0].search, 'portishead');
  await assert.rejects(
    () => service.listMissingMusicDecisions({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      q: 'x'.repeat(121),
    }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('Missing Music keeps a selected match actionable and describes that the download has not started', async () => {
  const { service } = createService({
    projectMusicQueueReleaseFn: (release) => ({
      ...projectRelease(release),
      status: {
        code: 'checking_matches',
        label: 'Checking matches',
        message: 'This generic queue message must not obscure a deliberate manual selection.',
        nextAction: 'download_now',
        tone: 'info',
      },
    }),
  });

  const result = await service.listMissingMusicDecisions({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    state: 'action',
  });

  assert.equal(result.decisions.length, 1);
  assert.deepEqual(result.decisions[0].status, {
    code: 'match_selected',
    label: 'Match selected',
    message: 'A match has been selected. A download will not start until someone explicitly starts it.',
    nextAction: 'download_now',
    tone: 'warning',
  });
  assert.equal(result.decisions[0].state, 'action');
});

test('Missing Music detail only exposes download start to an administrator for an active selected release', async () => {
  const { service } = createService({
    projectMusicQueueReleaseFn: (release) => ({
      ...projectRelease(release),
      status: {
        code: 'checking_matches',
        label: 'Checking matches',
        message: 'A selected match is waiting for a deliberate handoff.',
        nextAction: 'download_now',
        tone: 'info',
      },
    }),
  });

  const adminDetail = await service.getMissingMusicDecisionDetail({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    decisionId: 'decision-active',
  });
  const requesterDetail = await service.getMissingMusicDecisionDetail({
    actorUser: { id: 'user-1', role: 'requester', username: 'listener' },
    decisionId: 'decision-active',
  });

  assert.equal(adminDetail.permissions.canStartDownload, true);
  assert.equal(requesterDetail.permissions.canStartDownload, false);
});

test('Missing Music detail exposes the Downloader destination only to an administrator after transfer submission', async () => {
  const { service } = createService({
    projectMusicQueueReleaseFn: (release) => ({
      ...projectRelease(release),
      status: {
        code: 'downloading',
        label: 'Downloading',
        message: 'The transfer is available in Downloader.',
        nextAction: 'open_downloader',
        tone: 'info',
      },
    }),
  });

  const adminDetail = await service.getMissingMusicDecisionDetail({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    decisionId: 'decision-active',
  });
  const requesterDetail = await service.getMissingMusicDecisionDetail({
    actorUser: { id: 'user-1', role: 'requester', username: 'listener' },
    decisionId: 'decision-active',
  });

  assert.equal(adminDetail.permissions.canViewDownloader, true);
  assert.equal(requesterDetail.permissions.canViewDownloader, false);
});
