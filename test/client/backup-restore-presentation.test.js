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
  checkStatusClass,
  checkStatusLabel,
  describeRestoreReadiness,
  formatBytes,
  formatScope,
  formatTimestamp,
} from '../../src/client/lib/backup-restore-presentation.js';

// ---------------------------------------------------------------------------
// formatTimestamp
// ---------------------------------------------------------------------------

test('formatTimestamp returns fallback for null', () => {
  assert.equal(formatTimestamp(null), 'Not yet recorded');
});

test('formatTimestamp returns fallback for undefined', () => {
  assert.equal(formatTimestamp(undefined), 'Not yet recorded');
});

test('formatTimestamp returns fallback for empty string', () => {
  assert.equal(formatTimestamp(''), 'Not yet recorded');
});

test('formatTimestamp passes through unparseable strings unchanged', () => {
  const result = formatTimestamp('not-a-date');
  assert.equal(result, 'not-a-date');
});

test('formatTimestamp returns a non-empty locale string for a valid ISO timestamp', () => {
  const result = formatTimestamp('2026-01-15T10:30:00.000Z');
  assert.ok(typeof result === 'string' && result.length > 0);
  assert.notEqual(result, 'Not yet recorded');
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

test('formatBytes returns 0 B for null', () => {
  assert.equal(formatBytes(null), '0 B');
});

test('formatBytes returns 0 B for 0', () => {
  assert.equal(formatBytes(0), '0 B');
});

test('formatBytes returns 0 B for negative values', () => {
  assert.equal(formatBytes(-100), '0 B');
});

test('formatBytes formats bytes below 1 KB', () => {
  assert.equal(formatBytes(512), '512 B');
});

test('formatBytes formats exactly 1023 bytes as B', () => {
  assert.equal(formatBytes(1023), '1023 B');
});

test('formatBytes formats 1024 bytes as 1.0 KB', () => {
  assert.equal(formatBytes(1024), '1.0 KB');
});

test('formatBytes formats 1.5 KB with one decimal', () => {
  assert.equal(formatBytes(1024 * 1.5), '1.5 KB');
});

test('formatBytes formats 10 KB without decimal', () => {
  assert.equal(formatBytes(1024 * 10), '10 KB');
});

test('formatBytes formats 1 MB', () => {
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('formatBytes formats 1 GB', () => {
  assert.equal(formatBytes(1024 * 1024 * 1024), '1.0 GB');
});

// ---------------------------------------------------------------------------
// formatScope
// ---------------------------------------------------------------------------

test('formatScope returns Unknown for null', () => {
  assert.equal(formatScope(null), 'Unknown');
});

test('formatScope returns Unknown for empty string', () => {
  assert.equal(formatScope(''), 'Unknown');
});

test('formatScope converts camelCase to title case words', () => {
  assert.equal(formatScope('fullBackup'), 'Full Backup');
});

test('formatScope converts snake_case to title case words', () => {
  assert.equal(formatScope('library_data'), 'Library Data');
});

test('formatScope converts mixed camelCase with numbers', () => {
  assert.equal(formatScope('schemaV2'), 'Schema V2');
});

test('formatScope handles already-uppercase single word', () => {
  assert.equal(formatScope('running'), 'Running');
});

// ---------------------------------------------------------------------------
// checkStatusClass
// ---------------------------------------------------------------------------

test('checkStatusClass returns selected class for passed', () => {
  assert.equal(checkStatusClass('passed'), 'review-status-selected');
});

test('checkStatusClass returns failed class for any other value', () => {
  assert.equal(checkStatusClass('failed'), 'review-status-failed');
  assert.equal(checkStatusClass(null), 'review-status-failed');
  assert.equal(checkStatusClass('unknown'), 'review-status-failed');
});

// ---------------------------------------------------------------------------
// checkStatusLabel
// ---------------------------------------------------------------------------

test('checkStatusLabel returns Passed for passed', () => {
  assert.equal(checkStatusLabel('passed'), 'Passed');
});

test('checkStatusLabel returns Failed for any other value', () => {
  assert.equal(checkStatusLabel('failed'), 'Failed');
  assert.equal(checkStatusLabel(null), 'Failed');
});

// ---------------------------------------------------------------------------
// describeRestoreReadiness
// ---------------------------------------------------------------------------

test('describeRestoreReadiness returns prompt when no preview', () => {
  assert.equal(
    describeRestoreReadiness(null),
    'Select a backup to check whether it is safe to restore.',
  );
});

test('describeRestoreReadiness returns ready message when canApplyRestore is true', () => {
  assert.equal(
    describeRestoreReadiness({ canApplyRestore: true }),
    'This backup passed all checks and can be applied.',
  );
});

test('describeRestoreReadiness returns busy message when blocked by lock', () => {
  const result = describeRestoreReadiness({
    canApplyRestore: false,
    restoreReadiness: { blockedByLock: true },
  });
  assert.ok(result.includes('busy'), 'should mention the app is busy');
  assert.ok(result.includes('Refresh checks'), 'should mention refresh action');
});

test('describeRestoreReadiness returns review message when checks fail without lock', () => {
  assert.equal(
    describeRestoreReadiness({ canApplyRestore: false, restoreReadiness: { blockedByLock: false } }),
    'Review the failed checks below before applying this backup.',
  );
});

test('describeRestoreReadiness returns review message when restoreReadiness is absent', () => {
  assert.equal(
    describeRestoreReadiness({ canApplyRestore: false }),
    'Review the failed checks below before applying this backup.',
  );
});
