import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMusicQueueSummaryCards,
  getMusicQueueStatusClass,
  normalizeMusicQueueRelease,
} from '../../src/client/lib/acquisition-pipeline-presentation.js';

test('normalizeMusicQueueRelease maps release and quality copy for the view', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    matchedTrackCount: 4,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
    },
    releaseTitle: 'Child of God',
    status: {
      code: 'downloading',
      label: 'Downloading',
      message: 'A selected match is downloading.',
      tone: 'info',
    },
  });

  assert.equal(release.artistName, 'Forest Frank');
  assert.equal(release.coverageLabel, '4 of 12 tracks');
  assert.equal(release.qualityDecisionLabel, 'Quality accepted');
  assert.equal(release.qualityProfileLabel, 'Lossless archive');
  assert.equal(release.statusClass, 'review-status-pending');
});

test('getMusicQueueStatusClass maps warning and neutral statuses to existing pill classes', () => {
  assert.equal(getMusicQueueStatusClass({ tone: 'warning' }), 'review-status-held');
  assert.equal(getMusicQueueStatusClass({ tone: 'neutral' }), 'review-status-held');
});

test('buildMusicQueueSummaryCards groups statuses into home-user buckets', () => {
  const cards = buildMusicQueueSummaryCards({
    counts: {
      checking_matches: 2,
      downloading: 1,
      in_library: 3,
      needs_setup: 1,
      queued_for_search: 4,
    },
  });

  assert.deepEqual(cards.map((card) => [card.key, card.value]), [
    ['waiting', 4],
    ['working', 3],
    ['needs-help', 1],
    ['done', 3],
  ]);
});
