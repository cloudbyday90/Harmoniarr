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
  TRUST_THRESHOLD_FIELDS,
  buildStateComparisonRows,
  formatRatePercent,
  formatReviewStateTone,
  formatSimulationHeadline,
  hasProjectedChanges,
} from '../../src/client/lib/source-user-trust-policy-presentation.js';

test('TRUST_THRESHOLD_FIELDS exposes count and rate controls', () => {
  const keys = TRUST_THRESHOLD_FIELDS.map((field) => field.key);
  assert.ok(keys.includes('watchFailureCount'));
  assert.ok(keys.includes('healthyMinSuccessRate'));
  const rateField = TRUST_THRESHOLD_FIELDS.find((field) => field.key === 'healthyMinSuccessRate');
  assert.equal(rateField.kind, 'rate');
});

test('formatReviewStateTone maps states to semantic tones', () => {
  assert.equal(formatReviewStateTone('excluded'), 'danger');
  assert.equal(formatReviewStateTone('watch'), 'warning');
  assert.equal(formatReviewStateTone('healthy'), 'success');
  assert.equal(formatReviewStateTone('mystery'), 'neutral');
});

test('formatRatePercent clamps and rounds', () => {
  assert.equal(formatRatePercent(0.8), '80%');
  assert.equal(formatRatePercent(1.5), '100%');
  assert.equal(formatRatePercent(-1), '0%');
  assert.equal(formatRatePercent('x'), '—');
});

test('buildStateComparisonRows merges current and projected states alphabetically', () => {
  const rows = buildStateComparisonRows({
    current: { healthy: 2, normal: 1 },
    projected: { healthy: 1, watch: 1, normal: 1 },
  });
  assert.deepEqual(rows.map((r) => r.state), ['healthy', 'normal', 'watch']);
  assert.equal(rows[0].current, 2);
  assert.equal(rows[0].projected, 1);
  assert.equal(rows[2].current, 0);
  assert.equal(rows[2].projected, 1);
});

test('hasProjectedChanges and formatSimulationHeadline reflect change counts', () => {
  assert.equal(hasProjectedChanges({ changedPeerCount: 0 }), false);
  assert.equal(hasProjectedChanges({ changedPeerCount: 3 }), true);
  assert.equal(formatSimulationHeadline({ evaluatedPeerCount: 0 }), 'No peers to evaluate.');
  assert.equal(formatSimulationHeadline({ evaluatedPeerCount: 10, changedPeerCount: 0 }), 'No reclassifications across 10 peers.');
  assert.equal(formatSimulationHeadline({ evaluatedPeerCount: 10, changedPeerCount: 1 }), '1 peer of 10 would be reclassified.');
});
