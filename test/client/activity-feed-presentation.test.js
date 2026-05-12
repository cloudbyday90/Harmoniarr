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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatActivityFeedEntryTypeLabel,
  getActivityFeedStatusClass,
  getActivityFeedStatusLabel,
} from '../../src/client/lib/activity-feed-presentation.js';

describe('getActivityFeedStatusClass', () => {
  it('returns selected for success', () => {
    assert.equal(getActivityFeedStatusClass('success'), 'review-status-selected');
  });
  it('returns failed for error', () => {
    assert.equal(getActivityFeedStatusClass('error'), 'review-status-failed');
  });
  it('returns held for active', () => {
    assert.equal(getActivityFeedStatusClass('active'), 'review-status-held');
  });
  it('returns empty string for unknown status', () => {
    assert.equal(getActivityFeedStatusClass('unknown'), '');
  });
  it('returns empty string for null', () => {
    assert.equal(getActivityFeedStatusClass(null), '');
  });
  it('returns empty string for undefined', () => {
    assert.equal(getActivityFeedStatusClass(undefined), '');
  });
});

describe('getActivityFeedStatusLabel', () => {
  it('returns Completed for success', () => {
    assert.equal(getActivityFeedStatusLabel('success'), 'Completed');
  });
  it('returns Attention for error', () => {
    assert.equal(getActivityFeedStatusLabel('error'), 'Attention');
  });
  it('returns Active for active', () => {
    assert.equal(getActivityFeedStatusLabel('active'), 'Active');
  });
  it('returns Recorded for unknown status', () => {
    assert.equal(getActivityFeedStatusLabel('unknown'), 'Recorded');
  });
  it('returns Recorded for null', () => {
    assert.equal(getActivityFeedStatusLabel(null), 'Recorded');
  });
  it('returns Recorded for undefined', () => {
    assert.equal(getActivityFeedStatusLabel(undefined), 'Recorded');
  });
});

// ── formatActivityFeedEntryTypeLabel ─────────────────────────────────────────

describe('formatActivityFeedEntryTypeLabel', () => {
  it('replaces all underscores with spaces in multi-segment type', () => {
    assert.equal(formatActivityFeedEntryTypeLabel('library_scan_completed'), 'library scan completed');
  });
  it('replaces single underscore with space', () => {
    assert.equal(formatActivityFeedEntryTypeLabel('operation'), 'operation');
  });
  it('replaces hyphens with spaces', () => {
    assert.equal(formatActivityFeedEntryTypeLabel('audit-event'), 'audit event');
  });
  it('returns unknown for null', () => {
    assert.equal(formatActivityFeedEntryTypeLabel(null), 'unknown');
  });
  it('returns unknown for undefined', () => {
    assert.equal(formatActivityFeedEntryTypeLabel(undefined), 'unknown');
  });
  it('returns unknown for empty string', () => {
    assert.equal(formatActivityFeedEntryTypeLabel(''), 'unknown');
  });
  it('passes through a plain word unchanged', () => {
    assert.equal(formatActivityFeedEntryTypeLabel('audit'), 'audit');
  });
});
