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
  classifyApplyOutcomeQuality,
  normalizeQualityWeight,
} from '../../src/server/activity/source-user-outcome-quality.js';

test('classifyApplyOutcomeQuality reports a clean full-quality success when every file applies', () => {
  const result = classifyApplyOutcomeQuality({
    status: 'applied',
    summary: { appliedFileCount: 10, failedFileCount: 0, totalFiles: 10 },
  });

  assert.deepEqual(result, {
    outcome: 'success',
    qualityWeight: 1,
    qualityLabel: 'clean',
    reason: null,
  });
});

test('classifyApplyOutcomeQuality weights a partial apply by completion ratio', () => {
  const result = classifyApplyOutcomeQuality({
    status: 'applied_with_warnings',
    summary: { appliedFileCount: 6, failedFileCount: 4, totalFiles: 10 },
  });

  assert.equal(result.outcome, 'success');
  assert.equal(result.qualityWeight, 0.6);
  assert.equal(result.qualityLabel, 'partial_apply');
  assert.match(result.reason, /6 of 10 files applied/);
});

test('classifyApplyOutcomeQuality applies a transcode penalty on a fully-applied-but-warned outcome', () => {
  const result = classifyApplyOutcomeQuality({
    status: 'applied_with_warnings',
    summary: {
      appliedFileCount: 10,
      failedFileCount: 0,
      totalFiles: 10,
      transcodePreflightFailedCount: 2,
    },
  });

  assert.equal(result.qualityWeight, 0.8);
  assert.equal(result.qualityLabel, 'transcode_warning');
});

test('classifyApplyOutcomeQuality never scores a degraded-but-applied outcome below the floor', () => {
  const result = classifyApplyOutcomeQuality({
    status: 'applied_with_warnings',
    summary: { appliedFileCount: 0, failedFileCount: 9, skippedFileCount: 1, totalFiles: 10 },
  });

  assert.equal(result.qualityWeight, 0.25);
});

test('classifyApplyOutcomeQuality infers totals when totalFiles is absent', () => {
  const result = classifyApplyOutcomeQuality({
    status: 'applied_with_warnings',
    summary: { appliedFileCount: 3, failedFileCount: 1 },
  });

  assert.equal(result.qualityWeight, 0.75);
});

test('normalizeQualityWeight clamps to the unit interval and defaults to 1', () => {
  assert.equal(normalizeQualityWeight(0.5), 0.5);
  assert.equal(normalizeQualityWeight(-2), 0);
  assert.equal(normalizeQualityWeight(5), 1);
  assert.equal(normalizeQualityWeight('nope'), 1);
  assert.equal(normalizeQualityWeight(undefined), 1);
});
