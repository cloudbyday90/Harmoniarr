import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveMusicQueueStatus,
  MUSIC_QUEUE_ACTION_CODES,
  MUSIC_QUEUE_STATUS_CODES,
} from '../../src/server/acquisition/acquisition-pipeline-status-service.js';

test('deriveMusicQueueStatus sends missing releases to queued for search by default', () => {
  const status = deriveMusicQueueStatus({
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.QUEUED_FOR_SEARCH);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.SEARCH_NOW);
});

test('deriveMusicQueueStatus surfaces provider setup blockers before search state', () => {
  const status = deriveMusicQueueStatus({
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
    setup: { providerBlocked: true },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_SETUP);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.CONFIGURE_PROVIDER);
});

test('deriveMusicQueueStatus asks for a quality choice when lossless evidence is blocked', () => {
  const status = deriveMusicQueueStatus({
    quality: { code: 'below_minimum', explanation: 'Lossless required.' },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_QUALITY_CHOICE);
});

test('deriveMusicQueueStatus treats completed downloads as ready to add', () => {
  const status = deriveMusicQueueStatus({
    match: { executionStatusCounts: { completed: 1 } },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.READY_TO_ADD);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.ADD_TO_LIBRARY);
});

test('deriveMusicQueueStatus makes a post-download media verification stop release-centred', () => {
  const status = deriveMusicQueueStatus({
    add: {
      blockerCode: 'media_verification',
      latestOutcome: 'quality_blocked',
      message: '1 file did not pass verified lossless checks before automatic add.',
      qualityBlockedCount: 1,
      recoveryReasonCode: 'suspicious_lossless',
    },
    match: { executionStatusCounts: { completed: 1 }, latestStatus: 'import_pending' },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(status.label, 'Needs help');
  assert.equal(status.detail, 'This download claims to be lossless, but Harmoniarr could not verify that claim safely. It was not added to your library.');
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN);
  assert.equal(status.repair.code, 'media_verification');
  assert.equal(status.repair.reasonCode, 'suspicious_lossless');
  assert.equal(status.repair.actionLabel, 'Review lossless check');
});

test('deriveMusicQueueStatus gives each safe add stop one specific recovery action', () => {
  const release = { missingTrackCount: 10, wantedStatus: 'missing' };
  const cases = [
    {
      add: { latestOutcome: 'quality_blocked', qualityBlockedCount: 1, recoveryReasonCode: 'lossy_audio' },
      expectedAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_QUALITY_CHOICE,
      expectedLabel: 'Review audio quality',
      expectedReason: 'lossy_audio',
    },
    {
      add: { latestOutcome: 'quality_blocked', qualityBlockedCount: 1, recoveryReasonCode: 'audio_check_failed' },
      expectedAction: MUSIC_QUEUE_ACTION_CODES.RECHECK_LIBRARY_ADD,
      expectedLabel: 'Try audio check again',
      expectedReason: 'audio_check_failed',
    },
    {
      add: { itemStatusCounts: { blocked: 1 }, latestOutcome: 'blocked' },
      expectedAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN,
      expectedLabel: 'Review add plan',
      expectedReason: 'unsafe_add_plan',
    },
    {
      match: { addBlockerCode: 'library_collision', latestEventType: 'import_candidate_import_blocked' },
      expectedAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN,
      expectedLabel: 'Review library conflict',
      expectedReason: 'library_collision',
    },
  ];

  for (const scenario of cases) {
    const status = deriveMusicQueueStatus({ release, ...scenario });
    assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
    assert.equal(status.nextAction, scenario.expectedAction);
    assert.equal(status.repair.actionLabel, scenario.expectedLabel);
    assert.equal(status.repair.reasonCode, scenario.expectedReason);
  }
});

test('deriveMusicQueueStatus keeps a terminal media verification stop ahead of stale queued execution', () => {
  const status = deriveMusicQueueStatus({
    add: {
      latestOutcome: 'quality_blocked',
      qualityBlockedCount: 1,
    },
    match: {
      executionStatusCounts: { queued: 1 },
      statusCounts: { failed: 1 },
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN);
  assert.equal(status.repair.code, 'media_verification');
});

test('deriveMusicQueueStatus keeps a real active fallback download ahead of historical quality evidence', () => {
  const status = deriveMusicQueueStatus({
    add: {
      latestOutcome: 'quality_blocked',
      qualityBlockedCount: 1,
    },
    match: {
      executionStatusCounts: { queued: 2 },
      statusCounts: { downloading: 1, failed: 1 },
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.DOWNLOADING);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.OPEN_DOWNLOADER);
});

test('deriveMusicQueueStatus surfaces blocked library add work before ready-to-add', () => {
  const status = deriveMusicQueueStatus({
    add: {
      itemStatusCounts: { blocked: 1 },
      latestOutcome: 'blocked',
    },
    match: { latestStatus: 'import_pending' },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN);
  assert.equal(status.repair.code, 'unsafe_add_plan');
});

test('deriveMusicQueueStatus surfaces a recorded import blocker before generic match states', () => {
  const result = deriveMusicQueueStatus({
    match: {
      addBlockerCode: 'library_collision',
      latestEventType: 'import_candidate_import_blocked',
      statusCounts: { failed: 1, pending: 1 },
    },
    release: {
      missingTrackCount: 8,
      wantedStatus: 'missing',
    },
  });

  assert.equal(result.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(result.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN);
  assert.equal(result.progressStep, 'add');
  assert.equal(result.repair.code, 'library_collision');
  assert.equal(result.repair.settingsRouteName, undefined);
});

test('deriveMusicQueueStatus gives a folder repair only for a persisted source-path blocker', () => {
  const status = deriveMusicQueueStatus({
    match: {
      addBlockerCode: 'source_path_unavailable',
      latestEventType: 'import_candidate_import_blocked',
    },
    release: { missingTrackCount: 8, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(status.repair.settingsRouteName, 'settings-media-storage');
  assert.equal(status.repair.settingsRouteLabel, 'Set up folders');
});

test('deriveMusicQueueStatus keeps manually selected matches distinct from automatic recovery', () => {
  const status = deriveMusicQueueStatus({
    add: {
      latestOutcome: 'quality_blocked',
      message: '1 file did not pass verified lossless checks before automatic add.',
      qualityBlockedCount: 1,
    },
    match: {
      statusCounts: {
        failed: 1,
        selected: 1,
      },
      totalCount: 2,
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.DOWNLOAD_NOW);
});

test('deriveMusicQueueStatus distinguishes current queued preparation from a confirmed download', () => {
  const status = deriveMusicQueueStatus({
    match: {
      executionStatusCounts: { pending: 1 },
      currentExecutionStatusCounts: { pending: 1 },
      statusCounts: { selected: 1 },
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.DOWNLOADING);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.OPEN_DOWNLOADER);
  assert.equal(status.label, 'Download queued');
  assert.equal(status.message, 'The selected match is queued for download preparation.');
});

test('deriveMusicQueueStatus requires a committed recovery child before an automatic selection claims progress', () => {
  const status = deriveMusicQueueStatus({
    match: {
      recoverySelectedCount: 1,
      statusCounts: {
        failed: 1,
        selected: 1,
      },
      totalCount: 2,
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.DOWNLOAD_NOW);
});

test('deriveMusicQueueStatus keeps quality recovery stopped when only unevaluated pending options remain', () => {
  const status = deriveMusicQueueStatus({
    add: {
      latestOutcome: 'quality_blocked',
      message: '1 file did not pass verified lossless checks before automatic add.',
      qualityBlockedCount: 1,
    },
    match: {
      pendingCount: 2,
      statusCounts: {
        failed: 1,
        pending: 2,
      },
      totalCount: 3,
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN);
});

test('exact queued or running recovery reservations carry truthful preparation progress even for an older selected search', () => {
  for (const [executionStatus, message] of [
    ['pending', 'A previous match did not work. The next eligible match is queued for download preparation.'],
    ['running', 'Harmoniarr is preparing the next eligible match for download.'],
  ]) {
    const status = deriveMusicQueueStatus({
      add: { latestOutcome: 'quality_blocked', qualityBlockedCount: 1 },
      match: { statusCounts: { failed: 1, pending: 2 }, pendingCount: 2,
        recoveryExecution: { status: executionStatus, candidateMatches: true, authorityReserved: true } },
      release: { wantedStatus: 'missing', missingTrackCount: 10 },
    });
    assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.TRYING_NEXT_MATCH);
    assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
    assert.equal(status.message, message);
    assert.equal(status.tone, 'info');
  }
});

test('missing, stale, mismatched and refused recovery reservations cannot turn remaining candidates into automatic work', () => {
  for (const recoveryExecution of [null, {}, { status: 'pending', candidateMatches: true, authorityReserved: false },
    { status: 'running', candidateMatches: false, authorityReserved: true }, { status: 'pending', candidateMatches: 'true', authorityReserved: true },
    { status: 'completed', candidateMatches: true, authorityReserved: true }, { status: 'failed', candidateMatches: true, authorityReserved: true }]) {
    const status = deriveMusicQueueStatus({ match: { statusCounts: { failed: 1, pending: 2 }, pendingCount: 2,
      recoveryExecution, executionStatusCounts: { pending: 1, queued: 1 }, confirmedTransferCount: 3 },
    release: { wantedStatus: 'missing', missingTrackCount: 10 },
    search: { status: 'blocked', blockedReason: 'download_recovery_exhausted', searchAttemptCount: 3 } });
    const knownActive = ['pending', 'running'].includes(recoveryExecution?.status);
    assert.equal(status.code, knownActive ? MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING : MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT);
    assert.equal(status.nextAction, knownActive ? MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY : MUSIC_QUEUE_ACTION_CODES.TRY_AGAIN);
  }
});

test('current provider acceptance outranks preparation and historical stops through the selected-parent update gap', () => {
  for (const queuedStatus of ['queued', 'queued_with_warnings']) {
    const status = deriveMusicQueueStatus({ add: { latestOutcome: 'quality_blocked', qualityBlockedCount: 1 },
      match: { statusCounts: { failed: 1, selected: 1 }, currentConfirmedTransferCount: 1,
        executionStatusCounts: { [queuedStatus]: 1 }, recoveryExecution: { status: 'running', candidateMatches: true, authorityReserved: true } },
      release: { wantedStatus: 'missing', missingTrackCount: 10 } });
    assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.DOWNLOADING);
    assert.equal(status.label, 'Downloading');
    assert.equal(status.message, 'A selected match is downloading.');
  }
});

test('stale sibling execution items do not start a new selected match and refused recovery remains stopped', () => {
  const release = { wantedStatus: 'missing', missingTrackCount: 10 };
  const selected = deriveMusicQueueStatus({ release,
    match: { statusCounts: { failed: 1, selected: 1 }, executionStatusCounts: { pending: 1, queued: 1 }, confirmedTransferCount: 2 } });
  assert.equal(selected.code, MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES);
  assert.equal(selected.nextAction, MUSIC_QUEUE_ACTION_CODES.DOWNLOAD_NOW);
  const preparing = deriveMusicQueueStatus({ release,
    add: { latestOutcome: 'quality_blocked', qualityBlockedCount: 1 },
    match: { statusCounts: { selected: 1 }, currentExecutionStatusCounts: { running: 1 },
      latestEventType: 'import_candidate_import_blocked', addBlockerCode: 'library_collision' } });
  assert.equal(preparing.label, 'Preparing download');
  assert.equal(preparing.message, 'Harmoniarr is preparing the selected match for download.');
  const refused = deriveMusicQueueStatus({ release,
    match: { statusCounts: { failed: 1, selected: 1 }, recoverySelectedCount: 1,
      recoveryExecution: { status: null, candidateMatches: true, authorityReserved: false }, executionStatusCounts: { blocked: 1 } } });
  assert.equal(refused.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.notEqual(refused.nextAction, MUSIC_QUEUE_ACTION_CODES.DOWNLOAD_NOW);
});

test('held retirement is reviewable rather than selected and a retained terminal reservation cannot advertise Start download', () => {
  const release = { wantedStatus: 'missing', missingTrackCount: 10 };
  const search = { status: 'blocked', blockedReason: 'download_recovery_exhausted', searchAttemptCount: 3 };
  const retired = deriveMusicQueueStatus({ release, search, match: { statusCounts: { failed: 1, held: 1 },
    executionStatusCounts: { queued: 1 }, confirmedTransferCount: 2 } });
  assert.equal(retired.code, MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT);
  assert.equal(retired.nextAction, MUSIC_QUEUE_ACTION_CODES.TRY_AGAIN);
  const retained = deriveMusicQueueStatus({ release, search, match: { statusCounts: { failed: 1, selected: 1 },
    recoveryExecution: { status: null, candidateMatches: true, authorityReserved: false, reservationRetained: true } } });
  assert.equal(retained.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
  assert.equal(retained.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
  assert.equal(retained.message, 'Automatic recovery needs review before another download can start.');
});

test('retired selections and legacy automatic intents remain reviewable without claiming an active reservation', () => {
  for (const guard of ['legacyRecoverySelection', 'recoverySelectionNeedsReview']) {
    const status = deriveMusicQueueStatus({ release: { wantedStatus: 'missing', missingTrackCount: 10 },
      match: { statusCounts: { selected: 1 }, [guard]: true, currentExecutionStatusCounts: { pending: 1 } } });
    assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING);
    assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
  }
});

test('durable delayed search evidence distinguishes waiting, actual search and unresolved terminal ownership', () => {
  for (const [stage, code] of [['pending', MUSIC_QUEUE_STATUS_CODES.RETRYING_SEARCH], ['running', MUSIC_QUEUE_STATUS_CODES.SEARCHING],
    [null, MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING]]) {
    const status = deriveMusicQueueStatus({ release: { wantedStatus: 'missing', missingTrackCount: 10 },
      match: { statusCounts: { failed: 1, pending: 2 }, totalCount: 3, executionStatusCounts: { queued: 1 } },
      search: { status: 'cooldown', nextSearchAfter: '2030-10-08T00:00:00Z', searchAttemptCount: 3,
        recoveryDiscovery: { status: stage, reservationRetained: true } } });
    assert.equal(status.code, code);
    assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
    if (stage === null) assert.equal(status.message, 'Automatic recovery needs review before another search can start.');
  }
});

test('deriveMusicQueueStatus keeps scheduled cooldown retries automatic', () => {
  const status = deriveMusicQueueStatus({
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
    search: {
      nextSearchAfter: '2026-07-27T12:00:00.000Z',
      searchAttemptCount: 2,
      status: 'cooldown',
    },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.RETRYING_SEARCH);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
});

test('deriveMusicQueueStatus stops at no matches left only after recovery is exhausted', () => {
  const status = deriveMusicQueueStatus({
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
    search: {
      searchAttemptCount: 3,
      status: 'blocked',
    },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.TRY_AGAIN);
});

test('deriveMusicQueueStatus surfaces a terminal bounded stop over stale failed matches', () => {
  const status = deriveMusicQueueStatus({
    match: {
      readiness: { code: 'ambiguous' },
      statusCounts: { failed: 1 },
      totalCount: 1,
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
    search: {
      blockedReason: 'download_recovery_exhausted',
      status: 'blocked',
    },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.TRY_AGAIN);
});

test('deriveMusicQueueStatus asks users to pick a match for ambiguous evidence', () => {
  const status = deriveMusicQueueStatus({
    match: {
      readiness: {
        code: 'ambiguous',
        message: 'Multiple matches are too close to choose automatically.',
      },
      totalCount: 3,
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.PICK_MATCH);
  assert.equal(status.detail, 'Multiple matches are too close to choose automatically.');
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_MATCHES);
});
