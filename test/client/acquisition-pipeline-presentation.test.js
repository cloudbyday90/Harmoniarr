import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMusicQueueAction,
  buildMusicQueueMatchReview,
  buildMusicQueueReleaseTypeFilters,
  buildMusicQueueSummaryCards,
  filterMusicQueueReleases,
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
    evidence: {
      match: {
        readiness: {
          code: 'low_confidence',
          message: 'The best match is below the automatic threshold.',
          scoredCandidateCount: 2,
        },
        statusCounts: { pending: 2 },
        totalCount: 2,
      },
      search: { lastSearchAt: '2026-06-28T12:00:00.000Z' },
    },
    releaseTitle: 'Child of God',
    releaseGroupType: 'album',
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
  assert.equal(release.releaseTypeLabel, 'Album');
  assert.equal(release.matchSummary.totalCount, 2);
  assert.equal(release.detailText, 'The best match is below the automatic threshold.');
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
      ready_to_add: 2,
    },
  });

  assert.deepEqual(cards.map((card) => [card.key, card.value]), [
    ['waiting', 4],
    ['searching', 2],
    ['downloading', 1],
    ['ready-to-add', 2],
    ['needs-help', 0],
    ['needs-setup', 1],
  ]);
});

test('filterMusicQueueReleases filters by state, release type, and search text', () => {
  const releases = [
    normalizeMusicQueueRelease({
      artistName: 'Lauren Daigle',
      releaseGroupType: 'Album',
      releaseTitle: 'Look Up Child',
      status: { code: 'queued_for_search', label: 'Queued', message: 'Waiting', tone: 'neutral' },
    }),
    normalizeMusicQueueRelease({
      artistName: 'Forest Frank',
      releaseGroupType: 'EP',
      releaseTitle: 'Child of God',
      status: { code: 'quality_choice_needed', label: 'Quality choice needed', message: 'Needs review', tone: 'warning' },
    }),
  ];

  assert.deepEqual(
    filterMusicQueueReleases(releases, { query: 'forest', releaseType: 'ep', state: 'needs_help' })
      .map((release) => release.artistName),
    ['Forest Frank'],
  );
});

test('buildMusicQueueAction maps setup and review actions to user outcomes', () => {
  assert.deepEqual(
    buildMusicQueueAction({ nextAction: 'set_up_folders' }),
    { code: 'set_up_folders', label: 'Set up folders', routeName: 'settings-media-storage', type: 'route' },
  );
  assert.deepEqual(
    buildMusicQueueAction({ nextAction: 'review_matches' }),
    { code: 'review_matches', label: 'Review matches', type: 'review' },
  );
  assert.deepEqual(
    buildMusicQueueAction({ nextAction: 'show_advanced_diagnostics' }),
    { code: 'show_advanced_diagnostics', label: 'Set up media tools', routeName: 'settings-media-storage', type: 'route' },
  );
});

test('buildMusicQueueMatchReview returns match and quality rows for the details panel', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Forest Frank',
    evidence: {
      match: {
        bestCompositeScore: 82,
        readiness: { message: 'The best match is below the high-confidence threshold.', scoreGap: 3 },
        statusCounts: { failed: 1, pending: 2 },
        totalCount: 3,
      },
    },
    quality: {
      code: 'needs_verification',
      explanation: 'Lossless preference needs verified media evidence.',
      formats: ['flac'],
      profile: { code: 'lossless_archive' },
      verifiedLossless: false,
    },
    releaseTitle: 'Child of God',
    status: {
      code: 'pick_match',
      label: 'Pick a match',
      message: 'Choose a match.',
      nextAction: 'review_matches',
      tone: 'warning',
    },
  });

  const review = buildMusicQueueMatchReview(release);

  assert.equal(review.heading, 'Child of God by Forest Frank');
  assert.equal(review.reason, 'The best match is below the high-confidence threshold.');
  assert.deepEqual(review.matchRows.slice(0, 2), [
    { label: 'Matches found', value: '3' },
    { label: 'Ready to review', value: '2' },
  ]);
  assert.ok(review.qualityRows.some((row) => row.value === 'Needs verification'));
});

test('buildMusicQueueReleaseTypeFilters derives stable type options', () => {
  const filters = buildMusicQueueReleaseTypeFilters([
    normalizeMusicQueueRelease({ releaseGroupType: 'Album' }),
    normalizeMusicQueueRelease({ releaseGroupType: 'EP' }),
    normalizeMusicQueueRelease({ releaseGroupType: 'Album' }),
  ]);

  assert.deepEqual(filters, [
    { label: 'All types', value: 'all' },
    { label: 'Album', value: 'album' },
    { label: 'EP', value: 'ep' },
  ]);
});
