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
  DEFAULT_TRUST_THRESHOLDS,
  classifyReviewState,
  simulateTrustThresholdPolicy,
} from '../../src/server/activity/source-user-trust-threshold-simulator.js';

test('classifyReviewState keeps operator overrides sticky', () => {
  assert.equal(classifyReviewState({ trustState: 'blocked', successCount: 100, failureCount: 0 }), 'excluded');
  assert.equal(classifyReviewState({ trustState: 'trusted', successCount: 0, failureCount: 100 }), 'preferred');
});

test('classifyReviewState returns unknown with no evidence', () => {
  assert.equal(classifyReviewState({ trustState: 'neutral', successCount: 0, failureCount: 0 }), 'unknown');
});

test('classifyReviewState flags watch on failure-heavy peers', () => {
  const state = classifyReviewState(
    { trustState: 'neutral', successCount: 1, failureCount: 5 },
    DEFAULT_TRUST_THRESHOLDS,
  );
  assert.equal(state, 'watch');
});

test('classifyReviewState marks healthy peers with strong evidence', () => {
  const state = classifyReviewState(
    { trustState: 'neutral', successCount: 9, failureCount: 1 },
    DEFAULT_TRUST_THRESHOLDS,
  );
  assert.equal(state, 'healthy');
});

test('simulateTrustThresholdPolicy projects reclassification deltas and transitions', () => {
  const peers = [
    { username: 'healthy-peer', successCount: 9, failureCount: 1, trustState: 'neutral' },
    { username: 'edge-peer', successCount: 8, failureCount: 2, trustState: 'neutral' },
  ];

  // Raise the healthy success-rate bar so edge-peer (80%) drops out of healthy.
  const result = simulateTrustThresholdPolicy({
    peers,
    thresholds: { healthyMinSuccessRate: 0.85 },
  });

  assert.equal(result.evaluatedPeerCount, 2);
  assert.equal(result.changedPeerCount, 1);
  assert.equal(result.summary.current.healthy, 2);
  assert.equal(result.summary.projected.healthy, 1);
  assert.equal(result.transitions.length, 1);
  assert.equal(result.transitions[0].from, 'healthy');
  assert.equal(result.transitions[0].to, 'normal');
  assert.equal(result.transitions[0].count, 1);
});

test('simulateTrustThresholdPolicy reports no change when thresholds match defaults', () => {
  const peers = [{ username: 'p', successCount: 9, failureCount: 1, trustState: 'neutral' }];
  const result = simulateTrustThresholdPolicy({ peers, thresholds: {} });
  assert.equal(result.changedPeerCount, 0);
  assert.equal(result.transitions.length, 0);
});
