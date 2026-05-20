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
import { suite, test } from 'node:test';
import {
  buildFileOperationResult,
  buildOperationResultBreakdown,
  buildOperationResultSummary,
  classifyOperationOutcome,
} from '../../src/server/operation-result-detail-service.js';

suite('operation-result-detail-service', () => {
  suite('buildFileOperationResult', () => {
    test('returns a result with the provided status and defaults for other fields', () => {
      const result = buildFileOperationResult({ status: 'moved' });

      assert.equal(result.status, 'moved');
      assert.equal(result.destinationPath, null);
      assert.equal(result.sourcePath, null);
      assert.equal(result.fileId, null);
      assert.equal(result.filename, null);
      assert.equal(result.errorMessage, null);
      assert.equal(result.transport, null);
      assert.equal(result.verification, null);
      assert.deepEqual(result.steps, []);
    });

    test('preserves all provided fields', () => {
      const result = buildFileOperationResult({
        destinationPath: '/library/artist/album/track.flac',
        errorMessage: null,
        fileId: 'abc-123',
        filename: 'track.flac',
        sourcePath: '/library/artist/album/old-name.flac',
        status: 'moved',
        steps: [{ stepType: 'rename', status: 'applied' }],
        transport: 'rename',
        verification: { destinationExists: true },
      });

      assert.equal(result.destinationPath, '/library/artist/album/track.flac');
      assert.equal(result.fileId, 'abc-123');
      assert.equal(result.filename, 'track.flac');
      assert.equal(result.sourcePath, '/library/artist/album/old-name.flac');
      assert.equal(result.status, 'moved');
      assert.equal(result.transport, 'rename');
      assert.deepEqual(result.steps, [{ stepType: 'rename', status: 'applied' }]);
      assert.deepEqual(result.verification, { destinationExists: true });
    });
  });

  suite('buildOperationResultSummary', () => {
    test('returns zeroed counters by default', () => {
      const summary = buildOperationResultSummary();

      assert.equal(summary.totalItems, 0);
      assert.equal(summary.succeededCount, 0);
      assert.equal(summary.failedCount, 0);
      assert.equal(summary.skippedCount, 0);
      assert.equal(summary.notAttemptedCount, 0);
    });

    test('returns provided counts', () => {
      const summary = buildOperationResultSummary({
        failedCount: 2,
        notAttemptedCount: 3,
        skippedCount: 1,
        succeededCount: 5,
        totalItems: 11,
      });

      assert.equal(summary.totalItems, 11);
      assert.equal(summary.succeededCount, 5);
      assert.equal(summary.failedCount, 2);
      assert.equal(summary.skippedCount, 1);
      assert.equal(summary.notAttemptedCount, 3);
    });
  });

  suite('classifyOperationOutcome', () => {
    test('returns empty when totalItems is 0', () => {
      assert.equal(classifyOperationOutcome({ totalItems: 0 }), 'empty');
    });

    test('returns completed when all items succeeded', () => {
      assert.equal(classifyOperationOutcome({ succeededCount: 10, totalItems: 10 }), 'completed');
    });

    test('returns failed when zero items succeeded', () => {
      assert.equal(classifyOperationOutcome({ failedCount: 5, succeededCount: 0, totalItems: 5 }), 'failed');
    });

    test('returns partial when some items succeeded and some failed', () => {
      assert.equal(classifyOperationOutcome({ failedCount: 3, succeededCount: 7, totalItems: 10 }), 'partial');
    });

    test('returns partial when 1 of 2 succeeded', () => {
      assert.equal(classifyOperationOutcome({ failedCount: 1, succeededCount: 1, totalItems: 2 }), 'partial');
    });
  });

  suite('buildOperationResultBreakdown', () => {
    test('returns empty breakdown for empty input', () => {
      const breakdown = buildOperationResultBreakdown([]);

      assert.equal(breakdown.totalItems, 0);
      assert.equal(breakdown.outcome, 'empty');
      assert.equal(breakdown.succeededCount, 0);
      assert.equal(breakdown.failedCount, 0);
    });

    test('counts applied files as succeeded', () => {
      const breakdown = buildOperationResultBreakdown([
        { status: 'applied' },
        { status: 'applied' },
      ]);

      assert.equal(breakdown.succeededCount, 2);
      assert.equal(breakdown.outcome, 'completed');
    });

    test('counts moved files as succeeded', () => {
      const breakdown = buildOperationResultBreakdown([
        { status: 'moved' },
      ]);

      assert.equal(breakdown.succeededCount, 1);
      assert.equal(breakdown.outcome, 'completed');
    });

    test('counts failed files', () => {
      const breakdown = buildOperationResultBreakdown([
        { status: 'applied' },
        { status: 'failed' },
        { status: 'not_attempted' },
        { status: 'skipped' },
      ]);

      assert.equal(breakdown.succeededCount, 1);
      assert.equal(breakdown.failedCount, 1);
      assert.equal(breakdown.notAttemptedCount, 1);
      assert.equal(breakdown.skippedCount, 1);
      assert.equal(breakdown.totalItems, 4);
    });

    test('classifies partial outcome correctly', () => {
      const breakdown = buildOperationResultBreakdown([
        { status: 'moved' },
        { status: 'moved' },
        { status: 'failed' },
      ]);

      assert.equal(breakdown.outcome, 'partial');
      assert.equal(breakdown.succeededCount, 2);
      assert.equal(breakdown.failedCount, 1);
    });

    test('excludes skipped and not_attempted from outcome classification denominator', () => {
      const breakdown = buildOperationResultBreakdown([
        { status: 'moved' },
        { status: 'skipped' },
        { status: 'not_attempted' },
      ]);

      assert.equal(breakdown.outcome, 'completed');
    });
  });
});
