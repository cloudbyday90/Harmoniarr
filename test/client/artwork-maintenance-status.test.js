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
  canStartArtworkCleanup,
  getArtworkCleanupDetailTitle,
  getArtworkCleanupHistorySummary,
  getArtworkCleanupRunStatusClass,
  getArtworkCleanupRunStatusLabel,
  getArtworkMaintenanceStatusClass,
  getArtworkMaintenanceStatusLabel,
  isArtworkCleanupPollingStatus,
  resolveArtworkSelectedRunId,
} from '../../src/client/lib/artwork-maintenance-status.js';

describe('getArtworkMaintenanceStatusLabel', () => {
  it('returns Ready for ready', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('ready'), 'Ready');
  });
  it('returns Waiting for waiting', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('waiting'), 'Waiting');
  });
  it('returns Running for running', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('running'), 'Running');
  });
  it('returns Queued for pending', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('pending'), 'Queued');
  });
  it('returns Completed for completed', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('completed'), 'Completed');
  });
  it('returns Failed for failed', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('failed'), 'Failed');
  });
  it('returns Empty for unknown', () => {
    assert.equal(getArtworkMaintenanceStatusLabel('unknown'), 'Empty');
  });
  it('returns Empty for null', () => {
    assert.equal(getArtworkMaintenanceStatusLabel(null), 'Empty');
  });
});

describe('getArtworkMaintenanceStatusClass', () => {
  it('returns selected for ready', () => {
    assert.equal(getArtworkMaintenanceStatusClass('ready'), 'review-status-selected');
  });
  it('returns selected for completed', () => {
    assert.equal(getArtworkMaintenanceStatusClass('completed'), 'review-status-selected');
  });
  it('returns pending for running', () => {
    assert.equal(getArtworkMaintenanceStatusClass('running'), 'review-status-pending');
  });
  it('returns pending for pending', () => {
    assert.equal(getArtworkMaintenanceStatusClass('pending'), 'review-status-pending');
  });
  it('returns failed for failed', () => {
    assert.equal(getArtworkMaintenanceStatusClass('failed'), 'review-status-failed');
  });
  it('returns held for unknown', () => {
    assert.equal(getArtworkMaintenanceStatusClass('unknown'), 'review-status-held');
  });
  it('returns held for null', () => {
    assert.equal(getArtworkMaintenanceStatusClass(null), 'review-status-held');
  });
});

describe('getArtworkCleanupRunStatusLabel', () => {
  it('delegates to operation-run-status for completed', () => {
    assert.equal(typeof getArtworkCleanupRunStatusLabel('completed'), 'string');
    assert.ok(getArtworkCleanupRunStatusLabel('completed').length > 0);
  });
  it('returns a string for null status', () => {
    assert.equal(typeof getArtworkCleanupRunStatusLabel(null), 'string');
  });
});

describe('getArtworkCleanupRunStatusClass', () => {
  it('delegates to operation-run-status for completed', () => {
    assert.equal(typeof getArtworkCleanupRunStatusClass('completed'), 'string');
    assert.ok(getArtworkCleanupRunStatusClass('completed').length > 0);
  });
  it('returns a string for null status', () => {
    assert.equal(typeof getArtworkCleanupRunStatusClass(null), 'string');
  });
});

describe('canStartArtworkCleanup', () => {
  it('returns false for null summaryPayload', () => {
    assert.equal(canStartArtworkCleanup(null), false);
  });
  it('returns false for undefined summaryPayload', () => {
    assert.equal(canStartArtworkCleanup(undefined), false);
  });
  it('returns false when eligibleAssetCount is 0', () => {
    assert.equal(canStartArtworkCleanup({ inventory: { eligibleAssetCount: 0 }, latestRun: null }), false);
  });
  it('returns false when eligibleAssetCount is missing', () => {
    assert.equal(canStartArtworkCleanup({ inventory: {}, latestRun: null }), false);
  });
  it('returns false when inventory is missing entirely', () => {
    assert.equal(canStartArtworkCleanup({ latestRun: null }), false);
  });
  it('returns false when latest run is pending', () => {
    assert.equal(canStartArtworkCleanup({ inventory: { eligibleAssetCount: 5 }, latestRun: { status: 'pending' } }), false);
  });
  it('returns false when latest run is running', () => {
    assert.equal(canStartArtworkCleanup({ inventory: { eligibleAssetCount: 5 }, latestRun: { status: 'running' } }), false);
  });
  it('returns true when eligible assets exist and no active run', () => {
    assert.equal(canStartArtworkCleanup({ inventory: { eligibleAssetCount: 3 }, latestRun: null }), true);
  });
  it('returns true when eligible assets exist and latest run is completed', () => {
    assert.equal(canStartArtworkCleanup({ inventory: { eligibleAssetCount: 3 }, latestRun: { status: 'completed' } }), true);
  });
  it('returns true when eligible assets exist and latest run is failed', () => {
    assert.equal(canStartArtworkCleanup({ inventory: { eligibleAssetCount: 1 }, latestRun: { status: 'failed' } }), true);
  });
});

describe('getArtworkCleanupHistorySummary', () => {
  it('uses errorMessage for failed run when present', () => {
    const run = { status: 'failed', errorMessage: 'Disk full', failedAssetCount: 2 };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Disk full');
  });
  it('falls back to count message for failed run without errorMessage', () => {
    const run = { status: 'failed', failedAssetCount: 3 };
    assert.equal(getArtworkCleanupHistorySummary(run), '3 artwork asset cleanup failures need review.');
  });
  it('uses singular for failed count of 1', () => {
    const run = { status: 'failed', failedAssetCount: 1 };
    assert.equal(getArtworkCleanupHistorySummary(run), '1 artwork asset cleanup failure need review.');
  });
  it('uses 0 for failed run with null failedAssetCount', () => {
    const run = { status: 'failed' };
    assert.equal(getArtworkCleanupHistorySummary(run), '0 artwork asset cleanup failures need review.');
  });
  it('builds completed summary with deleted and skipped counts', () => {
    const run = { status: 'completed', deletedAssetCount: 4, missingFileCount: 2 };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Deleted 4 assets and skipped 2 missing files.');
  });
  it('uses singular for completed with 1 asset and 1 file', () => {
    const run = { status: 'completed', deletedAssetCount: 1, missingFileCount: 1 };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Deleted 1 asset and skipped 1 missing file.');
  });
  it('uses 0 for completed run with null counts', () => {
    const run = { status: 'completed' };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Deleted 0 assets and skipped 0 missing files.');
  });
  it('builds running summary with requestedAssetCount', () => {
    const run = { status: 'running', requestedAssetCount: 5 };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Requested 5 retention-eligible assets for cleanup.');
  });
  it('builds pending summary with requestedAssetCount', () => {
    const run = { status: 'pending', requestedAssetCount: 1 };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Requested 1 retention-eligible asset for cleanup.');
  });
  it('uses 0 for running run with null requestedAssetCount', () => {
    const run = { status: 'running' };
    assert.equal(getArtworkCleanupHistorySummary(run), 'Requested 0 retention-eligible assets for cleanup.');
  });
  it('returns fallback for unknown status', () => {
    const run = { status: 'unknown' };
    assert.equal(getArtworkCleanupHistorySummary(run), 'No details were recorded for this cleanup run.');
  });
});

describe('getArtworkCleanupDetailTitle', () => {
  it('returns failed title', () => {
    assert.equal(getArtworkCleanupDetailTitle({ status: 'failed' }), 'Selected cleanup run failed');
  });
  it('returns completed title', () => {
    assert.equal(getArtworkCleanupDetailTitle({ status: 'completed' }), 'Selected cleanup run completed');
  });
  it('returns active title for running', () => {
    assert.equal(getArtworkCleanupDetailTitle({ status: 'running' }), 'Selected cleanup run is active');
  });
  it('returns queued title for pending', () => {
    assert.equal(getArtworkCleanupDetailTitle({ status: 'pending' }), 'Selected cleanup run is queued');
  });
  it('returns generic title for unknown status', () => {
    assert.equal(getArtworkCleanupDetailTitle({ status: 'unknown' }), 'Selected cleanup run');
  });
  it('returns generic title for missing status', () => {
    assert.equal(getArtworkCleanupDetailTitle({}), 'Selected cleanup run');
  });
});

describe('isArtworkCleanupPollingStatus', () => {
  it('returns true for pending', () => {
    assert.equal(isArtworkCleanupPollingStatus('pending'), true);
  });
  it('returns true for running', () => {
    assert.equal(isArtworkCleanupPollingStatus('running'), true);
  });
  it('returns false for completed', () => {
    assert.equal(isArtworkCleanupPollingStatus('completed'), false);
  });
  it('returns false for failed', () => {
    assert.equal(isArtworkCleanupPollingStatus('failed'), false);
  });
  it('returns false for null', () => {
    assert.equal(isArtworkCleanupPollingStatus(null), false);
  });
  it('returns false for undefined', () => {
    assert.equal(isArtworkCleanupPollingStatus(undefined), false);
  });
  it('returns false for empty string', () => {
    assert.equal(isArtworkCleanupPollingStatus(''), false);
  });
});

describe('resolveArtworkSelectedRunId', () => {
  it('returns preferredRunId when set', () => {
    assert.equal(
      resolveArtworkSelectedRunId({ latestRunId: 'run-1', preferredRunId: 'run-pref', recentRuns: [] }),
      'run-pref',
    );
  });
  it('returns latestRunId when preferredRunId is absent', () => {
    assert.equal(
      resolveArtworkSelectedRunId({ latestRunId: 'run-latest', preferredRunId: null, recentRuns: [] }),
      'run-latest',
    );
  });
  it('returns first recentRun id when latestRunId and preferredRunId are absent', () => {
    assert.equal(
      resolveArtworkSelectedRunId({ latestRunId: null, preferredRunId: null, recentRuns: [{ id: 'run-hist' }] }),
      'run-hist',
    );
  });
  it('returns null when all sources are absent', () => {
    assert.equal(
      resolveArtworkSelectedRunId({ latestRunId: null, preferredRunId: null, recentRuns: [] }),
      null,
    );
  });
  it('returns null for empty recentRuns and no latestRunId', () => {
    assert.equal(
      resolveArtworkSelectedRunId({ latestRunId: undefined, preferredRunId: undefined, recentRuns: [] }),
      null,
    );
  });
});
