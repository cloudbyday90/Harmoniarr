/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { formatJsonOutput } from './cli-runtime.js';

export function formatArmResult(result, json) {
  if (json) return { jsonOutput: formatJsonOutput({
    success: true, command: 'arm-bootstrap-admin', status: result.status,
    recoveryCode: result.recoveryCode, expiresAt: result.expiresAt,
    recoveryPath: '/recover/bootstrap-admin', replacedExistingRun: result.replacedExistingRun, warnings: [],
  }) };
  const lines = [
    'Bootstrap-admin recovery armed.',
    `Recovery code: ${result.recoveryCode}`,
    `Expires at: ${result.expiresAt}`,
    'Next step: open /recover/bootstrap-admin and complete recovery before expiry.',
  ];
  if (result.replacedExistingRun) lines.unshift('Warning: previous armed recovery run was replaced.');
  return { textOutput: lines.join('\n') };
}

export function formatStatusResult(result, json) {
  if (json) {
    const status = { recoveryAvailable: result.recoveryAvailable };
    if (result.recoveryAvailable) {
      for (const key of ['armedVia', 'blockedByLock', 'expiresAt', 'maxAttempts', 'remainingAttempts', 'runId', 'status']) {
        status[key] = result[key];
      }
    }
    return { jsonOutput: formatJsonOutput({ success: true, command: 'bootstrap-admin-status', ...status, warnings: [] }) };
  }
  if (!result.recoveryAvailable) return { textOutput: 'No active recovery run.' };
  return { textOutput: [
    'Bootstrap-admin recovery status:', `  Status: ${result.status}`, `  Expires at: ${result.expiresAt}`,
    `  Remaining attempts: ${result.remainingAttempts}`, `  Blocked by lock: ${result.blockedByLock ? 'yes' : 'no'}`,
  ].join('\n') };
}

export function formatCancelResult(result, json) {
  return json ? { jsonOutput: formatJsonOutput({
    success: true, command: 'cancel-bootstrap-admin', status: result.status, cancelledAt: result.cancelledAt, warnings: [],
  }) } : { textOutput: `Bootstrap-admin recovery cancelled at ${result.cancelledAt}.` };
}
