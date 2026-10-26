/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createBackupRecoveryRunStore } from './backup-recovery-run-store.js';
import { createBackupRecoveryStartupService } from './backup-recovery-startup-service.js';
import { createBackupRecoveryWorker } from './backup-recovery-worker.js';
import { createMaintenanceLockOperationPauseService } from './maintenance-lock-operation-pause-service.js';
import { backupRecoveryCountKeys } from './backup-recovery-policy.js';
import { hasIncompleteBackupRecoveryProgress } from './backup-recovery-progress-policy.js';

export function createBackupRecoveryModule({ backupArtifactFileOperationService, listActiveMaintenanceLocks, runStore = createBackupRecoveryRunStore(), onError } = {}) {
  const startupService = createBackupRecoveryStartupService({ queueStartupRecovery: runStore.queueStartupRecovery, onError });
  const worker = createBackupRecoveryWorker({ runStore, recoveryService: backupArtifactFileOperationService, operationPauseService: createMaintenanceLockOperationPauseService({ listActiveMaintenanceLocks }) });
  async function getStatus() {
    const [run, counts] = await Promise.all([runStore.getLatestRun(), runStore.getJournalCounts()]);
    const progress = Object.fromEntries([...backupRecoveryCountKeys, 'processedCount'].map(key => [key, Number.isSafeInteger(run?.summary?.[key]) ? run.summary[key] : 0]));
    return { ...counts, ...progress, progressMayBeIncomplete: hasIncompleteBackupRecoveryProgress(run?.summary),
      admissionState: startupService.getState(), state: run?.status ?? 'not_started', runId: run?.id ?? null, finishedAt: run?.finishedAt ?? null };
  }
  return { startupService, worker, getStatus, runStore };
}
