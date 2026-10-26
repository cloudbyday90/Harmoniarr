/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createRuntimeReporter } from '../runtime-reporter.js';
import { buildBackupArtifactJournalFailure } from './backup-artifact-failure-policy.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function reportJournalFailure(diagnostic) {
  createRuntimeReporter({ prefix: 'harmoniarr-backup-artifact' }).writeWarning(JSON.stringify(diagnostic));
}

export function createBackupArtifactFailureRecorder({ recordFileOperationFailure, onJournalFailure = reportJournalFailure }) {
  async function recordFailure(error, operation) {
    const details = buildBackupArtifactJournalFailure(error, operation);
    let journalFailure;
    try {
      const recorded = await recordFileOperationFailure({
        fileOperationId: operation.id,
        lastErrorCode: details.code,
        lastErrorMessage: details.message,
      });
      if (recorded) return true;
      journalFailure = 'record_missing';
    } catch (journalError) {
      journalFailure = journalError?.code === 'backup_artifact_owner_lost' ? 'owner_lost' : 'write_failed';
    }
    const diagnostic = {
      code: 'backup_artifact_failure_journal_unavailable',
      operationType: ['publish', 'delete'].includes(operation.operationType) ? operation.operationType : 'unknown',
      fileOperationId: typeof operation.id === 'string' && uuidPattern.test(operation.id) ? operation.id : null,
      primaryCode: details.code,
      journalFailure,
    };
    try { await onJournalFailure(diagnostic); }
    catch { /* Secondary reporting must not replace the primary failure. */ }
    return false;
  }

  return { recordFailure };
}
