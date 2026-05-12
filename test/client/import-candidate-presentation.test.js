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
  candidateStatusLabel,
  candidateStatusTone,
  canStartApplyRun,
  describeApplyOperation,
  formatApplyFallbackReason,
  formatApplyMutationMode,
  formatBytes,
  formatCandidateCountLabel,
  formatExecutionMode,
  formatPath,
  formatPercent,
  formatRunStatus,
  formatSourceProvider,
  formatTimestamp,
  formatTokenLabel,
  getApplyItemOperationHistory,
  getApplyItemStatusClass,
  getApplyItemStatusLabel,
  getApplyOperationStatusClass,
  getApplyOperationStatusLabel,
  getApplyOperationStepLabel,
  getRunStatusClass,
} from '../../src/client/lib/import-candidate-presentation.js';

// ---------------------------------------------------------------------------
// formatTimestamp
// ---------------------------------------------------------------------------

describe('formatTimestamp', () => {
  it('returns default fallback for null', () => {
    assert.equal(formatTimestamp(null), 'Unknown');
  });

  it('returns default fallback for undefined', () => {
    assert.equal(formatTimestamp(undefined), 'Unknown');
  });

  it('returns default fallback for empty string', () => {
    assert.equal(formatTimestamp(''), 'Unknown');
  });

  it('accepts a custom fallback string', () => {
    assert.equal(formatTimestamp(null, 'Not yet refreshed'), 'Not yet refreshed');
  });

  it('passes through a non-parseable value unchanged', () => {
    assert.equal(formatTimestamp('not-a-date'), 'not-a-date');
  });

  it('formats a valid ISO timestamp via toLocaleString', () => {
    const iso = '2026-01-15T10:30:00.000Z';
    const expected = new Date(iso).toLocaleString();
    assert.equal(formatTimestamp(iso), expected);
  });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('returns Unknown size for null', () => {
    assert.equal(formatBytes(null), 'Unknown size');
  });

  it('returns Unknown size for undefined', () => {
    assert.equal(formatBytes(undefined), 'Unknown size');
  });

  it('returns Unknown size for NaN', () => {
    assert.equal(formatBytes(NaN), 'Unknown size');
  });

  it('returns Unknown size for 0', () => {
    assert.equal(formatBytes(0), 'Unknown size');
  });

  it('returns Unknown size for negative values', () => {
    assert.equal(formatBytes(-1024), 'Unknown size');
  });

  it('formats sub-kilobyte values in bytes with no decimal', () => {
    assert.equal(formatBytes(512), '512 B');
  });

  it('formats 1023 bytes as bytes', () => {
    assert.equal(formatBytes(1023), '1023 B');
  });

  it('formats exactly 1 KB with one decimal place', () => {
    assert.equal(formatBytes(1024), '1.0 KB');
  });

  it('formats 1.5 KB with one decimal place', () => {
    assert.equal(formatBytes(1536), '1.5 KB');
  });

  it('formats 10 KB or more without a decimal', () => {
    assert.equal(formatBytes(10240), '10 KB');
  });

  it('formats exactly 1 MB with one decimal place', () => {
    assert.equal(formatBytes(1048576), '1.0 MB');
  });

  it('formats exactly 1 GB with one decimal place', () => {
    assert.equal(formatBytes(1073741824), '1.0 GB');
  });
});

// ---------------------------------------------------------------------------
// formatPath
// ---------------------------------------------------------------------------

describe('formatPath', () => {
  it('returns Unavailable for null', () => {
    assert.equal(formatPath(null), 'Unavailable');
  });

  it('returns Unavailable for undefined', () => {
    assert.equal(formatPath(undefined), 'Unavailable');
  });

  it('returns Unavailable for empty string', () => {
    assert.equal(formatPath(''), 'Unavailable');
  });

  it('returns the path unchanged', () => {
    assert.equal(formatPath('/music/albums/foo'), '/music/albums/foo');
  });
});

// ---------------------------------------------------------------------------
// formatTokenLabel
// ---------------------------------------------------------------------------

describe('formatTokenLabel', () => {
  it('returns unknown for null', () => {
    assert.equal(formatTokenLabel(null), 'unknown');
  });

  it('returns unknown for undefined', () => {
    assert.equal(formatTokenLabel(undefined), 'unknown');
  });

  it('replaces underscores with spaces', () => {
    assert.equal(formatTokenLabel('download_enqueue'), 'download enqueue');
  });

  it('replaces hyphens with spaces', () => {
    assert.equal(formatTokenLabel('ready-with-warnings'), 'ready with warnings');
  });

  it('replaces consecutive delimiters with a single space', () => {
    assert.equal(formatTokenLabel('a__b'), 'a b');
  });

  it('leaves already-spaced strings unchanged', () => {
    assert.equal(formatTokenLabel('no change'), 'no change');
  });
});

// ---------------------------------------------------------------------------
// candidateStatusLabel
// ---------------------------------------------------------------------------

describe('candidateStatusLabel', () => {
  it('returns Held for held', () => {
    assert.equal(candidateStatusLabel('held'), 'Held');
  });

  it('returns Rejected for rejected', () => {
    assert.equal(candidateStatusLabel('rejected'), 'Rejected');
  });

  it('returns Selected for selected', () => {
    assert.equal(candidateStatusLabel('selected'), 'Selected');
  });

  it('returns Downloading for downloading', () => {
    assert.equal(candidateStatusLabel('downloading'), 'Downloading');
  });

  it('returns Import pending for import_pending', () => {
    assert.equal(candidateStatusLabel('import_pending'), 'Import pending');
  });

  it('returns Applied for applied', () => {
    assert.equal(candidateStatusLabel('applied'), 'Applied');
  });

  it('returns Failed for failed', () => {
    assert.equal(candidateStatusLabel('failed'), 'Failed');
  });

  it('returns Pending for unknown status', () => {
    assert.equal(candidateStatusLabel('unknown_status'), 'Pending');
  });

  it('returns Pending for null', () => {
    assert.equal(candidateStatusLabel(null), 'Pending');
  });
});

// ---------------------------------------------------------------------------
// formatRunStatus
// ---------------------------------------------------------------------------

describe('formatRunStatus', () => {
  it('returns Running for running', () => {
    assert.equal(formatRunStatus('running'), 'Running');
  });

  it('returns Failed for failed', () => {
    assert.equal(formatRunStatus('failed'), 'Failed');
  });

  it('returns Completed for completed', () => {
    assert.equal(formatRunStatus('completed'), 'Completed');
  });

  it('returns Pending for unknown status', () => {
    assert.equal(formatRunStatus('queued'), 'Pending');
  });

  it('returns Pending for null', () => {
    assert.equal(formatRunStatus(null), 'Pending');
  });
});

// ---------------------------------------------------------------------------
// formatExecutionMode
// ---------------------------------------------------------------------------

describe('formatExecutionMode', () => {
  it('returns Queue downloads for download_enqueue', () => {
    assert.equal(formatExecutionMode('download_enqueue'), 'Queue downloads');
  });

  it('passes through unrecognised mode strings', () => {
    assert.equal(formatExecutionMode('some_other_mode'), 'some_other_mode');
  });

  it('returns Download for null', () => {
    assert.equal(formatExecutionMode(null), 'Download');
  });

  it('returns Download for undefined', () => {
    assert.equal(formatExecutionMode(undefined), 'Download');
  });
});

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------

describe('formatPercent', () => {
  it('formats an integer percentage', () => {
    assert.equal(formatPercent(75), '75%');
  });

  it('formats a zero percentage', () => {
    assert.equal(formatPercent(0), '0%');
  });

  it('formats 100%', () => {
    assert.equal(formatPercent(100), '100%');
  });

  it('returns Unavailable for Infinity', () => {
    assert.equal(formatPercent(Infinity), 'Unavailable');
  });

  it('returns Unavailable for NaN', () => {
    assert.equal(formatPercent(NaN), 'Unavailable');
  });

  it('returns Unavailable for null', () => {
    assert.equal(formatPercent(null), 'Unavailable');
  });
});

// ---------------------------------------------------------------------------
// candidateStatusTone
// ---------------------------------------------------------------------------

describe('candidateStatusTone', () => {
  it('returns success for applied', () => {
    assert.equal(candidateStatusTone('applied'), 'success');
  });
  it('returns danger for failed', () => {
    assert.equal(candidateStatusTone('failed'), 'danger');
  });
  it('returns danger for rejected', () => {
    assert.equal(candidateStatusTone('rejected'), 'danger');
  });
  it('returns warning for downloading', () => {
    assert.equal(candidateStatusTone('downloading'), 'warning');
  });
  it('returns info for held', () => {
    assert.equal(candidateStatusTone('held'), 'info');
  });
  it('returns info for import_pending', () => {
    assert.equal(candidateStatusTone('import_pending'), 'info');
  });
  it('returns info for selected', () => {
    assert.equal(candidateStatusTone('selected'), 'info');
  });
  it('returns undefined for unknown status', () => {
    assert.equal(candidateStatusTone('new_state'), undefined);
  });
  it('returns undefined for null', () => {
    assert.equal(candidateStatusTone(null), undefined);
  });
  it('applied and rejected never share a tone', () => {
    assert.notEqual(candidateStatusTone('applied'), candidateStatusTone('rejected'));
  });
});

// ---------------------------------------------------------------------------
// getRunStatusClass
// ---------------------------------------------------------------------------

describe('getRunStatusClass', () => {
  it('returns review-status-selected for running', () => {
    assert.equal(getRunStatusClass('running'), 'review-status-selected');
  });

  it('returns review-status-failed for failed', () => {
    assert.equal(getRunStatusClass('failed'), 'review-status-failed');
  });

  it('returns review-status-held for completed', () => {
    assert.equal(getRunStatusClass('completed'), 'review-status-held');
  });

  it('returns review-status-pending for unknown status', () => {
    assert.equal(getRunStatusClass('unknown'), 'review-status-pending');
  });

  it('returns review-status-pending for null', () => {
    assert.equal(getRunStatusClass(null), 'review-status-pending');
  });
});

// ---------------------------------------------------------------------------
// getApplyItemStatusClass
// ---------------------------------------------------------------------------

describe('getApplyItemStatusClass', () => {
  it('returns review-status-failed for blocked', () => {
    assert.equal(getApplyItemStatusClass('blocked'), 'review-status-failed');
  });

  it('returns review-status-failed for apply_failed', () => {
    assert.equal(getApplyItemStatusClass('apply_failed'), 'review-status-failed');
  });

  it('returns review-status-held for applied_with_warnings', () => {
    assert.equal(getApplyItemStatusClass('applied_with_warnings'), 'review-status-held');
  });

  it('returns review-status-held for ready_with_warnings', () => {
    assert.equal(getApplyItemStatusClass('ready_with_warnings'), 'review-status-held');
  });

  it('returns review-status-selected for applied', () => {
    assert.equal(getApplyItemStatusClass('applied'), 'review-status-selected');
  });

  it('returns review-status-selected for unknown status', () => {
    assert.equal(getApplyItemStatusClass('unknown'), 'review-status-selected');
  });
});

// ---------------------------------------------------------------------------
// getApplyItemStatusLabel
// ---------------------------------------------------------------------------

describe('getApplyItemStatusLabel', () => {
  it('returns Blocked for blocked', () => {
    assert.equal(getApplyItemStatusLabel('blocked'), 'Blocked');
  });

  it('returns Apply failed for apply_failed', () => {
    assert.equal(getApplyItemStatusLabel('apply_failed'), 'Apply failed');
  });

  it('returns Applied with warnings for applied_with_warnings', () => {
    assert.equal(getApplyItemStatusLabel('applied_with_warnings'), 'Applied with warnings');
  });

  it('returns Applied for applied', () => {
    assert.equal(getApplyItemStatusLabel('applied'), 'Applied');
  });

  it('returns Ready with warnings for ready_with_warnings', () => {
    assert.equal(getApplyItemStatusLabel('ready_with_warnings'), 'Ready with warnings');
  });

  it('returns Ready for unknown status', () => {
    assert.equal(getApplyItemStatusLabel('unknown'), 'Ready');
  });

  it('returns Ready for null', () => {
    assert.equal(getApplyItemStatusLabel(null), 'Ready');
  });
});

// ---------------------------------------------------------------------------
// getApplyOperationStatusClass
// ---------------------------------------------------------------------------

describe('getApplyOperationStatusClass', () => {
  it('returns review-status-failed for failed', () => {
    assert.equal(getApplyOperationStatusClass('failed'), 'review-status-failed');
  });

  it('returns review-status-pending for not_attempted', () => {
    assert.equal(getApplyOperationStatusClass('not_attempted'), 'review-status-pending');
  });

  it('returns review-status-held for skipped', () => {
    assert.equal(getApplyOperationStatusClass('skipped'), 'review-status-held');
  });

  it('returns review-status-selected for applied and unknown', () => {
    assert.equal(getApplyOperationStatusClass('applied'), 'review-status-selected');
    assert.equal(getApplyOperationStatusClass('unknown'), 'review-status-selected');
  });
});

// ---------------------------------------------------------------------------
// getApplyOperationStatusLabel
// ---------------------------------------------------------------------------

describe('getApplyOperationStatusLabel', () => {
  it('returns Failed for failed', () => {
    assert.equal(getApplyOperationStatusLabel('failed'), 'Failed');
  });

  it('returns Not attempted for not_attempted', () => {
    assert.equal(getApplyOperationStatusLabel('not_attempted'), 'Not attempted');
  });

  it('returns Skipped for skipped', () => {
    assert.equal(getApplyOperationStatusLabel('skipped'), 'Skipped');
  });

  it('returns Applied for unknown status', () => {
    assert.equal(getApplyOperationStatusLabel('unknown'), 'Applied');
  });

  it('returns Applied for null', () => {
    assert.equal(getApplyOperationStatusLabel(null), 'Applied');
  });
});

// ---------------------------------------------------------------------------
// getApplyOperationStepLabel
// ---------------------------------------------------------------------------

describe('getApplyOperationStepLabel', () => {
  it('returns Finalize for finalize', () => {
    assert.equal(getApplyOperationStepLabel('finalize'), 'Finalize');
  });

  it('returns Stage for any other value', () => {
    assert.equal(getApplyOperationStepLabel('stage'), 'Stage');
    assert.equal(getApplyOperationStepLabel(null), 'Stage');
    assert.equal(getApplyOperationStepLabel(undefined), 'Stage');
  });
});

// ---------------------------------------------------------------------------
// formatApplyMutationMode
// ---------------------------------------------------------------------------

describe('formatApplyMutationMode', () => {
  it('returns hardlink for hardlink', () => {
    assert.equal(formatApplyMutationMode('hardlink'), 'hardlink');
  });

  it('returns copy for copy', () => {
    assert.equal(formatApplyMutationMode('copy'), 'copy');
  });

  it('returns move as default for any other value', () => {
    assert.equal(formatApplyMutationMode('move'), 'move');
    assert.equal(formatApplyMutationMode(null), 'move');
    assert.equal(formatApplyMutationMode(undefined), 'move');
    assert.equal(formatApplyMutationMode('symlink'), 'move');
  });
});

// ---------------------------------------------------------------------------
// formatApplyFallbackReason
// ---------------------------------------------------------------------------

describe('formatApplyFallbackReason', () => {
  it('returns a filesystem message for cross_device', () => {
    assert.equal(
      formatApplyFallbackReason('cross_device'),
      'the source and destination were on different filesystem devices',
    );
  });

  it('passes through an unknown reason unchanged', () => {
    assert.equal(formatApplyFallbackReason('permission_denied'), 'permission_denied');
  });

  it('returns a default message for null', () => {
    assert.equal(
      formatApplyFallbackReason(null),
      'the filesystem could not honor the requested mutation mode',
    );
  });

  it('returns a default message for empty string', () => {
    assert.equal(
      formatApplyFallbackReason(''),
      'the filesystem could not honor the requested mutation mode',
    );
  });
});

// ---------------------------------------------------------------------------
// describeApplyOperation
// ---------------------------------------------------------------------------

describe('describeApplyOperation', () => {
  it('returns errorMessage when present', () => {
    const op = { errorMessage: 'Disk full', stepType: 'stage', status: 'failed' };
    assert.equal(describeApplyOperation(op), 'Disk full');
  });

  it('describes a fallback pathway when fallbackFromMode is present', () => {
    const op = {
      stepType: 'stage',
      status: 'completed',
      fallbackFromMode: 'hardlink',
      appliedMode: 'copy',
      fallbackReason: 'cross_device',
    };
    const result = describeApplyOperation(op);
    assert.ok(result.includes('hardlink'), 'should mention fallback-from mode');
    assert.ok(result.includes('copy'), 'should mention applied mode');
    assert.ok(result.includes('filesystem devices'), 'should include fallback reason');
  });

  it('describes a normal step when no error and no fallback', () => {
    const op = { stepType: 'finalize', status: 'completed', transport: 'direct' };
    const result = describeApplyOperation(op);
    assert.ok(result.includes('Finalize'), 'should include step label');
    assert.ok(result.includes('direct'), 'should include transport');
  });

  it('uses planned apply when transport is absent', () => {
    const op = { stepType: 'stage', status: 'pending' };
    assert.ok(describeApplyOperation(op).includes('planned apply'));
  });

  it('handles null gracefully', () => {
    assert.equal(typeof describeApplyOperation(null), 'string');
  });
});

// ---------------------------------------------------------------------------
// getApplyItemOperationHistory
// ---------------------------------------------------------------------------

describe('getApplyItemOperationHistory', () => {
  it('returns importOperations when non-empty', () => {
    const ops = [{ id: 1 }, { id: 2 }];
    const item = { importOperations: ops };
    assert.deepEqual(getApplyItemOperationHistory(item), ops);
  });

  it('falls back to applySnapshot fileOperations when importOperations is empty', () => {
    const ops = [{ id: 3 }];
    const item = {
      importOperations: [],
      applySnapshot: { fileOperations: ops },
    };
    assert.deepEqual(getApplyItemOperationHistory(item), ops);
  });

  it('returns empty array when both sources are absent', () => {
    assert.deepEqual(getApplyItemOperationHistory({}), []);
  });

  it('returns empty array for null', () => {
    assert.deepEqual(getApplyItemOperationHistory(null), []);
  });
});

// ---------------------------------------------------------------------------
// canStartApplyRun
// ---------------------------------------------------------------------------

describe('canStartApplyRun', () => {
  it('returns true when there is no current run', () => {
    assert.equal(canStartApplyRun(null, 5), true);
  });

  it('returns true when run is completed and candidates are waiting', () => {
    assert.equal(canStartApplyRun({ status: 'completed' }, 3), true);
  });

  it('returns true when run failed and candidates are waiting', () => {
    assert.equal(canStartApplyRun({ status: 'failed' }, 1), true);
  });

  it('returns false when run is pending', () => {
    assert.equal(canStartApplyRun({ status: 'pending' }, 5), false);
  });

  it('returns false when run is running', () => {
    assert.equal(canStartApplyRun({ status: 'running' }, 5), false);
  });

  it('returns false when run is completed but no candidates are waiting', () => {
    assert.equal(canStartApplyRun({ status: 'completed' }, 0), false);
  });
});

// ---------------------------------------------------------------------------
// formatSourceProvider
// ---------------------------------------------------------------------------

describe('formatSourceProvider', () => {
  it('returns Soulseek for slskd', () => {
    assert.equal(formatSourceProvider('slskd'), 'Soulseek');
  });
  it('returns MusicBrainz for musicbrainz', () => {
    assert.equal(formatSourceProvider('musicbrainz'), 'MusicBrainz');
  });
  it('does not expose raw slskd token', () => {
    assert.notEqual(formatSourceProvider('slskd'), 'slskd');
  });
  it('does not expose raw musicbrainz token', () => {
    assert.notEqual(formatSourceProvider('musicbrainz'), 'musicbrainz');
  });
  it('returns em dash for null', () => {
    assert.equal(formatSourceProvider(null), '\u2014');
  });
  it('returns em dash for undefined', () => {
    assert.equal(formatSourceProvider(undefined), '\u2014');
  });
  it('returns em dash for empty string', () => {
    assert.equal(formatSourceProvider(''), '\u2014');
  });
  it('title-cases unknown providers as fallback', () => {
    const result = formatSourceProvider('some_provider');
    assert.equal(result[0], result[0].toUpperCase());
  });
  it('returns Spotify for spotify', () => {
    assert.equal(formatSourceProvider('spotify'), 'Spotify');
  });
  it('returns YouTube for youtube', () => {
    assert.equal(formatSourceProvider('youtube'), 'YouTube');
  });
  it('returns Apple Music for apple_music', () => {
    assert.equal(formatSourceProvider('apple_music'), 'Apple Music');
  });
  it('does not expose raw youtube token', () => {
    assert.notEqual(formatSourceProvider('youtube'), 'youtube');
  });
  it('does not expose raw apple_music token', () => {
    assert.notEqual(formatSourceProvider('apple_music'), 'apple_music');
  });
});

// ---------------------------------------------------------------------------
// formatCandidateCountLabel
// ---------------------------------------------------------------------------

describe('formatCandidateCountLabel', () => {
  it('returns singular for 1 candidate', () => {
    assert.equal(formatCandidateCountLabel(1), '1 candidate');
  });
  it('returns plural for 0 candidates', () => {
    assert.equal(formatCandidateCountLabel(0), '0 candidates');
  });
  it('returns plural for 2 candidates', () => {
    assert.equal(formatCandidateCountLabel(2), '2 candidates');
  });
  it('returns plural for 100 candidates', () => {
    assert.equal(formatCandidateCountLabel(100), '100 candidates');
  });
  it('includes the count in the label', () => {
    assert.ok(formatCandidateCountLabel(5).includes('5'));
  });
  it('does not return singular for 0', () => {
    assert.notEqual(formatCandidateCountLabel(0), '1 candidate');
  });
});
