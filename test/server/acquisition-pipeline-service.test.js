import assert from 'node:assert/strict';
import test from 'node:test';
import { createAcquisitionPipelineService } from '../../src/server/acquisition/acquisition-pipeline-service.js';

const statusService = {
  deriveMusicQueueStatus: () => ({
    code: 'pick_match',
    label: 'Pick a match',
    tone: 'warning',
  }),
};

const stoppedStatusService = {
  deriveMusicQueueStatus: () => ({
    code: 'quality_choice_needed',
    label: 'Quality choice needed',
    nextAction: 'review_quality_choice',
    tone: 'warning',
  }),
};

const qualityPolicyService = {
  evaluateQualityEvidence: () => ({
    code: 'accepted',
    explanation: 'Quality accepted.',
    profile: { code: 'lossless_archive' },
  }),
};

const fallbackBlockedQualityPolicyService = {
  evaluateQualityEvidence: () => ({
    code: 'below_minimum',
    explanation: 'Only MP3 evidence is available.',
    profile: { code: 'lossless_archive' },
  }),
};

const needsVerificationQualityPolicyService = {
  evaluateQualityEvidence: () => ({
    code: 'needs_verification',
    explanation: 'Lossless evidence needs verification.',
    profile: { code: 'lossless_archive' },
  }),
};

function createRelease({ matchId = 'candidate-1', status = 'pending' } = {}) {
  return {
    artistName: 'Forest Frank',
    discoveryRequest: {
      importReviewSummary: {
        matches: [{
          fileCount: 12,
          matchId,
          score: 92,
          status,
        }],
        statusCounts: { [status]: 1 },
        totalCount: 1,
      },
    },
    expectedTrackCount: 12,
    id: 'wanted-1',
    metadataReleaseId: 'release-1',
    missingTrackCount: 12,
    releaseGroupTitle: 'Child of God',
    releaseGroupType: 'Album',
    releaseTitle: 'Child of God',
    wantedStatus: 'missing',
  };
}

function createService({
  allowMusicQueueFallbackQuality = async () => ({ metadataReleaseId: 'release-1', requestStatus: 'ready' }),
  qualityPolicyService: serviceQualityPolicyService = qualityPolicyService,
  recheckReleaseSafeAdd = async () => ({ outcome: 'queued', runId: 'apply-run-1' }),
  recordActivityEventFn = async () => {},
  requestMusicQueueRediscovery = async () => ({ metadataReleaseId: 'release-1', requestStatus: 'ready' }),
  release = createRelease(),
  rejectImportCandidate = async () => ({ toStatus: 'rejected' }),
  selectImportCandidate = async () => ({ toStatus: 'selected' }),
  startLibraryDiscoveryRun = async () => ({ accepted: true, run: { id: 'run-1' } }),
  statusService: serviceStatusService = statusService,
} = {}) {
  const store = {
    getWantedReleaseEvidence: async ({ appUserId, wantedReleaseId }) => (
      appUserId === 'user-1' && wantedReleaseId === 'wanted-1' ? release : null
    ),
    listWantedReleaseEvidence: async () => ({
      checkedAt: '2026-06-29T12:00:00.000Z',
      pagination: { limit: 100, offset: 0, total: 1 },
      releases: [release],
    }),
  };

  return createAcquisitionPipelineService({
    acquisitionPipelineStore: store,
    allowMusicQueueFallbackQuality,
    getNow: () => new Date('2026-06-29T12:00:00.000Z'),
    qualityPolicyService: serviceQualityPolicyService,
    recheckReleaseSafeAdd,
    recordActivityEventFn,
    requestMusicQueueRediscovery,
    rejectImportCandidate,
    selectImportCandidate,
    startLibraryDiscoveryRun,
    statusService: serviceStatusService,
  });
}

test('recheckMusicQueueReleaseSafeAdd verifies release ownership before delegating the release-scoped repair', async (t) => {
  const recheckReleaseSafeAdd = t.mock.fn(async () => ({ outcome: 'queued', runId: 'apply-run-1' }));
  const service = createService({ recheckReleaseSafeAdd });

  const result = await service.recheckMusicQueueReleaseSafeAdd({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(result.action, {
    code: 'recheck_library_add',
    outcome: 'queued',
    runId: 'apply-run-1',
    wantedReleaseId: 'wanted-1',
  });
  assert.equal(result.release.id, 'wanted-1');
  assert.deepEqual(recheckReleaseSafeAdd.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    appUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  }]);
});

test('recheckMusicQueueReleaseSafeAdd does not delegate an out-of-scope release', async (t) => {
  const recheckReleaseSafeAdd = t.mock.fn(async () => ({ outcome: 'queued' }));
  const service = createService({ recheckReleaseSafeAdd });

  await assert.rejects(
    () => service.recheckMusicQueueReleaseSafeAdd({
      appUserId: 'user-1',
      wantedReleaseId: 'wanted-outside-scope',
    }),
    (error) => error?.code === 'music_queue_release_not_found',
  );
  assert.equal(recheckReleaseSafeAdd.mock.callCount(), 0);
});

test('useMusicQueueMatch verifies release scope before selecting the underlying candidate', async (t) => {
  const selectImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({ importCandidateId, toStatus: 'selected' }));
  const service = createService({ selectImportCandidate });

  const result = await service.useMusicQueueMatch({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    matchId: 'candidate-1',
    requestMetadata: { ip: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'use_match');
  assert.equal(result.action.matchId, 'candidate-1');
  assert.equal(result.release.id, 'wanted-1');
  assert.deepEqual(selectImportCandidate.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    importCandidateId: 'candidate-1',
    reason: 'Selected from Music Queue',
    requestMetadata: { ip: '127.0.0.1' },
  }]);
});

test('rejectMusicQueueMatch verifies release scope before rejecting the underlying candidate', async (t) => {
  const rejectImportCandidate = t.mock.fn(async ({ importCandidateId }) => ({ importCandidateId, toStatus: 'rejected' }));
  const service = createService({ rejectImportCandidate });

  const result = await service.rejectMusicQueueMatch({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    matchId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'reject_match');
  assert.equal(result.action.matchId, 'candidate-1');
  assert.deepEqual(rejectImportCandidate.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    importCandidateId: 'candidate-1',
    reason: 'Rejected from Music Queue',
    requestMetadata: null,
  }]);
});

test('Music Queue match action hides matches outside the scoped release', async (t) => {
  const selectImportCandidate = t.mock.fn(async () => ({ toStatus: 'selected' }));
  const service = createService({ selectImportCandidate });

  await assert.rejects(
    () => service.useMusicQueueMatch({
      actorUserId: 'user-1',
      appUserId: 'user-1',
      matchId: 'candidate-outside-release',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'music_queue_match_not_found');
      return true;
    },
  );
  assert.equal(selectImportCandidate.mock.callCount(), 0);
});

test('Music Queue match action hides releases outside the app user scope', async (t) => {
  const rejectImportCandidate = t.mock.fn(async () => ({ toStatus: 'rejected' }));
  const service = createService({ rejectImportCandidate });

  await assert.rejects(
    () => service.rejectMusicQueueMatch({
      actorUserId: 'user-2',
      appUserId: 'user-2',
      matchId: 'candidate-1',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 404);
      assert.equal(error.code, 'music_queue_release_not_found');
      return true;
    },
  );
  assert.equal(rejectImportCandidate.mock.callCount(), 0);
});

test('requestMusicQueueReleaseRediscovery verifies release scope before queuing another search', async (t) => {
  const requestMusicQueueRediscovery = t.mock.fn(async () => ({
    metadataReleaseId: 'release-1',
    requestStatus: 'ready',
  }));
  const recordActivityEventFn = t.mock.fn(async () => {});
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ accepted: true, run: { id: 'run-1' } }));
  const service = createService({
    recordActivityEventFn,
    requestMusicQueueRediscovery,
    startLibraryDiscoveryRun,
    statusService: stoppedStatusService,
  });

  const result = await service.requestMusicQueueReleaseRediscovery({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'search_again');
  assert.equal(result.action.discoveryRunId, 'run-1');
  assert.deepEqual(requestMusicQueueRediscovery.mock.calls[0].arguments, [{
    metadataReleaseId: 'release-1',
    reasonCode: 'quality_choice_search_again',
    requestedAt: '2026-06-29T12:00:00.000Z',
    requestedByUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  }]);
  assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments, [{
    requestMetadata: { ipAddress: '127.0.0.1' },
    triggerSource: 'music_queue_try_again',
    triggeredByUserId: 'user-1',
  }]);
  assert.deepEqual(recordActivityEventFn.mock.calls[0].arguments, [{
    entityArtist: 'Forest Frank',
    entityId: 'wanted-1',
    entityTitle: 'Child of God',
    entityType: 'wanted_release',
    eventType: 'music_queue_search_queued',
    extraPayload: {
      schemaVersion: 1,
      wantedReleaseId: 'wanted-1',
      discoveryRunId: 'run-1',
      dispatchAlreadyActive: false,
      nextSearchAfter: null,
    },
  }]);
});

test('listMusicQueueReleases maps quality-blocked add evidence to a release-centred add stop', async () => {
  const release = createRelease({ status: 'import_pending' });
  release.discoveryRequest.importReviewSummary.downloadExecutionSummary = {
    itemStatusCounts: { completed: 1 },
    totalItemCount: 1,
  };
  release.discoveryRequest.importReviewSummary.libraryAddSummary = {
    latestAddBlockerCode: 'media_verification',
    latestItemStatus: 'blocked',
    latestOutcome: 'quality_blocked',
    latestQualityBlockedMessage: '1 file did not pass verified lossless checks before automatic add.',
    latestQualityGate: {
      blockers: [{
        code: 'safe_auto_spectral_transcoded',
        filename: '01 Fake.flac',
        message: 'Spectral analysis does not verify this lossless file.',
      }],
      message: '1 file did not pass verified lossless checks before automatic add.',
      profileCode: 'lossless_archive',
      status: 'blocked',
    },
    latestRecoveryReasonCode: 'suspicious_lossless',
    qualityBlockedCount: 1,
    totalItemCount: 1,
  };
  const service = createAcquisitionPipelineService({
    acquisitionPipelineStore: {
      listWantedReleaseEvidence: async () => ({
        checkedAt: '2026-06-29T12:00:00.000Z',
        pagination: { limit: 100, offset: 0, total: 1 },
        releases: [release],
      }),
    },
    qualityPolicyService,
  });

  const result = await service.listMusicQueueReleases({ appUserId: 'user-1' });

  assert.equal(result.releases[0].status.code, 'needs_help_adding');
  assert.equal(
    result.releases[0].status.detail,
    'This download claims to be lossless, but Harmoniarr could not verify that claim safely. It was not added to your library.',
  );
  assert.equal(result.releases[0].status.repair.code, 'media_verification');
  assert.equal(result.releases[0].status.repair.reasonCode, 'suspicious_lossless');
  assert.equal(result.releases[0].status.repair.actionLabel, 'Review lossless check');
  assert.equal(Object.hasOwn(result.releases[0].evidence.add, 'qualityGate'), false);
  assert.equal(result.summary.counts.needs_help_adding, 1);
});

test('listMusicQueueReleases renders automatic folder readiness as a safe setup stop', async () => {
  const release = createRelease();
  release.discoveryRequest.evidence = {
    lastSearchResult: {
      autoDownloadReadiness: {
        message: 'EACCES /private/downloads',
        ready: false,
        setupReason: 'download_folder_unavailable',
      },
    },
  };
  const service = createAcquisitionPipelineService({
    acquisitionPipelineStore: {
      listWantedReleaseEvidence: async () => ({
        checkedAt: '2026-07-26T12:00:00.000Z',
        pagination: { limit: 100, offset: 0, total: 1 },
        releases: [release],
      }),
    },
    qualityPolicyService,
  });

  const result = await service.listMusicQueueReleases({ appUserId: 'user-1' });

  assert.equal(result.releases[0].status.code, 'needs_setup');
  assert.equal(result.releases[0].status.nextAction, 'set_up_folders');
  assert.equal(result.releases[0].status.detail, 'Harmoniarr cannot reach a required download or library folder.');
  assert.doesNotMatch(JSON.stringify(result.releases[0].status), /private|EACCES/i);
});

test('listMusicQueueReleases forwards an optional artist filter to the scoped evidence store', async (t) => {
  const listWantedReleaseEvidence = t.mock.fn(async () => ({
    checkedAt: '2026-06-29T12:00:00.000Z',
    pagination: { limit: 10, offset: 0, total: 1 },
    releases: [createRelease()],
  }));
  const service = createAcquisitionPipelineService({
    acquisitionPipelineStore: { listWantedReleaseEvidence },
    qualityPolicyService,
    statusService,
  });

  await service.listMusicQueueReleases({
    appUserId: 'user-1',
    limit: 10,
    metadataArtistId: 'artist-1',
    offset: 0,
  });

  assert.deepEqual(listWantedReleaseEvidence.mock.calls[0].arguments, [{
    appUserId: 'user-1',
    limit: 10,
    metadataArtistId: 'artist-1',
    offset: 0,
  }]);
});

test('requestMusicQueueReleaseRediscovery succeeds when discovery dispatch is already active', async () => {
  const service = createService({
    startLibraryDiscoveryRun: async () => {
      const error = new Error('Discovery is already running');
      error.code = 'library_discovery_in_progress';
      throw error;
    },
    statusService: stoppedStatusService,
  });

  const result = await service.requestMusicQueueReleaseRediscovery({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.dispatchAlreadyActive, true);
  assert.equal(result.action.discoveryRunId, null);
});

test('requestMusicQueueReleaseRediscovery does not start duplicate shared work when a restart is already queued', async (t) => {
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ accepted: true, run: { id: 'run-1' } }));
  const recordActivityEventFn = t.mock.fn(async () => {});
  const service = createService({
    recordActivityEventFn,
    requestMusicQueueRediscovery: async () => ({
      discoveryRequest: {
        metadataReleaseId: 'release-1',
        requestStatus: 'cooldown',
      },
      restartDisposition: 'already_queued',
    }),
    startLibraryDiscoveryRun,
    statusService: stoppedStatusService,
  });

  const result = await service.requestMusicQueueReleaseRediscovery({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'search_again');
  assert.equal(result.action.restartAlreadyQueued, true);
  assert.equal(result.action.dispatchAlreadyActive, false);
  assert.equal(result.action.discoveryRunId, null);
  assert.equal(startLibraryDiscoveryRun.mock.callCount(), 0);
  assert.equal(recordActivityEventFn.mock.callCount(), 0);
});

test('requestMusicQueueReleaseRediscovery rejects unstopped releases before writing', async (t) => {
  const requestMusicQueueRediscovery = t.mock.fn(async () => ({}));
  const service = createService({ requestMusicQueueRediscovery });

  await assert.rejects(
    () => service.requestMusicQueueReleaseRediscovery({
      actorUserId: 'user-1',
      appUserId: 'user-1',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'music_queue_retry_not_available');
      return true;
    },
  );
  assert.equal(requestMusicQueueRediscovery.mock.callCount(), 0);
});

test('allowMusicQueueReleaseFallbackQuality verifies release scope and records a quality decision', async (t) => {
  const allowMusicQueueFallbackQuality = t.mock.fn(async () => ({
    metadataReleaseId: 'release-1',
    requestStatus: 'ready',
  }));
  const recordActivityEventFn = t.mock.fn(async () => {});
  const startLibraryDiscoveryRun = t.mock.fn(async () => ({ accepted: true, run: { id: 'run-1' } }));
  const service = createService({
    allowMusicQueueFallbackQuality,
    qualityPolicyService: fallbackBlockedQualityPolicyService,
    recordActivityEventFn,
    startLibraryDiscoveryRun,
    statusService: stoppedStatusService,
  });

  const result = await service.allowMusicQueueReleaseFallbackQuality({
    actorUserId: 'user-1',
    appUserId: 'user-1',
    requestMetadata: { ipAddress: '127.0.0.1' },
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(result.action.code, 'allow_fallback_quality');
  assert.equal(result.action.discoveryRunId, 'run-1');
  assert.deepEqual(allowMusicQueueFallbackQuality.mock.calls[0].arguments, [{
    allowedAt: '2026-06-29T12:00:00.000Z',
    allowedByUserId: 'user-1',
    metadataReleaseId: 'release-1',
    priorQualityProfile: 'lossless_archive',
    reasonCode: 'operator_allowed_fallback_quality',
    wantedReleaseId: 'wanted-1',
  }]);
  assert.equal(recordActivityEventFn.mock.calls[0].arguments[0].eventType, 'quality_fallback_allowed');
  assert.deepEqual(startLibraryDiscoveryRun.mock.calls[0].arguments, [{
    requestMetadata: { ipAddress: '127.0.0.1' },
    triggerSource: 'music_queue_quality_fallback',
    triggeredByUserId: 'user-1',
  }]);
});

test('allowMusicQueueReleaseFallbackQuality rejects unverified lossless states before writing', async (t) => {
  const allowMusicQueueFallbackQuality = t.mock.fn(async () => ({}));
  const service = createService({
    allowMusicQueueFallbackQuality,
    qualityPolicyService: needsVerificationQualityPolicyService,
    statusService: stoppedStatusService,
  });

  await assert.rejects(
    () => service.allowMusicQueueReleaseFallbackQuality({
      actorUserId: 'user-1',
      appUserId: 'user-1',
      wantedReleaseId: 'wanted-1',
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'music_queue_fallback_not_available');
      return true;
    },
  );
  assert.equal(allowMusicQueueFallbackQuality.mock.callCount(), 0);
});
