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

test('deriveMusicQueueStatus surfaces safe-auto quality blocks before ready-to-add', () => {
  const status = deriveMusicQueueStatus({
    add: {
      latestOutcome: 'quality_blocked',
      message: '1 file did not pass verified lossless checks before automatic add.',
      qualityBlockedCount: 1,
    },
    match: { executionStatusCounts: { completed: 1 }, latestStatus: 'import_pending' },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED);
  assert.equal(status.detail, '1 file did not pass verified lossless checks before automatic add.');
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_QUALITY_CHOICE);
});

test('deriveMusicQueueStatus surfaces an exhausted quality stop over a stale queued execution item', () => {
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

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.REVIEW_QUALITY_CHOICE);
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
});

test('deriveMusicQueueStatus surfaces a recorded import blocker before generic match states', () => {
  const result = deriveMusicQueueStatus({
    match: {
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

test('deriveMusicQueueStatus shows the active download when automatic execution is queued for a selected match', () => {
  const status = deriveMusicQueueStatus({
    match: {
      executionStatusCounts: { pending: 1 },
      statusCounts: { selected: 1 },
    },
    release: { missingTrackCount: 10, wantedStatus: 'missing' },
  });

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.DOWNLOADING);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.OPEN_DOWNLOADER);
});

test('deriveMusicQueueStatus surfaces an automatically promoted fallback as trying another match', () => {
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

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.TRYING_NEXT_MATCH);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
});

test('deriveMusicQueueStatus shows trying next match when quality recovery leaves pending options', () => {
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

  assert.equal(status.code, MUSIC_QUEUE_STATUS_CODES.TRYING_NEXT_MATCH);
  assert.equal(status.nextAction, MUSIC_QUEUE_ACTION_CODES.VIEW_RECOVERY);
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
