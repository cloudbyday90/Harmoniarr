/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const backupRecoveryBatchSize = 25;
export const backupRecoveryFileByteLimit = 16 * 1024 * 1024;
export const backupRecoveryAdmissionMs = 5000;
export const backupRecoveryCountKeys = Object.freeze(['completedCount', 'deferredCount', 'awaitingConfirmationCount', 'abandonedCount']);
export const emptyBackupRecoveryCounts = () => Object.fromEntries(backupRecoveryCountKeys.map(key => [key, 0]));
export function validateBackupRecoveryWindow({ through, after = null }) {
  const timestamp = value => typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)) && !value.includes('\0');
  if (!timestamp(through) || after && (!timestamp(after.createdAt) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(after.id))) throw new TypeError('Invalid backup recovery window');
}
