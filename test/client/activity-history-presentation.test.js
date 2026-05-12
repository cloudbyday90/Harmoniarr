/*
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatActivityEntryCountLabel,
  formatActivityEntryStatusLabel,
  formatActivityEntryStatusTone,
  formatActivityEntryTypeLabel,
} from '../../src/client/lib/activity-history-presentation.js';

// ---------------------------------------------------------------------------
// formatActivityEntryTypeLabel
// ---------------------------------------------------------------------------
describe('formatActivityEntryTypeLabel', () => {
  it('returns — for null', () => {
    assert.equal(formatActivityEntryTypeLabel(null), '—');
  });

  it('returns — for undefined', () => {
    assert.equal(formatActivityEntryTypeLabel(undefined), '—');
  });

  it('returns — for empty string', () => {
    assert.equal(formatActivityEntryTypeLabel(''), '—');
  });

  it('translates library_scan_completed', () => {
    assert.equal(formatActivityEntryTypeLabel('library_scan_completed'), 'Library scan completed');
  });

  it('translates library_scan_started', () => {
    assert.equal(formatActivityEntryTypeLabel('library_scan_started'), 'Library scan started');
  });

  it('translates library_scan_failed', () => {
    assert.equal(formatActivityEntryTypeLabel('library_scan_failed'), 'Library scan failed');
  });

  it('translates metadata_refresh_completed', () => {
    assert.equal(formatActivityEntryTypeLabel('metadata_refresh_completed'), 'Metadata refresh completed');
  });

  it('translates metadata_refresh_queued', () => {
    assert.equal(formatActivityEntryTypeLabel('metadata_refresh_queued'), 'Metadata refresh queued');
  });

  it('translates metadata_refresh_failed', () => {
    assert.equal(formatActivityEntryTypeLabel('metadata_refresh_failed'), 'Metadata refresh failed');
  });

  it('translates import_completed', () => {
    assert.equal(formatActivityEntryTypeLabel('import_completed'), 'Import completed');
  });

  it('translates wanted_reconciliation_completed', () => {
    assert.equal(formatActivityEntryTypeLabel('wanted_reconciliation_completed'), 'Wanted reconciliation completed');
  });

  it('translates user_login to user-friendly phrase', () => {
    assert.equal(formatActivityEntryTypeLabel('user_login'), 'User sign-in');
  });

  it('translates user_logout to user-friendly phrase', () => {
    assert.equal(formatActivityEntryTypeLabel('user_logout'), 'User sign-out');
  });

  it('translates system_startup', () => {
    assert.equal(formatActivityEntryTypeLabel('system_startup'), 'System started');
  });

  it('translates system_shutdown', () => {
    assert.equal(formatActivityEntryTypeLabel('system_shutdown'), 'System stopped');
  });

  it('does not return raw snake_case for known types', () => {
    const known = [
      'library_scan_completed', 'metadata_refresh_completed',
      'import_executed', 'wanted_reconciliation_completed',
    ];
    for (const type of known) {
      const label = formatActivityEntryTypeLabel(type);
      assert.doesNotMatch(label, /_/, `${type} → "${label}" still has underscore`);
    }
  });

  it('does not return all-lowercase for known types', () => {
    const label = formatActivityEntryTypeLabel('library_scan_completed');
    assert.match(label, /^[A-Z]/);
  });

  it('title-cases unknown snake_case types as fallback', () => {
    const result = formatActivityEntryTypeLabel('custom_event_happened');
    assert.doesNotMatch(result, /_/);
    assert.match(result, /^[A-Z]/);
    assert.equal(result, 'Custom Event Happened');
  });

  it('handles a single-word unknown type', () => {
    const result = formatActivityEntryTypeLabel('unknown');
    assert.equal(result, 'Unknown');
  });
});

// ---------------------------------------------------------------------------
// formatActivityEntryStatusLabel
// ---------------------------------------------------------------------------
describe('formatActivityEntryStatusLabel', () => {
  it('returns — for null', () => {
    assert.equal(formatActivityEntryStatusLabel(null), '—');
  });

  it('returns — for undefined', () => {
    assert.equal(formatActivityEntryStatusLabel(undefined), '—');
  });

  it('returns — for empty string', () => {
    assert.equal(formatActivityEntryStatusLabel(''), '—');
  });

  it('returns Succeeded for success', () => {
    assert.equal(formatActivityEntryStatusLabel('success'), 'Succeeded');
  });

  it('returns Succeeded for completed', () => {
    assert.equal(formatActivityEntryStatusLabel('completed'), 'Succeeded');
  });

  it('returns Succeeded for ok', () => {
    assert.equal(formatActivityEntryStatusLabel('ok'), 'Succeeded');
  });

  it('returns Failed for failed', () => {
    assert.equal(formatActivityEntryStatusLabel('failed'), 'Failed');
  });

  it('returns Failed for error', () => {
    assert.equal(formatActivityEntryStatusLabel('error'), 'Failed');
  });

  it('returns Cancelled for cancelled', () => {
    assert.equal(formatActivityEntryStatusLabel('cancelled'), 'Cancelled');
  });

  it('returns In progress for in_progress', () => {
    assert.equal(formatActivityEntryStatusLabel('in_progress'), 'In progress');
  });

  it('returns Pending for pending', () => {
    assert.equal(formatActivityEntryStatusLabel('pending'), 'Pending');
  });

  it('returns Skipped for skipped', () => {
    assert.equal(formatActivityEntryStatusLabel('skipped'), 'Skipped');
  });

  it('returns Warning for warning', () => {
    assert.equal(formatActivityEntryStatusLabel('warning'), 'Warning');
  });

  it('does not return in_progress with underscore for in_progress status', () => {
    assert.doesNotMatch(formatActivityEntryStatusLabel('in_progress'), /_/);
  });

  it('does not return ok as-is for ok status', () => {
    assert.notEqual(formatActivityEntryStatusLabel('ok'), 'ok');
  });

  it('title-cases unknown status as fallback', () => {
    const result = formatActivityEntryStatusLabel('new_state');
    assert.doesNotMatch(result, /_/);
    assert.match(result, /^[A-Z]/);
  });
});

// ---------------------------------------------------------------------------
// formatActivityEntryStatusTone
// ---------------------------------------------------------------------------
describe('formatActivityEntryStatusTone', () => {
  it('returns success for success', () => {
    assert.equal(formatActivityEntryStatusTone('success'), 'success');
  });

  it('returns success for completed', () => {
    assert.equal(formatActivityEntryStatusTone('completed'), 'success');
  });

  it('returns success for ok', () => {
    assert.equal(formatActivityEntryStatusTone('ok'), 'success');
  });

  it('returns danger for failed', () => {
    assert.equal(formatActivityEntryStatusTone('failed'), 'danger');
  });

  it('returns danger for error', () => {
    assert.equal(formatActivityEntryStatusTone('error'), 'danger');
  });

  it('returns danger for cancelled', () => {
    assert.equal(formatActivityEntryStatusTone('cancelled'), 'danger');
  });

  it('returns warning for in_progress', () => {
    assert.equal(formatActivityEntryStatusTone('in_progress'), 'warning');
  });

  it('returns warning for pending', () => {
    assert.equal(formatActivityEntryStatusTone('pending'), 'warning');
  });

  it('returns warning for warning', () => {
    assert.equal(formatActivityEntryStatusTone('warning'), 'warning');
  });

  it('returns info for null', () => {
    assert.equal(formatActivityEntryStatusTone(null), 'info');
  });

  it('returns info for unknown status', () => {
    assert.equal(formatActivityEntryStatusTone('skipped'), 'info');
  });

  it('returns info for empty string', () => {
    assert.equal(formatActivityEntryStatusTone(''), 'info');
  });

  it('never returns success for failed status', () => {
    assert.notEqual(formatActivityEntryStatusTone('failed'), 'success');
  });

  it('never returns danger for success status', () => {
    assert.notEqual(formatActivityEntryStatusTone('success'), 'danger');
  });
});

// ---------------------------------------------------------------------------
// formatActivityEntryCountLabel
// ---------------------------------------------------------------------------
describe('formatActivityEntryCountLabel', () => {
  it('returns singular for 1', () => {
    assert.equal(formatActivityEntryCountLabel(1), '1 entry');
  });

  it('returns plural for 0', () => {
    assert.equal(formatActivityEntryCountLabel(0), '0 entries');
  });

  it('returns plural for 2', () => {
    assert.equal(formatActivityEntryCountLabel(2), '2 entries');
  });

  it('returns plural for 100', () => {
    assert.equal(formatActivityEntryCountLabel(100), '100 entries');
  });

  it('includes the count in the label', () => {
    const result = formatActivityEntryCountLabel(42);
    assert.match(result, /42/);
  });

  it('does not use entry for plural count', () => {
    assert.doesNotMatch(formatActivityEntryCountLabel(5), /\bentry\b/);
  });
});
