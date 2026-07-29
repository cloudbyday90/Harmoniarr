/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Builds bounded recovery status for Settings. The browser only describes
 * server-supplied inventory and preview data; it never authorizes a restore.
 *
 * @param {{ backupArtifacts?: Array<{ encrypted?: boolean }>, backupErrorMessage?: string, hasActiveLocks?: boolean, isLoadingBackups?: boolean, isLoadingPreview?: boolean, previewErrorMessage?: string, selectedBackupPreview?: { canApplyRestore?: boolean } | null }} input
 * @returns {{ checks: Array<{ label: string, statusLabel: string, tone: string }>, message: string, statusLabel: string, tone: string }}
 */
export function buildSettingsRecoveryPosture({
  backupArtifacts = [],
  backupErrorMessage = '',
  hasActiveLocks = false,
  isLoadingBackups = false,
  isLoadingPreview = false,
  previewErrorMessage = '',
  selectedBackupPreview = null,
} = {}) {
  if (isLoadingBackups) {
    return {
      checks: [],
      message: 'Checking saved backups and recovery state.',
      statusLabel: 'Checking',
      tone: 'info',
    };
  }

  if (backupErrorMessage) {
    return {
      checks: [],
      message: 'Saved backup status is unavailable. Refresh before relying on recovery information.',
      statusLabel: 'Needs attention',
      tone: 'danger',
    };
  }

  if (!backupArtifacts.length) {
    return {
      checks: [{ label: 'Saved backup', statusLabel: 'None', tone: 'warning' }],
      message: 'No saved backup is available yet. Create one before changing important settings or library data.',
      statusLabel: 'Backup needed',
      tone: 'warning',
    };
  }

  const latestBackup = backupArtifacts[0];
  const protection = latestBackup?.encrypted === true
    ? { statusLabel: 'Encrypted', tone: 'success' }
    : { statusLabel: 'Not encrypted', tone: 'warning' };
  const restoreCheck = isLoadingPreview
    ? { statusLabel: 'Checking', tone: 'info' }
    : previewErrorMessage
      ? { statusLabel: 'Unavailable', tone: 'danger' }
      : selectedBackupPreview?.canApplyRestore
        ? { statusLabel: 'Ready', tone: 'success' }
        : { statusLabel: 'Review needed', tone: 'warning' };
  const lockCheck = hasActiveLocks
    ? { statusLabel: 'Maintenance active', tone: 'warning' }
    : { statusLabel: 'Clear', tone: 'success' };

  if (hasActiveLocks) {
    return {
      checks: [
        { label: 'Latest backup', ...protection },
        { label: 'Restore check', ...restoreCheck },
        { label: 'Maintenance', ...lockCheck },
      ],
      message: 'A recovery maintenance task is active. Background work is paused until it completes or is resolved.',
      statusLabel: 'Maintenance active',
      tone: 'warning',
    };
  }

  if (latestBackup?.encrypted !== true) {
    return {
      checks: [
        { label: 'Latest backup', ...protection },
        { label: 'Restore check', ...restoreCheck },
        { label: 'Maintenance', ...lockCheck },
      ],
      message: 'A backup is available, but it is not encrypted. Protect the backup storage before treating it as a recovery copy.',
      statusLabel: 'Protection review',
      tone: 'warning',
    };
  }

  return {
    checks: [
      { label: 'Latest backup', ...protection },
      { label: 'Restore check', ...restoreCheck },
      { label: 'Maintenance', ...lockCheck },
    ],
    message: 'A protected backup is available. Review its restore check before applying it.',
    statusLabel: 'Protected backup available',
    tone: 'success',
  };
}
