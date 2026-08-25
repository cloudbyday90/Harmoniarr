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
  buildImportApplyLibraryHandoffNotice,
  buildImportApplyReadinessNotice,
  buildImportExecutionRefreshNotice,
  buildLiveTransferSyncNotice,
  canStartApplyRun,
  canStartExecutionRun,
  canStartMediaInspectionRun,
  describeApplyOperation,
  formatApplyFallbackReason,
  formatApplyMutationMode,
  formatBytes,
  formatCandidateCountLabel,
  formatExecutionMode,
  formatLiveTransferStatus,
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
  getExecutionItemStatusClass,
  getExecutionItemStatusLabel,
  getHeartbeatOutcomeLabel,
  getHeartbeatSkipReasonLabel,
  getLatestTransferSummary,
  getLiveTransferStatusClass,
  getPersistedMissingTransfer,
  getPersistedTransferObservation,
  getRunStatusClass,
  isTransferSnapshotDegraded,
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
  it('returns true when there is no current run and candidates are waiting', () => {
    assert.equal(canStartApplyRun(null, 5), true);
  });

  it('returns false when there is no current run but no candidates are waiting', () => {
    assert.equal(canStartApplyRun(null, 0), false);
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
// buildImportApplyReadinessNotice
// ---------------------------------------------------------------------------

describe('buildImportApplyReadinessNotice', () => {
  it('returns null when no downloads are ready to import', () => {
    assert.equal(
      buildImportApplyReadinessNotice({ currentRun: null, importPendingCandidateCount: 0 }),
      null,
    );
  });

  it('returns null while an apply run is active', () => {
    assert.equal(
      buildImportApplyReadinessNotice({
        currentRun: { status: 'running' },
        importPendingCandidateCount: 2,
      }),
      null,
    );
  });

  it('explains a single ready download', () => {
    assert.deepEqual(
      buildImportApplyReadinessNotice({
        currentRun: null,
        importPendingCandidateCount: 1,
      }),
      {
        tone: 'success',
        title: '1 download is ready to add',
        message: 'Use Add downloads to stage and commit this completed download into the library.',
      },
    );
  });

  it('explains multiple ready downloads after a previous failed apply run', () => {
    assert.deepEqual(
      buildImportApplyReadinessNotice({
        currentRun: { status: 'failed' },
        importPendingCandidateCount: 3,
      }),
      {
        tone: 'warning',
        title: '3 downloads are ready to add',
        message: 'Use Add downloads to stage and commit these completed downloads into the library.',
      },
    );
  });
});

// ---------------------------------------------------------------------------
// buildImportApplyLibraryHandoffNotice
// ---------------------------------------------------------------------------

describe('buildImportApplyLibraryHandoffNotice', () => {
  it('returns null when there is no completed apply run', () => {
    assert.equal(buildImportApplyLibraryHandoffNotice(null), null);
    assert.equal(buildImportApplyLibraryHandoffNotice({ status: 'running', appliedCount: 1 }), null);
    assert.equal(buildImportApplyLibraryHandoffNotice({ status: 'failed', appliedCount: 1 }), null);
  });

  it('returns null when a completed apply run did not apply releases', () => {
    assert.equal(
      buildImportApplyLibraryHandoffNotice({
        appliedCount: 0,
        appliedWithWarningsCount: 0,
        status: 'completed',
      }),
      null,
    );
  });

  it('builds a complete Library handoff for applied releases', () => {
    assert.deepEqual(
      buildImportApplyLibraryHandoffNotice({
        appliedCount: 1,
        appliedWithWarningsCount: 0,
        status: 'completed',
      }),
      {
        tone: 'success',
        title: '1 release is in the library',
        message: 'Open Library to confirm the newly added release in the complete library view.',
        location: {
          name: 'library',
          query: {
            focus: 'library',
            status: 'complete',
          },
        },
      },
    );
  });

  it('uses a warning tone when completed apply includes warning outcomes', () => {
    assert.deepEqual(
      buildImportApplyLibraryHandoffNotice({
        appliedCount: 2,
        appliedWithWarningsCount: 1,
        status: 'completed',
      }),
      {
        tone: 'warning',
        title: '3 releases are in the library',
        message: 'Open Library to confirm the added release and review any warning state after the next scan.',
        location: {
          name: 'library',
          query: {
            focus: 'library',
            status: 'complete',
          },
        },
      },
    );
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

// ---------------------------------------------------------------------------
// getExecutionItemStatusClass
// ---------------------------------------------------------------------------

describe('getExecutionItemStatusClass', () => {
  it('returns failed class for "blocked"', () => {
    assert.equal(getExecutionItemStatusClass('blocked'), 'review-status-failed');
  });

  it('returns failed class for "queue_failed"', () => {
    assert.equal(getExecutionItemStatusClass('queue_failed'), 'review-status-failed');
  });

  it('returns failed class for a terminal provider failure', () => {
    assert.equal(getExecutionItemStatusClass('failed'), 'review-status-failed');
  });

  it('returns applied class for a completed provider transfer', () => {
    assert.equal(getExecutionItemStatusClass('completed'), 'review-status-applied');
  });

  it('returns held class for "queued_with_warnings"', () => {
    assert.equal(getExecutionItemStatusClass('queued_with_warnings'), 'review-status-held');
  });

  it('returns held class for "ready_with_warnings"', () => {
    assert.equal(getExecutionItemStatusClass('ready_with_warnings'), 'review-status-held');
  });

  it('returns selected class for "queued"', () => {
    assert.equal(getExecutionItemStatusClass('queued'), 'review-status-selected');
  });

  it('returns selected class for unknown value', () => {
    assert.equal(getExecutionItemStatusClass('other'), 'review-status-selected');
  });

  it('returns selected class for null', () => {
    assert.equal(getExecutionItemStatusClass(null), 'review-status-selected');
  });
});

// ---------------------------------------------------------------------------
// getExecutionItemStatusLabel
// ---------------------------------------------------------------------------

describe('getExecutionItemStatusLabel', () => {
  it('returns "Blocked" for "blocked"', () => {
    assert.equal(getExecutionItemStatusLabel('blocked'), 'Blocked');
  });

  it('returns "Queue failed" for "queue_failed"', () => {
    assert.equal(getExecutionItemStatusLabel('queue_failed'), 'Queue failed');
  });

  it('returns an explicit confirmation label for an interrupted provider handoff', () => {
    assert.equal(getExecutionItemStatusLabel('awaiting_confirmation'), 'Confirming download request');
  });

  it('returns "Queued with warnings" for "queued_with_warnings"', () => {
    assert.equal(getExecutionItemStatusLabel('queued_with_warnings'), 'Queued with warnings');
  });

  it('returns "Queued" for "queued"', () => {
    assert.equal(getExecutionItemStatusLabel('queued'), 'Queued');
  });

  it('returns a current provider transfer label for completed status', () => {
    assert.equal(getExecutionItemStatusLabel('completed'), 'Completed');
  });

  it('returns a current provider transfer label for downloading status', () => {
    assert.equal(getExecutionItemStatusLabel('downloading'), 'Downloading');
  });

  it('returns "Ready with warnings" for "ready_with_warnings"', () => {
    assert.equal(getExecutionItemStatusLabel('ready_with_warnings'), 'Ready with warnings');
  });

  it('returns "Ready" for unknown value', () => {
    assert.equal(getExecutionItemStatusLabel('other'), 'Ready');
  });

  it('returns "Ready" for null', () => {
    assert.equal(getExecutionItemStatusLabel(null), 'Ready');
  });
});

// ---------------------------------------------------------------------------
// formatLiveTransferStatus
// ---------------------------------------------------------------------------

describe('formatLiveTransferStatus', () => {
  it('returns "Not reconciled" for null', () => {
    assert.equal(formatLiveTransferStatus(null), 'Not reconciled');
  });

  it('returns "Not reconciled" for undefined', () => {
    assert.equal(formatLiveTransferStatus(undefined), 'Not reconciled');
  });

  it('returns "Active" for status active', () => {
    assert.equal(formatLiveTransferStatus({ status: 'active' }), 'Active');
  });

  it('returns "Queued remotely" for status queued', () => {
    assert.equal(formatLiveTransferStatus({ status: 'queued' }), 'Queued remotely');
  });

  it('returns "Completed" for status completed', () => {
    assert.equal(formatLiveTransferStatus({ status: 'completed' }), 'Completed');
  });

  it('returns "Failed" for status failed', () => {
    assert.equal(formatLiveTransferStatus({ status: 'failed' }), 'Failed');
  });

  it('returns "Orphaned" for not_found past grace period', () => {
    assert.equal(
      formatLiveTransferStatus({ status: 'not_found', missingTransfer: { isPastGracePeriod: true } }),
      'Orphaned',
    );
  });

  it('returns "Missing remotely" for not_found within grace period', () => {
    assert.equal(
      formatLiveTransferStatus({ status: 'not_found', missingTransfer: { isPastGracePeriod: false } }),
      'Missing remotely',
    );
  });

  it('returns "Missing remotely" for not_found with no missingTransfer', () => {
    assert.equal(formatLiveTransferStatus({ status: 'not_found' }), 'Missing remotely');
  });

  it('returns "Missing" for unknown status', () => {
    assert.equal(formatLiveTransferStatus({ status: 'unknown' }), 'Missing');
  });
});

// ---------------------------------------------------------------------------
// getLiveTransferStatusClass
// ---------------------------------------------------------------------------

describe('getLiveTransferStatusClass', () => {
  it('returns pending class for null', () => {
    assert.equal(getLiveTransferStatusClass(null), 'review-status-pending');
  });

  it('returns selected class for active', () => {
    assert.equal(getLiveTransferStatusClass({ status: 'active' }), 'review-status-selected');
  });

  it('returns pending class for queued', () => {
    assert.equal(getLiveTransferStatusClass({ status: 'queued' }), 'review-status-pending');
  });

  it('returns held class for completed', () => {
    assert.equal(getLiveTransferStatusClass({ status: 'completed' }), 'review-status-held');
  });

  it('returns failed class for failed', () => {
    assert.equal(getLiveTransferStatusClass({ status: 'failed' }), 'review-status-failed');
  });

  it('returns failed class for not_found past grace period', () => {
    assert.equal(
      getLiveTransferStatusClass({ status: 'not_found', missingTransfer: { isPastGracePeriod: true } }),
      'review-status-failed',
    );
  });

  it('returns pending class for not_found within grace period', () => {
    assert.equal(
      getLiveTransferStatusClass({ status: 'not_found', missingTransfer: { isPastGracePeriod: false } }),
      'review-status-pending',
    );
  });

  it('returns pending class for unknown status', () => {
    assert.equal(getLiveTransferStatusClass({ status: 'other' }), 'review-status-pending');
  });
});

// ---------------------------------------------------------------------------
// getPersistedTransferObservation
// ---------------------------------------------------------------------------

describe('getPersistedTransferObservation', () => {
  it('returns null for null item', () => {
    assert.equal(getPersistedTransferObservation(null), null);
  });

  it('returns null for undefined item', () => {
    assert.equal(getPersistedTransferObservation(undefined), null);
  });

  it('returns null when field is absent', () => {
    assert.equal(getPersistedTransferObservation({}), null);
  });

  it('returns the observation when present', () => {
    const obs = { summary: { status: 'completed' } };
    assert.deepEqual(getPersistedTransferObservation({ persistedTransferObservation: obs }), obs);
  });
});

// ---------------------------------------------------------------------------
// getLatestTransferSummary
// ---------------------------------------------------------------------------

describe('getLatestTransferSummary', () => {
  it('returns null for null item', () => {
    assert.equal(getLatestTransferSummary(null), null);
  });

  it('returns null when persistedTransferObservation is absent', () => {
    assert.equal(getLatestTransferSummary({}), null);
  });

  it('returns null when observation has no summary', () => {
    assert.equal(getLatestTransferSummary({ persistedTransferObservation: {} }), null);
  });

  it('returns the summary when present', () => {
    const summary = { status: 'completed', total: 3 };
    assert.deepEqual(
      getLatestTransferSummary({ persistedTransferObservation: { summary } }),
      summary,
    );
  });
});

// ---------------------------------------------------------------------------
// getPersistedMissingTransfer
// ---------------------------------------------------------------------------

describe('getPersistedMissingTransfer', () => {
  it('returns null for null item', () => {
    assert.equal(getPersistedMissingTransfer(null), null);
  });

  it('returns null for undefined item', () => {
    assert.equal(getPersistedMissingTransfer(undefined), null);
  });

  it('returns null when field is absent', () => {
    assert.equal(getPersistedMissingTransfer({}), null);
  });

  it('returns the missing transfer when present', () => {
    const mt = { missingSince: '2026-01-01T00:00:00Z' };
    assert.deepEqual(getPersistedMissingTransfer({ persistedMissingTransfer: mt }), mt);
  });
});

// ---------------------------------------------------------------------------
// buildLiveTransferSyncNotice
// ---------------------------------------------------------------------------

describe('buildLiveTransferSyncNotice', () => {
  it('returns null when a live transfer row is available', () => {
    assert.equal(
      buildLiveTransferSyncNotice({
        liveTransferSummary: { status: 'active', total: 1, active: 1 },
        liveTransfers: [{ id: 'transfer-1', username: 'peer' }],
      }),
      null,
    );
  });

  it('explains a completed summary without a live Downloader row', () => {
    assert.deepEqual(
      buildLiveTransferSyncNotice({
        liveTransferSummary: {
          completed: 1,
          status: 'completed',
          total: 1,
        },
        liveTransfers: [],
      }),
      {
        tone: 'success',
        title: 'Transfer completed in Downloader',
        message: 'The live queue no longer has a row to open because the last sync recorded this transfer as complete.',
      },
    );
  });

  it('explains a failed summary without a live Downloader row', () => {
    assert.deepEqual(
      buildLiveTransferSyncNotice({
        liveTransferSummary: {
          failed: 1,
          status: 'failed',
          total: 1,
        },
      }),
      {
        tone: 'danger',
        title: 'Transfer no longer has a live Downloader row',
        message: 'The last sync recorded a failed or rejected transfer. Use the persisted execution detail here for recovery.',
      },
    );
  });

  it('explains stale active summary evidence when no live row is visible', () => {
    assert.deepEqual(
      buildLiveTransferSyncNotice({
        liveTransferSummary: {
          active: 1,
          status: 'active',
          total: 1,
        },
      }),
      {
        tone: 'warning',
        title: 'Transfer state needs a fresh sync',
        message: 'The last summary still showed work in progress, but no live Downloader row is visible in this read model.',
      },
    );
  });

  it('falls back to persisted transfer observation summary', () => {
    assert.equal(
      buildLiveTransferSyncNotice({
        persistedTransferObservation: {
          summary: {
            completed: 1,
            status: 'completed',
            total: 1,
          },
        },
      })?.title,
      'Transfer completed in Downloader',
    );
  });
});

// ---------------------------------------------------------------------------
// buildImportExecutionRefreshNotice
// ---------------------------------------------------------------------------

describe('buildImportExecutionRefreshNotice', () => {
  it('returns null without a selected execution run', () => {
    assert.equal(buildImportExecutionRefreshNotice({ currentRun: null }), null);
  });

  it('reports reconciliation in progress before run status messages', () => {
    assert.deepEqual(
      buildImportExecutionRefreshNotice({
        currentRun: { status: 'running' },
        isReconciling: true,
      }),
      {
        message: 'Checking Downloader for the latest accepted, active, completed, failed, or missing transfer evidence.',
        title: 'Syncing transfer state',
        tone: 'info',
      },
    );
  });

  it('explains pending execution runs as waiting for the worker', () => {
    assert.deepEqual(
      buildImportExecutionRefreshNotice({
        currentRun: { status: 'pending' },
      }),
      {
        message: 'The download run is queued. Use Refresh to check whether the worker has started, then sync transfer state once Downloader acceptance is recorded.',
        title: 'Waiting for execution worker',
        tone: 'info',
      },
    );
  });

  it('reports accepted transfer evidence as current progress', () => {
    assert.deepEqual(
      buildImportExecutionRefreshNotice({
        currentRun: {
          queuedCount: 1,
          status: 'running',
        },
      }),
      {
        message: 'Downloader transfer evidence is visible here. Use Sync transfer state to refresh provider progress without leaving Match diagnostics.',
        title: 'Transfer progress current',
        tone: 'success',
      },
    );
  });

  it('prompts manual sync for running runs without transfer observations', () => {
    assert.deepEqual(
      buildImportExecutionRefreshNotice({
        currentRun: { status: 'running' },
      }),
      {
        message: 'This run is active but no transfer observations are recorded yet. Use Sync transfer state or wait for the heartbeat to refresh provider progress.',
        title: 'Sync transfer state',
        tone: 'warning',
      },
    );
  });

  it('points failed runs with items to diagnostics', () => {
    assert.deepEqual(
      buildImportExecutionRefreshNotice({
        currentRun: {
          items: [{ id: 'item-1' }],
          queueFailedCount: 1,
          status: 'failed',
        },
      }),
      {
        message: 'Review the item diagnostics below before retrying or choosing another match.',
        title: 'Review execution diagnostics',
        tone: 'danger',
      },
    );
  });
});

// ---------------------------------------------------------------------------
// getHeartbeatOutcomeLabel
// ---------------------------------------------------------------------------

describe('getHeartbeatOutcomeLabel', () => {
  it('returns "Reconciled automatically" for "started"', () => {
    assert.equal(getHeartbeatOutcomeLabel({ state: { lastOutcome: 'started' } }), 'Reconciled automatically');
  });

  it('returns "Heartbeat error" for "error"', () => {
    assert.equal(getHeartbeatOutcomeLabel({ state: { lastOutcome: 'error' } }), 'Heartbeat error');
  });

  it('returns "Skipped" for "skipped"', () => {
    assert.equal(getHeartbeatOutcomeLabel({ state: { lastOutcome: 'skipped' } }), 'Skipped');
  });

  it('returns "Not yet recorded" for unknown outcome', () => {
    assert.equal(getHeartbeatOutcomeLabel({ state: { lastOutcome: 'other' } }), 'Not yet recorded');
  });

  it('returns "Not yet recorded" for null heartbeat', () => {
    assert.equal(getHeartbeatOutcomeLabel(null), 'Not yet recorded');
  });

  it('returns "Not yet recorded" when state is absent', () => {
    assert.equal(getHeartbeatOutcomeLabel({}), 'Not yet recorded');
  });
});

// ---------------------------------------------------------------------------
// getHeartbeatSkipReasonLabel
// ---------------------------------------------------------------------------

describe('getHeartbeatSkipReasonLabel', () => {
  it('returns the no-updates message for "not_due"', () => {
    assert.equal(getHeartbeatSkipReasonLabel('not_due'), 'No actionable transfer updates were visible.');
  });

  it('returns the tick-in-progress message for "tick_in_progress"', () => {
    assert.equal(getHeartbeatSkipReasonLabel('tick_in_progress'), 'A previous reconciliation tick was still running.');
  });

  it('returns the error message for "error"', () => {
    assert.equal(getHeartbeatSkipReasonLabel('error'), 'The last heartbeat tick failed.');
  });

  it('returns "None" for unknown reason', () => {
    assert.equal(getHeartbeatSkipReasonLabel('something_else'), 'None');
  });

  it('returns "None" for null', () => {
    assert.equal(getHeartbeatSkipReasonLabel(null), 'None');
  });
});

// ---------------------------------------------------------------------------
// canStartExecutionRun
// ---------------------------------------------------------------------------

describe('canStartExecutionRun', () => {
  it('returns true when there is no current run and candidates are selected', () => {
    assert.equal(canStartExecutionRun(null, 2), true);
  });

  it('returns false when there is no current run but no candidates are selected', () => {
    assert.equal(canStartExecutionRun(null, 0), false);
  });

  it('returns false when run is pending', () => {
    assert.equal(canStartExecutionRun({ status: 'pending' }, 5), false);
  });

  it('returns false when run is running', () => {
    assert.equal(canStartExecutionRun({ status: 'running' }, 5), false);
  });

  it('returns true when run is completed and count > 0', () => {
    assert.equal(canStartExecutionRun({ status: 'completed' }, 3), true);
  });

  it('returns false when run is completed but count is 0', () => {
    assert.equal(canStartExecutionRun({ status: 'completed' }, 0), false);
  });

  it('returns true when run is failed and count > 0', () => {
    assert.equal(canStartExecutionRun({ status: 'failed' }, 1), true);
  });
});

// ---------------------------------------------------------------------------
// canStartMediaInspectionRun
// ---------------------------------------------------------------------------

describe('canStartMediaInspectionRun', () => {
  it('returns true when there is no current run and candidates are selected', () => {
    assert.equal(canStartMediaInspectionRun(null, 2), true);
  });

  it('returns false when there is no current run but no candidates are selected', () => {
    assert.equal(canStartMediaInspectionRun(null, 0), false);
  });

  it('returns false when run is pending', () => {
    assert.equal(canStartMediaInspectionRun({ status: 'pending' }, 5), false);
  });

  it('returns false when run is running', () => {
    assert.equal(canStartMediaInspectionRun({ status: 'running' }, 5), false);
  });

  it('returns true when run is completed and count > 0', () => {
    assert.equal(canStartMediaInspectionRun({ status: 'completed' }, 3), true);
  });

  it('returns false when run is completed but count is 0', () => {
    assert.equal(canStartMediaInspectionRun({ status: 'completed' }, 0), false);
  });

  it('returns true when run is failed and count > 0', () => {
    assert.equal(canStartMediaInspectionRun({ status: 'failed' }, 1), true);
  });
});

// ---------------------------------------------------------------------------
// isTransferSnapshotDegraded
// ---------------------------------------------------------------------------

describe('isTransferSnapshotDegraded', () => {
  it('returns true when transferSnapshotUnavailable is true', () => {
    assert.equal(isTransferSnapshotDegraded({ id: 'run-1', transferSnapshotUnavailable: true }), true);
  });

  it('returns false when transferSnapshotUnavailable is false', () => {
    assert.equal(isTransferSnapshotDegraded({ id: 'run-1', transferSnapshotUnavailable: false }), false);
  });

  it('returns false when transferSnapshotUnavailable is absent', () => {
    assert.equal(isTransferSnapshotDegraded({ id: 'run-1' }), false);
  });

  it('returns false for null', () => {
    assert.equal(isTransferSnapshotDegraded(null), false);
  });

  it('returns false for undefined', () => {
    assert.equal(isTransferSnapshotDegraded(undefined), false);
  });
});
