/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../api-error.js';

export function createBackupArtifactBusyError() {
  return createApiError(409, 'backup_artifact_operation_busy', 'Another backup file operation is active. Try again after it finishes.');
}

/** Retain local ownership through returned work and database-client cleanup. */
export function createBackupArtifactDrainGate() {
  let active = false;

  async function run(work, { onBusy } = {}) {
    if (active) {
      if (onBusy) return onBusy();
      throw createBackupArtifactBusyError();
    }

    // Reserve synchronously, before checkout or any other asynchronous admission.
    active = true;
    try {
      return await work();
    } finally {
      active = false;
    }
  }

  return { run };
}

// All production facade instances in this process must share the same owner.
// PostgreSQL still coordinates healthy sessions in other processes. This gate
// does not provide cross-process fencing after a database connection is lost.
export const backupArtifactDrainGate = createBackupArtifactDrainGate();
