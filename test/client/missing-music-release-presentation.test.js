/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMissingMusicReleaseAction,
  getMissingMusicReleaseStatusClass,
} from '../../src/client/lib/missing-music-release-action-presentation.js';
import {
  buildMissingMusicSummaryCards,
  normalizeMissingMusicRelease,
} from '../../src/client/lib/missing-music-release-normalization.js';
import { buildMissingMusicMatchReview } from '../../src/client/lib/missing-music-release-review-presentation.js';

function createRelease({
  status = {
    code: 'pick_match',
    label: 'Choose a match',
    message: 'Several close matches are available.',
    nextAction: 'review_matches',
    tone: 'warning',
  },
} = {}) {
  return {
    artistName: 'Forest Frank',
    evidence: {
      match: {
        latestUpdatedAt: '2026-08-28T12:00:00.000Z',
        matches: [{
          fileCount: 10,
          formats: ['flac'],
          hasFreeUploadSlot: true,
          matchId: 'match-1',
          score: 98.137,
          status: 'pending',
          totalSizeBytes: 1048576,
          trackMatchSummary: { expectedTrackCount: 10, matchedTrackCount: 10 },
        }],
        readiness: { code: 'ambiguous', message: 'Choose between close matches.' },
        statusCounts: { pending: 1 },
        totalCount: 1,
      },
      operatorSelection: {
        selectionOrigin: 'manual',
        selectionSource: 'release_detail',
        selectionState: 'included',
      },
    },
    expectedTrackCount: 10,
    id: 'release-1',
    matchedTrackCount: 0,
    missingTrackCount: 10,
    quality: {
      autoAddEligible: false,
      autoDownloadEligible: false,
      code: 'below_minimum',
      formats: ['flac'],
      profile: {
        code: 'lossless_archive',
        cutoffFormats: ['flac'],
        fallbackAllowed: false,
        minimumFormats: ['flac'],
        preferredFormats: ['flac'],
        requiresVerification: true,
      },
      tone: 'warning',
      verifiedLossless: false,
    },
    releaseDate: '2024-05-01',
    releaseGroupType: 'album',
    releaseTitle: 'Good Day',
    status,
  };
}

test('Missing Music release normalization preserves server-derived action, release scope, and presentation data', () => {
  const result = normalizeMissingMusicRelease(createRelease());

  assert.equal(result.action.label, 'Review matches');
  assert.equal(result.artistName, 'Forest Frank');
  assert.equal(result.coverageLabel, '0 of 10 tracks');
  assert.equal(result.lastActivityAt, '2026-08-28T12:00:00.000Z');
  assert.equal(result.matchSummary.label, '1 match found');
  assert.equal(result.operatorSelection.selectionOrigin, 'manual');
  assert.deepEqual(result.progressChips, ['10 missing', '1 match found', 'Lossless archive']);
  assert.equal(result.releaseTypeLabel, 'Album');
  assert.equal(result.releaseYear, '2024');
  assert.equal(result.statusClass, 'review-status-held');
});

test('Missing Music summary cards keep each operational state distinct', () => {
  const cards = buildMissingMusicSummaryCards({
    counts: {
      adding_to_library: 1,
      checking_matches: 1,
      downloading: 2,
      failed: 1,
      needs_setup: 1,
      pick_match: 1,
      queued_for_search: 3,
      retrying_search: 1,
      trying_next_match: 1,
    },
  });

  assert.deepEqual(cards, [
    { key: 'waiting', label: 'Waiting', value: 4 },
    { key: 'searching', label: 'Searching', value: 2 },
    { key: 'downloading', label: 'Downloading', value: 3 },
    { key: 'ready-to-add', label: 'Ready to add', value: 1 },
    { key: 'needs-help', label: 'Needs help', value: 1 },
    { key: 'needs-setup', label: 'Needs setup', value: 1 },
  ]);
});

test('Missing Music match review reports available choices without claiming that they will download', () => {
  const release = normalizeMissingMusicRelease(createRelease());
  const review = buildMissingMusicMatchReview(release);

  assert.equal(review.canAddToLibrary, false);
  assert.equal(review.canAllowFallbackQuality, false);
  assert.equal(review.canSearchAgain, false);
  assert.equal(review.heading, 'Good Day by Forest Frank');
  assert.equal(review.matchCards[0].canUseMatch, true);
  assert.equal(review.matchCards[0].qualityFitLabel, 'Preferred quality');
  assert.equal(review.matchCards[0].reason, 'This is one of several close matches, so Harmoniarr needs a choice.');
  assert.equal(review.matchCards[0].trackCoverageLabel, '10 of 10 tracks matched');
});

test('Missing Music action presentation preserves recovery precedence and neutral fallback behavior', () => {
  assert.deepEqual(buildMissingMusicReleaseAction({ nextAction: 'download_now' }, { kind: 'automatic' }), {
    code: 'view_recovery',
    label: 'View recovery',
    type: 'review',
  });
  assert.deepEqual(buildMissingMusicReleaseAction({ nextAction: 'unknown' }), {
    code: 'show_details',
    label: 'View details',
    type: 'review',
  });
  assert.equal(getMissingMusicReleaseStatusClass({ tone: 'danger' }), 'review-status-failed');
});

test('Missing Music exposes fallback-quality permission only for the dedicated quality-choice state', () => {
  const release = normalizeMissingMusicRelease(createRelease({
    status: {
      code: 'quality_choice_needed',
      label: 'Choose quality',
      message: 'The selected match is below the profile.',
      nextAction: 'review_quality_choice',
      tone: 'warning',
    },
  }));

  assert.equal(buildMissingMusicMatchReview(release).canAllowFallbackQuality, true);
});
