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
  buildDiscoveryDispatchHandoffMessage,
  canStartDiscoveryDispatch,
  canStartLibraryScan,
  getDiscoveryHeartbeatOutcomeLabel,
  getDiscoveryHeartbeatSkipReasonLabel,
  getDiscoveryQueueStatusClass,
  getDiscoveryQueueStatusLabel,
  getLibraryReconciliationStatusClass,
  getLibraryReconciliationStatusLabel,
  getLibraryScanReadinessClass,
  getLibraryScanReadinessLabel,
  getLibraryScanStartLabel,
  getTriggerSourceLabel,
  getWantedReconciliationStatusClass,
  getWantedReconciliationStatusLabel,
} from '../../src/client/lib/library-status-presentation.js';

// ── Discovery queue status ────────────────────────────────────────────────────

describe('getDiscoveryQueueStatusClass', () => {
  it('returns selected for ready', () => {
    assert.equal(getDiscoveryQueueStatusClass('ready'), 'review-status-selected');
  });
  it('returns pending for cooldown', () => {
    assert.equal(getDiscoveryQueueStatusClass('cooldown'), 'review-status-pending');
  });
  it('returns held for blocked', () => {
    assert.equal(getDiscoveryQueueStatusClass('blocked'), 'review-status-held');
  });
  it('returns held for unknown status', () => {
    assert.equal(getDiscoveryQueueStatusClass('unknown'), 'review-status-held');
  });
  it('returns held for null', () => {
    assert.equal(getDiscoveryQueueStatusClass(null), 'review-status-held');
  });
  it('returns held for undefined', () => {
    assert.equal(getDiscoveryQueueStatusClass(undefined), 'review-status-held');
  });
});

describe('getDiscoveryQueueStatusLabel', () => {
  it('returns Ready for ready', () => {
    assert.equal(getDiscoveryQueueStatusLabel('ready'), 'Ready');
  });
  it('returns Cooling down for cooldown', () => {
    assert.equal(getDiscoveryQueueStatusLabel('cooldown'), 'Cooling down');
  });
  it('returns Blocked for blocked', () => {
    assert.equal(getDiscoveryQueueStatusLabel('blocked'), 'Blocked');
  });
  it('returns Empty for unknown status', () => {
    assert.equal(getDiscoveryQueueStatusLabel('unknown'), 'Empty');
  });
  it('returns Empty for null', () => {
    assert.equal(getDiscoveryQueueStatusLabel(null), 'Empty');
  });
  it('returns Empty for undefined', () => {
    assert.equal(getDiscoveryQueueStatusLabel(undefined), 'Empty');
  });
});

// ── Trigger source ────────────────────────────────────────────────────────────

describe('getTriggerSourceLabel', () => {
  it('returns Heartbeat for heartbeat', () => {
    assert.equal(getTriggerSourceLabel('heartbeat'), 'Heartbeat');
  });
  it('returns Manual for manual', () => {
    assert.equal(getTriggerSourceLabel('manual'), 'Manual');
  });
  it('returns Unavailable for unknown value', () => {
    assert.equal(getTriggerSourceLabel('scheduled'), 'Unavailable');
  });
  it('returns Unavailable for null', () => {
    assert.equal(getTriggerSourceLabel(null), 'Unavailable');
  });
  it('returns Unavailable for undefined', () => {
    assert.equal(getTriggerSourceLabel(undefined), 'Unavailable');
  });
});

// ── Discovery heartbeat outcome ───────────────────────────────────────────────

describe('getDiscoveryHeartbeatOutcomeLabel', () => {
  it('returns Started automatic run for started outcome', () => {
    assert.equal(
      getDiscoveryHeartbeatOutcomeLabel({ lastOutcome: 'started' }),
      'Started automatic run',
    );
  });
  it('returns Automatic run errored for error outcome', () => {
    assert.equal(
      getDiscoveryHeartbeatOutcomeLabel({ lastOutcome: 'error' }),
      'Automatic run errored',
    );
  });
  it('returns Skipped automatic run for skipped outcome', () => {
    assert.equal(
      getDiscoveryHeartbeatOutcomeLabel({ lastOutcome: 'skipped' }),
      'Skipped automatic run',
    );
  });
  it('returns Not yet recorded for null state', () => {
    assert.equal(getDiscoveryHeartbeatOutcomeLabel(null), 'Not yet recorded');
  });
  it('returns Not yet recorded for undefined state', () => {
    assert.equal(getDiscoveryHeartbeatOutcomeLabel(undefined), 'Not yet recorded');
  });
  it('returns Not yet recorded for empty state object', () => {
    assert.equal(getDiscoveryHeartbeatOutcomeLabel({}), 'Not yet recorded');
  });
  it('returns Not yet recorded for unknown outcome', () => {
    assert.equal(getDiscoveryHeartbeatOutcomeLabel({ lastOutcome: 'unknown' }), 'Not yet recorded');
  });
});

// ── Discovery heartbeat skip reason ──────────────────────────────────────────

describe('getDiscoveryHeartbeatSkipReasonLabel', () => {
  it('returns Not due for not_due', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel('not_due'), 'Not due');
  });
  it('returns Run in progress for run_in_progress', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel('run_in_progress'), 'Run in progress');
  });
  it('returns Tick already running for tick_in_progress', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel('tick_in_progress'), 'Tick already running');
  });
  it('returns Error for error', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel('error'), 'Error');
  });
  it('returns None for null', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel(null), 'None');
  });
  it('returns None for undefined', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel(undefined), 'None');
  });
  it('returns None for unknown reason', () => {
    assert.equal(getDiscoveryHeartbeatSkipReasonLabel('other'), 'None');
  });
});

// ── canStartDiscoveryDispatch ─────────────────────────────────────────────────

describe('canStartDiscoveryDispatch', () => {
  it('returns false for null payload', () => {
    assert.equal(canStartDiscoveryDispatch(null), false);
  });
  it('returns false for undefined payload', () => {
    assert.equal(canStartDiscoveryDispatch(undefined), false);
  });
  it('returns false when totalRequests is zero', () => {
    assert.equal(
      canStartDiscoveryDispatch({ requestCounts: { totalRequests: 0 }, latestRun: null }),
      false,
    );
  });
  it('returns false when requestCounts is absent', () => {
    assert.equal(canStartDiscoveryDispatch({ latestRun: null }), false);
  });
  it('returns false when latestRun is pending', () => {
    assert.equal(
      canStartDiscoveryDispatch({
        requestCounts: { totalRequests: 5 },
        latestRun: { status: 'pending' },
      }),
      false,
    );
  });
  it('returns false when latestRun is running', () => {
    assert.equal(
      canStartDiscoveryDispatch({
        requestCounts: { totalRequests: 5 },
        latestRun: { status: 'running' },
      }),
      false,
    );
  });
  it('returns true when requests exist and latestRun is completed', () => {
    assert.equal(
      canStartDiscoveryDispatch({
        requestCounts: { totalRequests: 3 },
        latestRun: { status: 'completed' },
      }),
      true,
    );
  });
  it('returns true when requests exist and no latestRun', () => {
    assert.equal(
      canStartDiscoveryDispatch({
        requestCounts: { totalRequests: 3 },
        latestRun: null,
      }),
      true,
    );
  });
  it('returns true when requests exist and latestRun is failed', () => {
    assert.equal(
      canStartDiscoveryDispatch({
        requestCounts: { totalRequests: 2 },
        latestRun: { status: 'failed' },
      }),
      true,
    );
  });
});

describe('buildDiscoveryDispatchHandoffMessage', () => {
  it('reports ready discovery requests before other states', () => {
    assert.equal(
      buildDiscoveryDispatchHandoffMessage({
        requestCounts: { blocked: 2, cooldown: 1, ready: 3, totalRequests: 6 },
        latestRun: null,
      }),
      '3 releases are ready for Soulseek search dispatch.',
    );
  });

  it('reports an active dispatch run when no requests are ready', () => {
    assert.equal(
      buildDiscoveryDispatchHandoffMessage({
        requestCounts: { blocked: 0, cooldown: 0, ready: 0, totalRequests: 2 },
        latestRun: { status: 'running' },
      }),
      'Discovery dispatch is already running. Results will appear in Import Review or Downloader after searches return.',
    );
  });

  it('reports cooldown requests', () => {
    assert.equal(
      buildDiscoveryDispatchHandoffMessage({
        requestCounts: { blocked: 0, cooldown: 1, ready: 0, totalRequests: 1 },
        latestRun: { status: 'completed' },
      }),
      '1 release is cooling down before the next automatic search.',
    );
  });

  it('reports empty queue', () => {
    assert.equal(
      buildDiscoveryDispatchHandoffMessage(null),
      'No discovery searches are waiting right now.',
    );
  });
});

// ── Library scan readiness ────────────────────────────────────────────────────

describe('getLibraryScanReadinessLabel', () => {
  it('returns Ready for ready', () => {
    assert.equal(getLibraryScanReadinessLabel('ready'), 'Ready');
  });
  it('returns Blocked for blocked', () => {
    assert.equal(getLibraryScanReadinessLabel('blocked'), 'Blocked');
  });
  it('returns Blocked for null', () => {
    assert.equal(getLibraryScanReadinessLabel(null), 'Blocked');
  });
  it('returns Blocked for undefined', () => {
    assert.equal(getLibraryScanReadinessLabel(undefined), 'Blocked');
  });
  it('returns Blocked for unknown status', () => {
    assert.equal(getLibraryScanReadinessLabel('unavailable'), 'Blocked');
  });
});

describe('getLibraryScanReadinessClass', () => {
  it('returns selected for ready', () => {
    assert.equal(getLibraryScanReadinessClass('ready'), 'review-status-selected');
  });
  it('returns held for blocked', () => {
    assert.equal(getLibraryScanReadinessClass('blocked'), 'review-status-held');
  });
  it('returns held for null', () => {
    assert.equal(getLibraryScanReadinessClass(null), 'review-status-held');
  });
  it('returns held for undefined', () => {
    assert.equal(getLibraryScanReadinessClass(undefined), 'review-status-held');
  });
});

// ── canStartLibraryScan ───────────────────────────────────────────────────────

describe('canStartLibraryScan', () => {
  it('returns false for null scanSummary', () => {
    assert.equal(canStartLibraryScan(null), false);
  });
  it('returns false for undefined scanSummary', () => {
    assert.equal(canStartLibraryScan(undefined), false);
  });
  it('returns false when readiness status is blocked', () => {
    assert.equal(
      canStartLibraryScan({ readiness: { status: 'blocked' }, latestRun: null }),
      false,
    );
  });
  it('returns false when readiness is absent', () => {
    assert.equal(canStartLibraryScan({ latestRun: null }), false);
  });
  it('returns false when latestRun is pending', () => {
    assert.equal(
      canStartLibraryScan({
        readiness: { status: 'ready' },
        latestRun: { status: 'pending' },
      }),
      false,
    );
  });
  it('returns false when latestRun is running', () => {
    assert.equal(
      canStartLibraryScan({
        readiness: { status: 'ready' },
        latestRun: { status: 'running' },
      }),
      false,
    );
  });
  it('returns true when readiness is ready and no latestRun', () => {
    assert.equal(
      canStartLibraryScan({ readiness: { status: 'ready' }, latestRun: null }),
      true,
    );
  });
  it('returns true when readiness is ready and latestRun is completed', () => {
    assert.equal(
      canStartLibraryScan({
        readiness: { status: 'ready' },
        latestRun: { status: 'completed' },
      }),
      true,
    );
  });
  it('returns true when readiness is ready and latestRun is failed', () => {
    assert.equal(
      canStartLibraryScan({
        readiness: { status: 'ready' },
        latestRun: { status: 'failed' },
      }),
      true,
    );
  });
});

// ── getLibraryScanStartLabel ──────────────────────────────────────────────────

describe('getLibraryScanStartLabel', () => {
  it('returns Run again when scanSummary has latestRun', () => {
    assert.equal(
      getLibraryScanStartLabel({ latestRun: { status: 'completed' } }),
      'Run again',
    );
  });
  it('returns Start scan when latestRun is null', () => {
    assert.equal(getLibraryScanStartLabel({ latestRun: null }), 'Start scan');
  });
  it('returns Start scan for null scanSummary', () => {
    assert.equal(getLibraryScanStartLabel(null), 'Start scan');
  });
  it('returns Start scan for undefined scanSummary', () => {
    assert.equal(getLibraryScanStartLabel(undefined), 'Start scan');
  });
});

// ── Library reconciliation status ─────────────────────────────────────────────

describe('getLibraryReconciliationStatusClass', () => {
  it('returns selected for complete', () => {
    assert.equal(getLibraryReconciliationStatusClass('complete'), 'review-status-selected');
  });
  it('returns pending for partial', () => {
    assert.equal(getLibraryReconciliationStatusClass('partial'), 'review-status-pending');
  });
  it('returns pending for incomplete', () => {
    assert.equal(getLibraryReconciliationStatusClass('incomplete'), 'review-status-pending');
  });
  it('returns failed for review_required', () => {
    assert.equal(getLibraryReconciliationStatusClass('review_required'), 'review-status-failed');
  });
  it('returns held for unknown status', () => {
    assert.equal(getLibraryReconciliationStatusClass('unknown'), 'review-status-held');
  });
  it('returns held for null', () => {
    assert.equal(getLibraryReconciliationStatusClass(null), 'review-status-held');
  });
  it('returns held for undefined', () => {
    assert.equal(getLibraryReconciliationStatusClass(undefined), 'review-status-held');
  });
});

describe('getLibraryReconciliationStatusLabel', () => {
  it('returns Complete for complete', () => {
    assert.equal(getLibraryReconciliationStatusLabel('complete'), 'Complete');
  });
  it('returns Partial for partial', () => {
    assert.equal(getLibraryReconciliationStatusLabel('partial'), 'Partial');
  });
  it('returns Review required for review_required', () => {
    assert.equal(getLibraryReconciliationStatusLabel('review_required'), 'Review required');
  });
  it('returns Incomplete for incomplete', () => {
    assert.equal(getLibraryReconciliationStatusLabel('incomplete'), 'Incomplete');
  });
  it('returns Empty for unknown status', () => {
    assert.equal(getLibraryReconciliationStatusLabel('unknown'), 'Empty');
  });
  it('returns Empty for null', () => {
    assert.equal(getLibraryReconciliationStatusLabel(null), 'Empty');
  });
  it('returns Empty for undefined', () => {
    assert.equal(getLibraryReconciliationStatusLabel(undefined), 'Empty');
  });
});

// ── Wanted reconciliation status ──────────────────────────────────────────────

describe('getWantedReconciliationStatusClass', () => {
  it('returns selected for complete', () => {
    assert.equal(getWantedReconciliationStatusClass('complete'), 'review-status-selected');
  });
  it('returns pending for partial', () => {
    assert.equal(getWantedReconciliationStatusClass('partial'), 'review-status-pending');
  });
  it('returns failed for wanted', () => {
    assert.equal(getWantedReconciliationStatusClass('wanted'), 'review-status-failed');
  });
  it('returns held for unknown status', () => {
    assert.equal(getWantedReconciliationStatusClass('unknown'), 'review-status-held');
  });
  it('returns held for null', () => {
    assert.equal(getWantedReconciliationStatusClass(null), 'review-status-held');
  });
  it('returns held for undefined', () => {
    assert.equal(getWantedReconciliationStatusClass(undefined), 'review-status-held');
  });
});

describe('getWantedReconciliationStatusLabel', () => {
  it('returns Satisfied for complete', () => {
    assert.equal(getWantedReconciliationStatusLabel('complete'), 'Satisfied');
  });
  it('returns Partially missing for partial', () => {
    assert.equal(getWantedReconciliationStatusLabel('partial'), 'Partially missing');
  });
  it('returns Wanted for wanted', () => {
    assert.equal(getWantedReconciliationStatusLabel('wanted'), 'Wanted');
  });
  it('returns Empty for unknown status', () => {
    assert.equal(getWantedReconciliationStatusLabel('unknown'), 'Empty');
  });
  it('returns Empty for null', () => {
    assert.equal(getWantedReconciliationStatusLabel(null), 'Empty');
  });
  it('returns Empty for undefined', () => {
    assert.equal(getWantedReconciliationStatusLabel(undefined), 'Empty');
  });
});
