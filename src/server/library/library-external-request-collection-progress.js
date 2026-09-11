/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const countFields = ['pages_completed', 'items_seen', 'leaves_captured', 'work_total', 'work_completed',
  'work_pending', 'work_failed', 'work_processing', 'work_unsupported', 'page_total', 'page_completed',
  'page_pending', 'page_failed', 'terminal_pages', 'operations_queued', 'operations_running'];

export function projectExternalCollectionPreparationProgress(row) {
  if (!row || !Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 1
    || !['preparing', 'ready', 'reviewed', 'blocked'].includes(row.status)
    || countFields.some((key) => !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // Bounded collection expansion has one container-page chain. A terminal
  // response plus every captured container being completed proves traversal;
  // zero pending rows alone does not. Release/track metadata may still remain.
  const traversalComplete = ['preparing', 'ready', 'reviewed'].includes(row.status)
    && row.page_total > 0 && row.page_total === row.page_completed
    && row.page_total === row.pages_completed && row.terminal_pages === 1;
  return {
    revision: Number(row.revision),
    work: {
      total: row.work_total, completed: row.work_completed, pending: row.work_pending,
      failed: row.work_failed, processing: row.work_processing, unsupported: row.work_unsupported,
    },
    operations: { queued: row.status === 'preparing' ? row.operations_queued : 0,
      running: row.status === 'preparing' ? row.operations_running : 0 },
    pages: {
      completed: row.pages_completed, pending: row.page_pending, failed: row.page_failed,
      total: traversalComplete ? row.pages_completed : null, traversalComplete,
    },
    entriesSeen: row.items_seen,
    leavesCaptured: row.leaves_captured,
  };
}
