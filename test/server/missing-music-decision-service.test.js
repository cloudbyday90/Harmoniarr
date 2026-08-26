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
  const service = createMissingMusicDecisionService({
    listAppUsers,
    listWantedReleasesWithMetadata,
    now: () => new Date('2026-08-26T16:30:00.000Z'),
    projectMusicQueueReleaseFn: projectRelease,
    ...overrides,
  });

  return { listAppUsers, listWantedReleasesWithMetadata, service };
}

test('admins receive active users by default with release-only decision facts', async () => {
  const { listWantedReleasesWithMetadata, service } = createService();

  const result = await service.listMissingMusicDecisions({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
  });

  assert.equal(result.scope, 'all');
  assert.equal(result.filters.accountStatus, 'active');
  assert.deepEqual(listWantedReleasesWithMetadata.mock.calls[0].arguments[0], {
    appUserIds: ['admin-1', 'user-1'],
    limit: 2000,
    search: null,
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
  assert.equal(result.permissions.canSelectMatch, false);
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
