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
      retrying_search: 1,
    },
  });

  assert.deepEqual(cards.map((card) => [card.key, card.value]), [
    ['waiting', 5],
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
  assert.deepEqual(
    buildMusicQueueAction({ nextAction: 'view_recovery' }),
    { code: 'view_recovery', label: 'View recovery', type: 'review' },
  );
});

test('normalizeMusicQueueRelease makes automatic recovery calm and keeps stopped recovery actionable', () => {
  const automatic = normalizeMusicQueueRelease({
    releaseTitle: 'Child of God',
    status: { code: 'retrying_search', label: 'Searching again automatically', tone: 'info' },
  });
  const stopped = normalizeMusicQueueRelease({
    releaseTitle: 'How Can It Be',
    status: { code: 'no_matches_left', label: 'No matches left', tone: 'warning' },
  });

  assert.deepEqual(automatic.action, { code: 'view_recovery', label: 'View recovery', type: 'review' });
  assert.match(automatic.detailText, /try again automatically/i);
  assert.equal(stopped.action.label, 'Review recovery');
  assert.equal(buildMusicQueueMatchReview(stopped).searchAgainLabel, 'Search again');
});

test('buildMusicQueueMatchReview returns match and quality rows for the details panel', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Forest Frank',
    evidence: {
      match: {
        bestCompositeScore: 82,
        matches: [{
          fileCount: 12,
          formats: ['flac'],
          hasFreeUploadSlot: true,
          lockedFileCount: 0,
          matchId: 'candidate-1',
          queueLength: 0,
          score: 82,
          status: 'pending',
          totalSizeBytes: 123456789,
          trackMatchSummary: {
            expectedTrackCount: 12,
            matchedTrackCount: 11,
          },
          uploadSpeed: 1048576,
        }, {
          fileCount: 12,
          formats: ['mp3'],
          matchId: 'candidate-2',
          score: 80,
          status: 'failed',
        }],
        readiness: { message: 'The best match is below the high-confidence threshold.', scoreGap: 3 },
        statusCounts: { failed: 1, pending: 2 },
        totalCount: 3,
      },
    },
    quality: {
      code: 'needs_verification',
      explanation: 'Lossless preference needs verified media evidence.',
      formats: ['flac'],
      profile: {
        code: 'lossless_archive',
        cutoffFormats: ['flac', 'alac', 'wav'],
        fallbackAllowed: false,
        minimumFormats: ['flac', 'alac', 'wav'],
        preferredFormats: ['flac'],
        requiresVerification: true,
        upgradeAllowed: false,
      },
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
  assert.equal(review.canSearchAgain, false);
  assert.equal(review.reason, 'The best match is below the high-confidence threshold.');
  assert.equal(review.matchCards.length, 2);
  assert.equal(review.matchCards[0].qualityFitLabel, 'Preferred quality');
  assert.equal(review.matchCards[0].canUseMatch, true);
  assert.equal(review.matchCards[0].canRejectMatch, true);
  assert.equal(review.matchCards[0].trackCoverageLabel, '11 of 12 tracks matched');
  assert.equal(review.matchCards[0].healthLabel, 'Free slot - 1.0 MB/s');
  assert.deepEqual(
    review.matchCards[0].qualityRows.map((row) => [row.label, row.value]),
    [
      ['Observed', 'FLAC'],
      ['Preferred', 'Matches FLAC'],
      ['Minimum', 'Meets FLAC, ALAC, WAV'],
      ['Cutoff', 'At cutoff FLAC, ALAC, WAV'],
      ['Fallback', 'Not using fallback'],
      ['Audio check', 'Required before automatic progress'],
      ['Spectral check', 'No spectral evidence'],
    ],
  );
  assert.equal(review.matchCards[1].statusLabel, 'Blocked');
  assert.equal(review.matchCards[1].canUseMatch, false);
  assert.equal(review.matchCards[1].canRejectMatch, false);
  assert.equal(review.matchCards[1].qualityFitLabel, 'Below profile');
  assert.deepEqual(review.matchRows.slice(0, 2), [
    { label: 'Matches found', value: '3' },
    { label: 'Ready to review', value: '2' },
  ]);
  assert.ok(review.qualityRows.some((row) => row.label === 'Cutoff' && row.value === 'FLAC, ALAC, WAV'));
  assert.ok(review.qualityRows.some((row) => row.label === 'Fallback' && row.value === 'Fallback blocked'));
  assert.ok(review.qualityRows.some((row) => row.value === 'Needs verification'));
  assert.equal(review.qualityGuidance, 'Harmoniarr needs real audio evidence before treating this as lossless.');
});

test('buildMusicQueueMatchReview exposes search again for quality-stopped releases', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Lauren Daigle',
    quality: {
      code: 'below_minimum',
      explanation: 'Lossless archive requires flac, alac, wav.',
      formats: ['mp3'],
      profile: {
        code: 'lossless_archive',
        cutoffFormats: ['flac', 'alac', 'wav'],
        fallbackAllowed: false,
        minimumFormats: ['flac', 'alac', 'wav'],
        preferredFormats: ['flac'],
        requiresVerification: true,
      },
    },
    releaseTitle: 'How Can It Be',
    status: {
      code: 'quality_choice_needed',
      label: 'Quality choice needed',
      message: 'Only lossy matches were found.',
      nextAction: 'review_quality_choice',
      tone: 'warning',
    },
  });

  const review = buildMusicQueueMatchReview(release);

  assert.equal(review.canSearchAgain, true);
  assert.equal(review.searchAgainLabel, 'Search again');
});

test('buildMusicQueueMatchReview exposes fallback quality action for below-profile quality stops', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Forest Frank',
    evidence: { match: { totalCount: 1 } },
    id: 'wanted-1',
    quality: {
      autoAddEligible: false,
      autoDownloadEligible: false,
      bitrateKbps: 320,
      code: 'below_minimum',
      explanation: 'Lossless archive requires FLAC.',
      fallbackOverrideActive: false,
      formats: ['mp3'],
      profile: {
        code: 'lossless_archive',
        cutoffFormats: ['flac'],
        fallbackAllowed: false,
        minimumFormats: ['flac'],
        preferredFormats: ['flac'],
      },
      verifiedLossless: false,
    },
    releaseTitle: 'Child of God',
    status: {
      code: 'quality_choice_needed',
      label: 'Quality choice needed',
      message: 'Needs review',
      nextAction: 'review_quality_choice',
      tone: 'warning',
    },
  });

  const review = buildMusicQueueMatchReview(release);

  assert.equal(review.canAllowFallbackQuality, true);
  assert.equal(review.fallbackQualityLabel, 'Allow fallback quality');
  assert.ok(review.qualityRows.some((row) => row.label === 'Release choice' && row.value === 'No release override'));
});

test('buildMusicQueueMatchReview hides fallback action after release override is active', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Forest Frank',
    id: 'wanted-1',
    quality: {
      autoAddEligible: true,
      autoDownloadEligible: true,
      code: 'accepted',
      explanation: 'Fallback quality is allowed for this release.',
      fallbackOverrideActive: true,
      formats: ['mp3'],
      profile: {
        code: 'lossless_archive',
        cutoffFormats: ['flac'],
        fallbackAllowed: true,
        minimumFormats: ['flac', 'mp3'],
        preferredFormats: ['flac'],
        upgradeAllowed: true,
      },
    },
    releaseTitle: 'Child of God',
    status: {
      code: 'pick_match',
      label: 'Pick a match',
      message: 'Review matches',
      nextAction: 'review_matches',
      tone: 'warning',
    },
  });

  const review = buildMusicQueueMatchReview(release);

  assert.equal(review.canAllowFallbackQuality, false);
  assert.ok(review.qualityRows.some((row) => row.label === 'Release choice' && row.value === 'Allowed for this release'));
  assert.match(review.qualityGuidance, /Fallback quality is allowed/);
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
