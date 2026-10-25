/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getOperationRunDescriptorDefinition } from '../../shared/operation-run-descriptors.js';

const actionLabels = new Map([
  ['backup_restore_started', 'Backup restore started'],
  ['backup_restore_completed', 'Backup restore completed'],
  ['backup_restore_failed', 'Backup restore failed'],
  ['maintenance_lock_entered', 'Maintenance lock entered'],
  ['maintenance_lock_released', 'Maintenance lock released'],
]);
function timestamp(value) {
  return typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value ? value : null;
}
function message(value) {
  if (typeof value !== 'string') return 'No failure message is available.';
  const text = value.slice(0, 1000).trim();
  return text ? text + (value.length > 1000 ? '…' : '') : 'No failure message is available.';
}
function project(records, toRow) {
  const rows = []; const seen = new Set(); let available = Array.isArray(records);
  if (available) for (const record of records.slice(0, 5)) {
    if (!record || typeof record.id !== 'string' || !record.id.trim() || record.id.length > 128 || seen.has(record.id)) { available = false; continue; }
    seen.add(record.id); rows.push({ id: record.id, ...toRow(record) });
  }
  return { available, rows };
}

/** Current service fields only: no invented counts, actor, summary or raw enums. */
export function buildRecoveryDiagnosticEvents(diagnostics) {
  return {
    failures: project(diagnostics?.recentFailedRuns, row => ({
      title: getOperationRunDescriptorDefinition(row.operationType)?.title ?? 'Background job',
      finishedAt: timestamp(row.finishedAt), message: message(row.errorMessage),
    })),
    actions: project(diagnostics?.recentPrivilegedActions, row => ({
      title: actionLabels.get(row.eventType) ?? 'Privileged recovery action', occurredAt: timestamp(row.occurredAt),
    })),
  };
}
