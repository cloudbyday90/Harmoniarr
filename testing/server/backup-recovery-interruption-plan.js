/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const backupRecoveryInterruptionCases = Object.freeze([
  'crash-open-handle', 'crash-after-publication', 'crash-after-continuation',
  'cancel-open-handle', 'lease-loss-open-handle', 'maintenance-open-handle', 'shutdown-open-handle',
]);

export function validateBackupRecoveryInterruptionCase(value) {
  if (!backupRecoveryInterruptionCases.includes(value)) throw new TypeError('Invalid recovery interruption case');
  return value;
}

export function parseBackupRecoveryInterruptionMessage(value, { caseName, runId, pid }) {
  validateBackupRecoveryInterruptionCase(caseName);
  if (!value || value.caseName !== caseName || value.runId !== runId || value.processPid !== pid) throw new TypeError('Invalid recovery interruption identity');
  const keys = ['event', 'caseName', 'runId', 'processPid', 'openHandles'];
  if (value.event === 'checkpoint') {
    keys.push('backendPid');
    if (!Number.isInteger(value.backendPid) || value.backendPid <= 1) throw new TypeError('Invalid recovery backend identity');
  } else if (value.event === 'finished') {
    keys.push('drained');
    if (value.drained !== true || value.openHandles !== 0) throw new TypeError('Unverified recovery drainage');
  } else if (value.event !== 'draining') throw new TypeError('Invalid recovery interruption event');
  if (![0, 1].includes(value.openHandles) || Object.keys(value).sort().join() !== keys.sort().join()) throw new TypeError('Invalid recovery interruption shape');
  return value;
}
