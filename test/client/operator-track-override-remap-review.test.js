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
  buildTrackOverrideRemapReviewSummaryText,
  getTrackOverrideRemapReviewPresentation,
  getTrackOverrideRemapReviewSummaryTone,
  isTrackOverrideRemapReviewStatus,
  normalizeTrackOverrideRemapStatus,
  summarizeTrackOverrideRemapReview,
} from '../../src/client/lib/operator-track-override-remap-review.js';

test('normalizeTrackOverrideRemapStatus defaults blank values to resolved', () => {
  assert.equal(normalizeTrackOverrideRemapStatus(null), 'resolved');
  assert.equal(normalizeTrackOverrideRemapStatus(' REVIEW_NEEDED '), 'review_needed');
});

test('isTrackOverrideRemapReviewStatus recognizes actionable states only', () => {
  assert.equal(isTrackOverrideRemapReviewStatus('review_needed'), true);
  assert.equal(isTrackOverrideRemapReviewStatus('orphaned'), true);
  assert.equal(isTrackOverrideRemapReviewStatus('resolved'), false);
});

test('summarizeTrackOverrideRemapReview counts review-needed and missing track states', () => {
  const summary = summarizeTrackOverrideRemapReview([
    { remapStatus: 'resolved' },
    { remapStatus: 'review_needed' },
    { remapStatus: 'orphaned' },
  ]);

  assert.deepEqual(summary, {
    hasReview: true,
    orphanedCount: 1,
    reviewNeededCount: 1,
    totalReviewCount: 2,
  });
});

test('getTrackOverrideRemapReviewPresentation maps statuses to user-facing labels', () => {
  assert.deepEqual(getTrackOverrideRemapReviewPresentation('review_needed'), {
    description: 'Saved override may need remapping after metadata changed.',
    label: 'Needs review',
    tone: 'warning',
  });
  assert.deepEqual(getTrackOverrideRemapReviewPresentation('orphaned'), {
    description: 'Saved override no longer matches a current track.',
    label: 'No current track match',
    tone: 'danger',
  });
  assert.equal(getTrackOverrideRemapReviewPresentation('resolved'), null);
});

test('buildTrackOverrideRemapReviewSummaryText produces compact review copy', () => {
  assert.equal(
    buildTrackOverrideRemapReviewSummaryText({ orphanedCount: 0, reviewNeededCount: 1 }),
    '1 track override needs review',
  );
  assert.equal(
    buildTrackOverrideRemapReviewSummaryText({ orphanedCount: 2, reviewNeededCount: 0 }),
    '2 track overrides need a current track match',
  );
  assert.equal(
    buildTrackOverrideRemapReviewSummaryText({ orphanedCount: 1, reviewNeededCount: 1 }),
    '2 track overrides need review',
  );
});

test('getTrackOverrideRemapReviewSummaryTone escalates missing track matches', () => {
  assert.equal(getTrackOverrideRemapReviewSummaryTone({ reviewNeededCount: 1 }), 'warning');
  assert.equal(getTrackOverrideRemapReviewSummaryTone({ orphanedCount: 1, reviewNeededCount: 1 }), 'danger');
});
