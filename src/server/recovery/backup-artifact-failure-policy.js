/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { buildFilesystemFailure } from '../filesystem-failure-policy.js';

export function buildBackupArtifactJournalFailure(error, { operationType }) {
  const operation = operationType === 'publish' ? 'backup_artifact_publish'
    : operationType === 'delete' ? 'backup_artifact_delete' : null;
  if (operation) {
    const failure = buildFilesystemFailure({ code: error?.code }, { operation });
    if (failure.code !== 'filesystem_operation_failed') return { code: failure.code, message: failure.message };
  }
  const label = operationType === 'publish' ? 'Backup publication'
    : operationType === 'delete' ? 'Backup deletion' : 'Backup artifact operation';
  return { code: 'backup_artifact_file_operation_failed',
    message: `${label} could not be completed. Inspect the journal state before trying again.` };
}
