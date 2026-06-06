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
  buildDownloadActivityCounts,
  calculateTransferProgress,
  flattenDownloadGroups,
  formatDownloadActivitySummary,
  formatTransferFilename,
  formatTransferStateLabel,
  formatTransferStateTone,
  isActiveTransferState,
  isCompletedTransferState,
  isFailedTransferState,
  isQueuedTransferState,
} from '../../src/client/lib/activity-downloads-presentation.js';

// ---------------------------------------------------------------------------
// isActiveTransferState
// ---------------------------------------------------------------------------
describe('isActiveTransferState', () => {
  it('returns true for InProgress', () => {
    assert.equal(isActiveTransferState('InProgress'), true);
  });

  it('returns true for Queued', () => {
    assert.equal(isActiveTransferState('Queued'), true);
  });

  it('returns true for Initializing', () => {
    assert.equal(isActiveTransferState('Initializing'), true);
  });

  it('returns true for Negotiating', () => {
    assert.equal(isActiveTransferState('Negotiating'), true);
  });

  it('returns false for Completed', () => {
    assert.equal(isActiveTransferState('Completed'), false);
  });

  it('returns false for Errored', () => {
    assert.equal(isActiveTransferState('Errored'), false);
  });

  it('returns false for null', () => {
    assert.equal(isActiveTransferState(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isActiveTransferState(undefined), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isActiveTransferState(''), false);
  });

  it('is case-insensitive', () => {
    assert.equal(isActiveTransferState('inprogress'), true);
    assert.equal(isActiveTransferState('QUEUED'), true);
  });
});

// ---------------------------------------------------------------------------
// isQueuedTransferState
// ---------------------------------------------------------------------------
describe('isQueuedTransferState', () => {
  it('returns true for Queued', () => {
    assert.equal(isQueuedTransferState('Queued'), true);
  });

  it('returns false for InProgress', () => {
    assert.equal(isQueuedTransferState('InProgress'), false);
  });

  it('returns false for null', () => {
    assert.equal(isQueuedTransferState(null), false);
  });
});

// ---------------------------------------------------------------------------
// isCompletedTransferState
// ---------------------------------------------------------------------------
describe('isCompletedTransferState', () => {
  it('returns true for Completed', () => {
    assert.equal(isCompletedTransferState('Completed'), true);
  });

  it('returns false for Completed, Errored (failed completion)', () => {
    assert.equal(isCompletedTransferState('Completed, Errored'), false);
  });

  it('returns false for Completed, Cancelled', () => {
    assert.equal(isCompletedTransferState('Completed, Cancelled'), false);
  });

  it('returns false for Completed, TimedOut', () => {
    assert.equal(isCompletedTransferState('Completed, TimedOut'), false);
  });

  it('returns false for Errored', () => {
    assert.equal(isCompletedTransferState('Errored'), false);
  });

  it('returns false for InProgress', () => {
    assert.equal(isCompletedTransferState('InProgress'), false);
  });

  it('returns false for null', () => {
    assert.equal(isCompletedTransferState(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isCompletedTransferState(undefined), false);
  });

  it('returns true for Completed, Succeeded', () => {
    // slskd emits "Completed, Succeeded" for a clean finish
    assert.equal(isCompletedTransferState('Completed, Succeeded'), true);
  });
});

// ---------------------------------------------------------------------------
// isFailedTransferState
// ---------------------------------------------------------------------------
describe('isFailedTransferState', () => {
  it('returns true for Errored', () => {
    assert.equal(isFailedTransferState('Errored'), true);
  });

  it('returns true for Cancelled', () => {
    assert.equal(isFailedTransferState('Cancelled'), true);
  });

  it('returns true for Rejected', () => {
    assert.equal(isFailedTransferState('Rejected'), true);
  });

  it('returns true for TimedOut', () => {
    assert.equal(isFailedTransferState('TimedOut'), true);
  });

  it('returns true for Aborted', () => {
    assert.equal(isFailedTransferState('Aborted'), true);
  });

  it('returns false for Completed', () => {
    assert.equal(isFailedTransferState('Completed'), false);
  });

  it('returns false for InProgress', () => {
    assert.equal(isFailedTransferState('InProgress'), false);
  });

  it('returns false for null', () => {
    assert.equal(isFailedTransferState(null), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isFailedTransferState(''), false);
  });

  it('is case-insensitive', () => {
    assert.equal(isFailedTransferState('errored'), true);
    assert.equal(isFailedTransferState('TIMEDOUT'), true);
  });
});

// ---------------------------------------------------------------------------
// formatTransferStateLabel
// ---------------------------------------------------------------------------
describe('formatTransferStateLabel', () => {
  it('returns — for null', () => {
    assert.equal(formatTransferStateLabel(null), '—');
  });

  it('returns — for undefined', () => {
    assert.equal(formatTransferStateLabel(undefined), '—');
  });

  it('returns — for empty string', () => {
    assert.equal(formatTransferStateLabel(''), '—');
  });

  it('translates InProgress to Downloading', () => {
    assert.equal(formatTransferStateLabel('InProgress'), 'Downloading');
  });

  it('translates Queued to Queued', () => {
    assert.equal(formatTransferStateLabel('Queued'), 'Queued');
  });

  it('translates Initializing to Starting', () => {
    assert.equal(formatTransferStateLabel('Initializing'), 'Starting');
  });

  it('translates Negotiating to Connecting', () => {
    assert.equal(formatTransferStateLabel('Negotiating'), 'Connecting');
  });

  it('translates Completed to Completed', () => {
    assert.equal(formatTransferStateLabel('Completed'), 'Completed');
  });

  it('translates Errored to Failed', () => {
    assert.equal(formatTransferStateLabel('Errored'), 'Failed');
  });

  it('translates TimedOut to Timed out', () => {
    assert.equal(formatTransferStateLabel('TimedOut'), 'Timed out');
  });

  it('translates Cancelled to Cancelled', () => {
    assert.equal(formatTransferStateLabel('Cancelled'), 'Cancelled');
  });

  it('translates Rejected to Rejected', () => {
    assert.equal(formatTransferStateLabel('Rejected'), 'Rejected');
  });

  it('translates Aborted to Aborted', () => {
    assert.equal(formatTransferStateLabel('Aborted'), 'Aborted');
  });

  it('translates compound Completed, Succeeded to Completed', () => {
    assert.equal(formatTransferStateLabel('Completed, Succeeded'), 'Completed');
  });

  it('translates compound Completed, Errored to Failed', () => {
    assert.equal(formatTransferStateLabel('Completed, Errored'), 'Failed');
  });

  it('translates compound Completed, Cancelled to Cancelled', () => {
    assert.equal(formatTransferStateLabel('Completed, Cancelled'), 'Cancelled');
  });

  it('translates compound Completed, TimedOut to Timed out', () => {
    assert.equal(formatTransferStateLabel('Completed, TimedOut'), 'Timed out');
  });

  it('never returns a raw underscore or PascalCase for known states', () => {
    const known = [
      'InProgress', 'Queued', 'Initializing', 'Negotiating',
      'Completed', 'Errored', 'Cancelled', 'Rejected', 'TimedOut', 'Aborted',
    ];
    for (const state of known) {
      const label = formatTransferStateLabel(state);
      assert.doesNotMatch(label, /_/, `${state} → "${label}" still has underscore`);
    }
  });

  it('does not return InProgress as-is for InProgress state', () => {
    assert.notEqual(formatTransferStateLabel('InProgress'), 'InProgress');
  });

  it('falls back to title-cased label for unknown state', () => {
    const result = formatTransferStateLabel('SomeNewState');
    assert.match(result, /^[A-Z]/);
    assert.doesNotMatch(result, /SomeNewState/);
  });
});

// ---------------------------------------------------------------------------
// formatTransferStateTone
// ---------------------------------------------------------------------------
describe('formatTransferStateTone', () => {
  it('returns danger for Errored', () => {
    assert.equal(formatTransferStateTone('Errored'), 'danger');
  });

  it('returns danger for Cancelled', () => {
    assert.equal(formatTransferStateTone('Cancelled'), 'danger');
  });

  it('returns danger for TimedOut', () => {
    assert.equal(formatTransferStateTone('TimedOut'), 'danger');
  });

  it('returns success for Completed', () => {
    assert.equal(formatTransferStateTone('Completed'), 'success');
  });

  it('returns success for Completed, Succeeded', () => {
    assert.equal(formatTransferStateTone('Completed, Succeeded'), 'success');
  });

  it('returns warning for InProgress', () => {
    assert.equal(formatTransferStateTone('InProgress'), 'warning');
  });

  it('returns warning for Queued', () => {
    assert.equal(formatTransferStateTone('Queued'), 'warning');
  });

  it('returns warning for Initializing', () => {
    assert.equal(formatTransferStateTone('Initializing'), 'warning');
  });

  it('returns warning for Negotiating', () => {
    assert.equal(formatTransferStateTone('Negotiating'), 'warning');
  });

  it('returns info for null', () => {
    assert.equal(formatTransferStateTone(null), 'info');
  });

  it('returns info for unknown state', () => {
    assert.equal(formatTransferStateTone('Unknown'), 'info');
  });

  it('failed state always takes priority over active', () => {
    // "Completed, Errored" contains both Completed and Errored
    assert.equal(formatTransferStateTone('Completed, Errored'), 'danger');
  });
});

// ---------------------------------------------------------------------------
// calculateTransferProgress
// ---------------------------------------------------------------------------
describe('calculateTransferProgress', () => {
  it('returns null for null file', () => {
    assert.equal(calculateTransferProgress(null), null);
  });

  it('returns null when size is missing', () => {
    assert.equal(calculateTransferProgress({ bytesTransferred: 500 }), null);
  });

  it('returns null when size is zero', () => {
    assert.equal(calculateTransferProgress({ size: 0, bytesTransferred: 0 }), null);
  });

  it('returns null when size is negative', () => {
    assert.equal(calculateTransferProgress({ size: -100, bytesTransferred: 0 }), null);
  });

  it('returns 0 when bytesTransferred is negative', () => {
    assert.equal(calculateTransferProgress({ size: 1000, bytesTransferred: -1 }), 0);
  });

  it('returns 0 when bytesTransferred is missing', () => {
    assert.equal(calculateTransferProgress({ size: 1000 }), 0);
  });

  it('returns 50 for half transferred', () => {
    assert.equal(calculateTransferProgress({ size: 1000, bytesTransferred: 500 }), 50);
  });

  it('returns 100 for fully transferred', () => {
    assert.equal(calculateTransferProgress({ size: 1000, bytesTransferred: 1000 }), 100);
  });

  it('caps at 100 for over-transferred (bad data guard)', () => {
    assert.equal(calculateTransferProgress({ size: 1000, bytesTransferred: 1500 }), 100);
  });

  it('rounds to nearest integer', () => {
    // 333 / 1000 = 33.3% → 33
    assert.equal(calculateTransferProgress({ size: 1000, bytesTransferred: 333 }), 33);
  });

  it('returns null for non-finite size', () => {
    assert.equal(calculateTransferProgress({ size: Infinity, bytesTransferred: 100 }), null);
  });
});

// ---------------------------------------------------------------------------
// flattenDownloadGroups
// ---------------------------------------------------------------------------
describe('flattenDownloadGroups', () => {
  it('returns an empty array for non-arrays', () => {
    assert.deepEqual(flattenDownloadGroups(null), []);
  });

  it('flattens groups and carries username and directory context', () => {
    const result = flattenDownloadGroups([
      {
        username: 'source-user',
        directories: [
          {
            directory: 'Artist/Album',
            files: [{ id: 'f1', filename: '01 Track.flac', state: 'Queued' }],
          },
        ],
      },
    ]);

    assert.deepEqual(result, [{
      id: 'f1',
      filename: '01 Track.flac',
      state: 'Queued',
      username: 'source-user',
      directory: 'Artist/Album',
    }]);
  });

  it('skips malformed directories without throwing', () => {
    assert.deepEqual(flattenDownloadGroups([{ username: 'u', directories: [{ files: null }] }]), []);
  });
});

// ---------------------------------------------------------------------------
// buildDownloadActivityCounts
// ---------------------------------------------------------------------------
describe('buildDownloadActivityCounts', () => {
  it('returns zero counts for non-arrays', () => {
    assert.deepEqual(buildDownloadActivityCounts(null), {
      total: 0,
      active: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      other: 0,
    });
  });

  it('separates active transfers from queued transfers', () => {
    const counts = buildDownloadActivityCounts([
      { state: 'InProgress' },
      { state: 'Initializing' },
      { state: 'Queued' },
      { state: 'Completed, Succeeded' },
      { state: 'Errored' },
      { state: 'UnknownState' },
    ]);

    assert.deepEqual(counts, {
      total: 6,
      active: 2,
      queued: 1,
      completed: 1,
      failed: 1,
      other: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// formatTransferFilename
// ---------------------------------------------------------------------------
describe('formatTransferFilename', () => {
  it('returns — for null', () => {
    assert.equal(formatTransferFilename(null), '—');
  });

  it('returns — for undefined', () => {
    assert.equal(formatTransferFilename(undefined), '—');
  });

  it('strips Unix directory prefix', () => {
    assert.equal(formatTransferFilename('/home/user/music/song.flac'), 'song.flac');
  });

  it('strips Windows directory prefix', () => {
    assert.equal(formatTransferFilename('C:\\Users\\music\\song.mp3'), 'song.mp3');
  });

  it('returns the filename for a path with no directory', () => {
    assert.equal(formatTransferFilename('song.flac'), 'song.flac');
  });

  it('handles mixed separators', () => {
    assert.equal(formatTransferFilename('/music\\artist/song.flac'), 'song.flac');
  });

  it('returns — for a string that is only a separator', () => {
    assert.equal(formatTransferFilename('/'), '—');
  });

  it('strips deep Soulseek path (backslash-separated)', () => {
    assert.equal(
      formatTransferFilename('user\\Radiohead\\OK Computer\\01 Airbag.flac'),
      '01 Airbag.flac',
    );
  });
});

// ---------------------------------------------------------------------------
// formatDownloadActivitySummary
// ---------------------------------------------------------------------------
describe('formatDownloadActivitySummary', () => {
  it('formats zero counts', () => {
    assert.equal(
      formatDownloadActivitySummary({ active: 0, completed: 0, failed: 0 }),
      '0 active · 0 complete · 0 failed',
    );
  });

  it('includes queued count when provided', () => {
    assert.equal(
      formatDownloadActivitySummary({ active: 3, queued: 2, completed: 12, failed: 1 }),
      '3 active · 2 queued · 12 complete · 1 failed',
    );
  });

  it('formats mixed counts', () => {
    assert.equal(
      formatDownloadActivitySummary({ active: 3, completed: 12, failed: 1 }),
      '3 active · 12 complete · 1 failed',
    );
  });

  it('uses the separator · between segments', () => {
    const result = formatDownloadActivitySummary({ active: 1, completed: 2, failed: 3 });
    assert.equal(result.split('·').length, 3);
  });
});
