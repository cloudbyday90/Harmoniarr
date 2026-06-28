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
