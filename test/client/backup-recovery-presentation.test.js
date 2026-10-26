/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackupRecoveryStatus } from '../../src/client/lib/backup-recovery-presentation.js';
import { buildOperationSummaryEntries, getOperationRunOperatorSummary } from '../../src/client/lib/operation-run-presentation.js';
import { buildOperationRunLinkTarget } from '../../src/client/lib/operation-run-link-targets.js';

test('interrupted scan totals are distinguished from the current unfinished journal', () => {
  for (const unfinishedCount of [0, 4]) {
    const result = buildBackupRecoveryStatus({ state: 'completed', unfinishedCount, confirmationCount: 1, progressMayBeIncomplete: true });
    assert.match(result.message, /Recorded job totals may omit work completed before an interruption/u);
    assert.match(result.message, /Unfinished counts reflect the last status check/u);
  }
});

test('finished backup scan distinguishes unresolved operations from a clear journal', () => {
  const held = buildBackupRecoveryStatus({ state: 'completed', unfinishedCount: 4, confirmationCount: 1 });
  assert.equal(held.state, 'attention');
  assert.match(held.message, /4 unfinished.*1 need confirmation/u);
  assert.match(buildBackupRecoveryStatus({ state: 'completed', unfinishedCount: 0 }).message, /last status check/u);
  assert.match(getOperationRunOperatorSummary({ operationType: 'backup_artifact_recovery', status: 'completed', summary: { deferredCount: 3 } }), /need review/u);
  });

test('unknown and failed admission status remain actionable without exposing private data', () => {
  assert.equal(buildBackupRecoveryStatus(null, { loading: true }).state, 'loading');
  assert.equal(buildBackupRecoveryStatus(null).state, 'unknown');
  const failed = buildBackupRecoveryStatus({ admissionState: 'failed', error: '/private/backup' });
  assert.match(failed.message, /could not be queued/u);
  assert.doesNotMatch(failed.message, /private/u);
  assert.equal(buildBackupRecoveryStatus({ state: 'pending', unfinishedCount: NaN }).state, 'pending');
  });

test('backup job uses canonical detail navigation and hides internal continuation facts', () => {
  assert.ok(buildOperationRunLinkTarget({ operationType: 'backup_artifact_recovery', runId: 'run-1' }));
  assert.deepEqual(buildOperationSummaryEntries({ processedCount: 25, backupRecoveryThrough: 'private', backupRecoveryAfter: { id: 'private' } }), [{ key: 'processedCount', value: 25 }]);
  });
