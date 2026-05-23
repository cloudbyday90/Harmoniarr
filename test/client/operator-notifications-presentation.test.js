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
  buildNotificationLink,
  formatNotificationCategoryLabel,
  getNotificationSeverityClass,
  getNotificationSeverityLabel,
} from '../../src/client/lib/operator-notifications-presentation.js';

// ── getNotificationSeverityClass ─────────────────────────────────────────────

describe('getNotificationSeverityClass', () => {
  it('returns failed for error', () => {
    assert.equal(getNotificationSeverityClass('error'), 'review-status-failed');
  });
  it('returns selected for success', () => {
    assert.equal(getNotificationSeverityClass('success'), 'review-status-selected');
  });
  it('returns held for warning', () => {
    assert.equal(getNotificationSeverityClass('warning'), 'review-status-held');
  });
  it('returns pending for unknown severity', () => {
    assert.equal(getNotificationSeverityClass('info'), 'review-status-pending');
  });
  it('returns pending for null', () => {
    assert.equal(getNotificationSeverityClass(null), 'review-status-pending');
  });
  it('returns pending for undefined', () => {
    assert.equal(getNotificationSeverityClass(undefined), 'review-status-pending');
  });
});

// ── getNotificationSeverityLabel ─────────────────────────────────────────────

describe('getNotificationSeverityLabel', () => {
  it('returns Failure for error', () => {
    assert.equal(getNotificationSeverityLabel('error'), 'Failure');
  });
  it('returns Recovered for success', () => {
    assert.equal(getNotificationSeverityLabel('success'), 'Recovered');
  });
  it('returns Needs review for warning', () => {
    assert.equal(getNotificationSeverityLabel('warning'), 'Needs review');
  });
  it('returns Queued for unknown severity', () => {
    assert.equal(getNotificationSeverityLabel('info'), 'Queued');
  });
  it('returns Queued for null', () => {
    assert.equal(getNotificationSeverityLabel(null), 'Queued');
  });
  it('returns Queued for undefined', () => {
    assert.equal(getNotificationSeverityLabel(undefined), 'Queued');
  });
});

// ── buildNotificationLink ─────────────────────────────────────────────────────

describe('buildNotificationLink', () => {
  it('returns operation run link for operation_run reference with runId', () => {
    const link = buildNotificationLink({
      reference: { type: 'operation_run', runId: 'run-abc-123' },
    });
    assert.deepEqual(link, {
      label: 'Open run detail',
      to: {
        hash: '#operation-run-detail-panel',
        name: 'activity-operations',
        query: { runId: 'run-abc-123' },
      },
    });
  });

  it('returns null for operation_run reference without runId', () => {
    const link = buildNotificationLink({
      reference: { type: 'operation_run', runId: null },
    });
    assert.equal(link, null);
  });

  it('returns dashboard link for heartbeat reference', () => {
    const link = buildNotificationLink({
      reference: { type: 'heartbeat' },
    });
    assert.deepEqual(link, {
      label: 'Open dashboard',
      to: {
        hash: '#library-discovery-panel',
        name: 'dashboard-panel',
      },
    });
  });

  it('returns null for unknown reference type', () => {
    const link = buildNotificationLink({
      reference: { type: 'audit', entityId: 'xyz' },
    });
    assert.equal(link, null);
  });

  it('returns null when reference is absent', () => {
    const link = buildNotificationLink({ title: 'No reference' });
    assert.equal(link, null);
  });

  it('returns null for null notification', () => {
    assert.equal(buildNotificationLink(null), null);
  });

  it('returns null for undefined notification', () => {
    assert.equal(buildNotificationLink(undefined), null);
  });
});

// ── formatNotificationCategoryLabel ──────────────────────────────────────────

describe('formatNotificationCategoryLabel', () => {
  it('replaces single underscore with space', () => {
    assert.equal(formatNotificationCategoryLabel('queued_work'), 'queued work');
  });
  it('replaces all underscores in multi-segment token', () => {
    assert.equal(formatNotificationCategoryLabel('manual_intervention'), 'manual intervention');
  });
  it('replaces hyphens with space', () => {
    assert.equal(formatNotificationCategoryLabel('auto-recovery'), 'auto recovery');
  });
  it('returns unknown for null', () => {
    assert.equal(formatNotificationCategoryLabel(null), 'unknown');
  });
  it('returns unknown for undefined', () => {
    assert.equal(formatNotificationCategoryLabel(undefined), 'unknown');
  });
  it('returns unknown for empty string', () => {
    assert.equal(formatNotificationCategoryLabel(''), 'unknown');
  });
  it('passes through a plain single word', () => {
    assert.equal(formatNotificationCategoryLabel('failure'), 'failure');
  });
});
