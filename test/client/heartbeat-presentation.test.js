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
  formatHeartbeatStatus,
  getHeartbeatStatusClass,
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
