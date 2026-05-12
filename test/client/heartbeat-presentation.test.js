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
import { describe, it } from 'node:test';
import {
  buildShellHeartbeatDetail,
  buildShellHeartbeatStatusLabel,
  formatHeartbeatStatus,
  getHeartbeatStatusClass,
  selectWorstDependencyStatus,
} from '../../src/client/lib/heartbeat-presentation.js';

// ---------------------------------------------------------------------------
// formatHeartbeatStatus
// ---------------------------------------------------------------------------

describe('formatHeartbeatStatus', () => {
  it('returns "Active" for "active"', () => {
    assert.equal(formatHeartbeatStatus('active'), 'Active');
  });

  it('returns "Error" for "error"', () => {
    assert.equal(formatHeartbeatStatus('error'), 'Error');
  });

  it('returns "Idle" for "idle"', () => {
    assert.equal(formatHeartbeatStatus('idle'), 'Idle');
  });

  it('returns "Paused" for "paused"', () => {
    assert.equal(formatHeartbeatStatus('paused'), 'Paused');
  });

  it('returns "Running" for "running"', () => {
    assert.equal(formatHeartbeatStatus('running'), 'Running');
  });

  it('returns "Waiting" for unknown value', () => {
    assert.equal(formatHeartbeatStatus('unknown_state'), 'Waiting');
  });

  it('returns "Waiting" for null', () => {
    assert.equal(formatHeartbeatStatus(null), 'Waiting');
  });

  it('returns "Waiting" for undefined', () => {
    assert.equal(formatHeartbeatStatus(undefined), 'Waiting');
  });
});

// ---------------------------------------------------------------------------
// getHeartbeatStatusClass
// ---------------------------------------------------------------------------

describe('getHeartbeatStatusClass', () => {
  it('returns failed class for "error"', () => {
    assert.equal(getHeartbeatStatusClass('error'), 'review-status-failed');
  });

  it('returns selected class for "running"', () => {
    assert.equal(getHeartbeatStatusClass('running'), 'review-status-selected');
  });

  it('returns selected class for "idle"', () => {
    assert.equal(getHeartbeatStatusClass('idle'), 'review-status-selected');
  });

  it('returns held class for "active"', () => {
    assert.equal(getHeartbeatStatusClass('active'), 'review-status-held');
  });

  it('returns held class for "paused"', () => {
    assert.equal(getHeartbeatStatusClass('paused'), 'review-status-held');
  });

  it('returns held class for unknown value', () => {
    assert.equal(getHeartbeatStatusClass('unknown'), 'review-status-held');
  });

  it('returns held class for null', () => {
    assert.equal(getHeartbeatStatusClass(null), 'review-status-held');
  });
});

// ---------------------------------------------------------------------------
// selectWorstDependencyStatus
// ---------------------------------------------------------------------------

describe('selectWorstDependencyStatus', () => {
  it('returns unknown for empty statuses', () => {
    assert.equal(selectWorstDependencyStatus([]), 'unknown');
  });
  it('returns healthy when only healthy present', () => {
    assert.equal(selectWorstDependencyStatus(['healthy']), 'healthy');
  });
  it('returns unavailable when unavailable is present', () => {
    assert.equal(selectWorstDependencyStatus(['healthy', 'unavailable']), 'unavailable');
  });
  it('returns unavailable when error is present', () => {
    assert.equal(selectWorstDependencyStatus(['healthy', 'error']), 'unavailable');
  });
  it('returns degraded when degraded is present', () => {
    assert.equal(selectWorstDependencyStatus(['healthy', 'degraded']), 'degraded');
  });
  it('returns degraded when rate_limited is present', () => {
    assert.equal(selectWorstDependencyStatus(['healthy', 'rate_limited']), 'degraded');
  });
  it('returns degraded when misconfigured is present', () => {
    assert.equal(selectWorstDependencyStatus(['healthy', 'misconfigured']), 'degraded');
  });
  it('unavailable wins over degraded', () => {
    assert.equal(selectWorstDependencyStatus(['degraded', 'unavailable']), 'unavailable');
  });
  it('returns unknown when no recognised status is present', () => {
    assert.equal(selectWorstDependencyStatus(['pending', 'starting']), 'unknown');
  });
  it('processes multiple healthy and degraded — degraded wins', () => {
    assert.equal(selectWorstDependencyStatus(['healthy', 'healthy', 'degraded', 'healthy']), 'degraded');
  });
});

// ---------------------------------------------------------------------------
// buildShellHeartbeatDetail
// ---------------------------------------------------------------------------

describe('buildShellHeartbeatDetail', () => {
  it('returns all-healthy message for healthy', () => {
    assert.equal(buildShellHeartbeatDetail('healthy'), 'All dependencies healthy');
  });
  it('returns some-degraded message for degraded', () => {
    assert.equal(buildShellHeartbeatDetail('degraded'), 'Some dependencies degraded');
  });
  it('returns unavailable message for unavailable', () => {
    assert.equal(buildShellHeartbeatDetail('unavailable'), 'Dependencies unavailable');
  });
  it('returns health-unknown message for unknown', () => {
    assert.equal(buildShellHeartbeatDetail('unknown'), 'Health unknown');
  });
  it('returns health-unknown message for null', () => {
    assert.equal(buildShellHeartbeatDetail(null), 'Health unknown');
  });
});

// ---------------------------------------------------------------------------
// buildShellHeartbeatStatusLabel
// ---------------------------------------------------------------------------

describe('buildShellHeartbeatStatusLabel', () => {
  it('returns Healthy for healthy', () => {
    assert.equal(buildShellHeartbeatStatusLabel('healthy'), 'Healthy');
  });
  it('returns Degraded for degraded', () => {
    assert.equal(buildShellHeartbeatStatusLabel('degraded'), 'Degraded');
  });
  it('returns Unavailable for unavailable', () => {
    assert.equal(buildShellHeartbeatStatusLabel('unavailable'), 'Unavailable');
  });
  it('returns Health for unknown', () => {
    assert.equal(buildShellHeartbeatStatusLabel('unknown'), 'Health');
  });
  it('returns Health for null', () => {
    assert.equal(buildShellHeartbeatStatusLabel(null), 'Health');
  });
});
