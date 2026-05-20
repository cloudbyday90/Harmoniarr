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
  buildDiscoveryResultSummaryMessage,
  buildOrganizeResultSummaryMessage,
  buildScanResultSummaryMessage,
  formatFileOperationStatusLabel,
  formatFileOperationStatusTone,
  formatOperationOutcomeLabel,
  formatOperationOutcomeTone,
  formatResultBreakdownSummary,
} from '../../src/server/operation-result-presentation-service.js';

suite('operation-result-presentation-service', () => {
  suite('formatFileOperationStatusLabel', () => {
    test('returns Applied for applied status', () => {
      assert.equal(formatFileOperationStatusLabel('applied'), 'Applied');
    });

    test('returns Applied for moved status', () => {
      assert.equal(formatFileOperationStatusLabel('moved'), 'Applied');
    });

    test('returns Failed for failed status', () => {
      assert.equal(formatFileOperationStatusLabel('failed'), 'Failed');
    });

    test('returns Not attempted for not_attempted status', () => {
      assert.equal(formatFileOperationStatusLabel('not_attempted'), 'Not attempted');
    });

    test('returns Pending for pending status', () => {
      assert.equal(formatFileOperationStatusLabel('pending'), 'Pending');
    });

    test('returns Skipped for skipped status', () => {
      assert.equal(formatFileOperationStatusLabel('skipped'), 'Skipped');
    });

    test('returns the raw status for unknown values', () => {
      assert.equal(formatFileOperationStatusLabel('custom_status'), 'custom_status');
    });

    test('returns empty string for null', () => {
      assert.equal(formatFileOperationStatusLabel(null), '');
    });
  });

  suite('formatFileOperationStatusTone', () => {
    test('returns success for applied', () => {
      assert.equal(formatFileOperationStatusTone('applied'), 'success');
    });

    test('returns success for moved', () => {
      assert.equal(formatFileOperationStatusTone('moved'), 'success');
    });

    test('returns danger for failed', () => {
      assert.equal(formatFileOperationStatusTone('failed'), 'danger');
    });

    test('returns muted for skipped', () => {
      assert.equal(formatFileOperationStatusTone('skipped'), 'muted');
    });

    test('returns muted for unknown', () => {
      assert.equal(formatFileOperationStatusTone('unknown'), 'muted');
    });
  });

  suite('formatOperationOutcomeLabel', () => {
    test('returns correct label for each outcome', () => {
      assert.equal(formatOperationOutcomeLabel('completed'), 'All items processed successfully');
      assert.equal(formatOperationOutcomeLabel('empty'), 'No items to process');
      assert.equal(formatOperationOutcomeLabel('failed'), 'All items failed');
      assert.equal(formatOperationOutcomeLabel('partial'), 'Some items failed');
    });

    test('returns raw value for unknown outcome', () => {
      assert.equal(formatOperationOutcomeLabel('custom'), 'custom');
    });

    test('returns empty string for null', () => {
      assert.equal(formatOperationOutcomeLabel(null), '');
    });
  });

  suite('formatOperationOutcomeTone', () => {
    test('returns correct tone for each outcome', () => {
      assert.equal(formatOperationOutcomeTone('completed'), 'success');
      assert.equal(formatOperationOutcomeTone('empty'), 'muted');
      assert.equal(formatOperationOutcomeTone('failed'), 'danger');
      assert.equal(formatOperationOutcomeTone('partial'), 'warning');
    });
  });

  suite('formatResultBreakdownSummary', () => {
    test('returns no-items message for empty breakdown', () => {
      assert.equal(formatResultBreakdownSummary(null), 'No items to process.');
      assert.equal(formatResultBreakdownSummary({ totalItems: 0 }), 'No items to process.');
    });

    test('returns simple success message when all succeeded', () => {
      assert.equal(
        formatResultBreakdownSummary({ failedCount: 0, succeededCount: 10, totalItems: 10 }),
        '10 of 10 succeeded.',
      );
    });

    test('includes failures in summary', () => {
      assert.equal(
        formatResultBreakdownSummary({ failedCount: 2, succeededCount: 8, totalItems: 10 }),
        '8 of 10 succeeded, 2 failed.',
      );
    });

    test('includes all non-zero categories', () => {
      assert.equal(
        formatResultBreakdownSummary({
          failedCount: 1,
          notAttemptedCount: 2,
          skippedCount: 3,
          succeededCount: 4,
          totalItems: 10,
        }),
        '4 of 10 succeeded, 1 failed, 3 skipped, 2 not attempted.',
      );
    });
  });

  suite('buildOrganizeResultSummaryMessage', () => {
    test('returns no-run message for null summary', () => {
      assert.equal(buildOrganizeResultSummaryMessage(null), 'No organize run recorded.');
    });

    test('returns partial message', () => {
      assert.equal(
        buildOrganizeResultSummaryMessage({
          failedCount: 2,
          movedCount: 3,
          notAttemptedCount: 1,
          outcome: 'partial',
          plannedRenameCount: 6,
        }),
        'Organized 3 of 6 files. 2 failed, 1 not attempted.',
      );
    });

    test('returns completed message', () => {
      assert.equal(
        buildOrganizeResultSummaryMessage({ movedCount: 5, outcome: 'completed', skippedCount: 2 }),
        'Successfully organized 5 files. 2 skipped.',
      );
    });

    test('returns singular completed message', () => {
      assert.equal(
        buildOrganizeResultSummaryMessage({ movedCount: 1, outcome: 'completed', skippedCount: 0 }),
        'Successfully organized 1 file. 0 skipped.',
      );
    });

    test('returns failed message', () => {
      assert.equal(
        buildOrganizeResultSummaryMessage({ outcome: 'failed', plannedRenameCount: 4 }),
        'All 4 organize renames failed.',
      );
    });

    test('returns empty message', () => {
      assert.equal(
        buildOrganizeResultSummaryMessage({ outcome: 'empty' }),
        'No files to organize.',
      );
    });
  });

  suite('buildScanResultSummaryMessage', () => {
    test('returns no-run message for null summary', () => {
      assert.equal(buildScanResultSummaryMessage(null), 'No scan run recorded.');
    });

    test('returns no-files message', () => {
      assert.equal(
        buildScanResultSummaryMessage({ filesSeen: 0, libraryRoot: '/music' }),
        'No files found in /music.',
      );
    });

    test('returns summary with file counts', () => {
      assert.equal(
        buildScanResultSummaryMessage({ filesMatched: 8, filesSeen: 10, filesUnmatched: 2, libraryRoot: '/music' }),
        'Found 10 files in /music: 8 audio, 2 other.',
      );
    });

    test('returns summary without root when not provided', () => {
      assert.equal(
        buildScanResultSummaryMessage({ filesMatched: 5, filesSeen: 5, filesUnmatched: 0 }),
        'Found 5 files: 5 audio, 0 other.',
      );
    });
  });

  suite('buildDiscoveryResultSummaryMessage', () => {
    test('returns no-run message for null summary', () => {
      assert.equal(buildDiscoveryResultSummaryMessage(null), 'No discovery run recorded.');
    });

    test('returns no-requests message', () => {
      assert.equal(
        buildDiscoveryResultSummaryMessage({ attemptedCount: 0 }),
        'No discovery requests to dispatch.',
      );
    });

    test('returns success message', () => {
      assert.equal(
        buildDiscoveryResultSummaryMessage({ attemptedCount: 3, candidateCount: 15, dispatchedCount: 3, failedCount: 0 }),
        'Dispatched 3 searches. Found 15 candidates.',
      );
    });

    test('returns singular success message', () => {
      assert.equal(
        buildDiscoveryResultSummaryMessage({ attemptedCount: 1, candidateCount: 2, dispatchedCount: 1, failedCount: 0 }),
        'Dispatched 1 search. Found 2 candidates.',
      );
    });

    test('returns partial failure message', () => {
      assert.equal(
        buildDiscoveryResultSummaryMessage({ attemptedCount: 5, candidateCount: 10, dispatchedCount: 3, failedCount: 2 }),
        'Dispatched 3 of 5 searches (2 failed). Found 10 candidates.',
      );
    });
  });
});
