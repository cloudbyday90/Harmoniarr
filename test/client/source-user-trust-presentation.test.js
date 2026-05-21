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
  canPromoteSourceUserTrust,
  canResetSourceUserTrust,
  filterSourceUsers,
  formatSourceUserHistoryActor,
  formatSourceUserHistoryKind,
  formatSourceUserHistorySummary,
  formatSourceUserHistoryTone,
  formatSourceUserConfidence,
  formatSourceUserCountLabel,
  formatSourceUserEvidence,
  formatSourceUserReliabilityLabel,
  formatSourceUserReliabilityTone,
  formatSourceUserReviewLabel,
  formatSourceUserReviewTone,
  sourceUserTrustStateOptions,
  formatSourceUserTrustLabel,
  formatSourceUserTrustTone,
} from '../../src/client/lib/source-user-trust-presentation.js';

test('formatSourceUserCountLabel returns a human-readable label', () => {
  assert.equal(formatSourceUserCountLabel(0), 'No source users');
  assert.equal(formatSourceUserCountLabel(1), '1 source user');
  assert.equal(formatSourceUserCountLabel(2), '2 source users');
});

test('trust and review labels map to explicit tones', () => {
  assert.equal(formatSourceUserTrustLabel('blocked'), 'Blocked');
  assert.equal(formatSourceUserTrustTone('blocked'), 'danger');
  assert.equal(formatSourceUserTrustLabel('trusted'), 'Trusted');
  assert.equal(formatSourceUserTrustTone('trusted'), 'success');
  assert.equal(formatSourceUserReviewLabel('watch'), 'Needs review');
  assert.equal(formatSourceUserReviewTone('watch'), 'warning');
});

test('reliability helpers expose explainable evidence labels', () => {
  assert.equal(formatSourceUserReliabilityLabel('strong'), 'Strong');
  assert.equal(formatSourceUserReliabilityTone('strong'), 'success');
  assert.equal(
    formatSourceUserEvidence({ evidenceCount: 4, failureCount: 1, successCount: 3, successRatePercent: 75 }),
    '3 ok / 1 failed (75% success)',
  );
  assert.equal(formatSourceUserConfidence({ confidence: 'medium' }), 'Medium confidence');
});

test('formatSourceUserEvidence handles missing evidence', () => {
  assert.equal(formatSourceUserEvidence({ evidenceCount: 0 }), 'No delivery evidence');
  assert.equal(formatSourceUserConfidence({ confidence: 'none' }), 'No evidence');
});

test('filterSourceUsers filters by state and search text', () => {
  const entries = [
    {
      operatorNotes: 'Needs more verification',
      reputation: { reliability: 'mixed' },
      review: { reason: '3 failures across 4 attempts.', state: 'watch' },
      trustState: 'neutral',
      username: 'peer-watch',
    },
    {
      blockReason: 'Fake FLAC labels',
      reputation: { reliability: 'poor' },
      review: { reason: 'Blocked by operator', state: 'excluded' },
      trustState: 'blocked',
      username: 'peer-blocked',
    },
  ];

  assert.equal(filterSourceUsers(entries, { filter: 'watch' }).length, 1);
  assert.equal(filterSourceUsers(entries, { filter: 'blocked' }).length, 1);
  assert.equal(filterSourceUsers(entries, { query: 'verification' }).length, 1);
  assert.equal(filterSourceUsers(entries, { query: 'fake' }).length, 1);
});

test('source user trust state options remain explicit and ordered', () => {
  assert.deepEqual(sourceUserTrustStateOptions.map((option) => option.value), ['trusted', 'neutral']);
});

test('history helpers format provenance entries for manual overrides and evidence', () => {
  assert.equal(formatSourceUserHistoryKind('manual_override'), 'Manual override');
  assert.equal(formatSourceUserHistoryTone({ kind: 'manual_override', trustState: 'trusted' }), 'success');
  assert.equal(formatSourceUserHistorySummary({ kind: 'manual_override', trustState: 'trusted', reason: 'Verified complete releases' }), 'Verified complete releases');
  assert.equal(formatSourceUserHistoryTone({ kind: 'delivery_evidence', outcome: 'failure' }), 'danger');
  assert.equal(formatSourceUserHistorySummary({ kind: 'delivery_evidence', outcome: 'failure', reason: 'Import candidate download failed' }), 'Import candidate download failed');
  assert.equal(formatSourceUserHistoryActor({ actorUserId: 'admin-1' }), 'admin-1');
  assert.equal(formatSourceUserHistoryActor({ actorUserId: null }), 'System');
});

test('trust action guards only allow non-blocked peers to be adjusted inline', () => {
  assert.equal(canPromoteSourceUserTrust({ trustState: 'neutral' }), true);
  assert.equal(canPromoteSourceUserTrust({ trustState: 'trusted' }), false);
  assert.equal(canPromoteSourceUserTrust({ trustState: 'blocked' }), false);
  assert.equal(canResetSourceUserTrust({ trustState: 'trusted' }), true);
  assert.equal(canResetSourceUserTrust({ trustState: 'neutral' }), false);
  assert.equal(canResetSourceUserTrust({ trustState: 'blocked' }), false);
});
