/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function buildExternalRequestProgressStatus({ request, progress } = {}) {
  if (request?.requestKind !== 'external_url') return null;
  if (!progress) {
    return {
      code: 'under_review',
      label: 'Provider preparation needs review',
      detail: 'Current provider preparation state is unavailable. Operator review is needed.',
      occurredAt: request.updatedAt ?? request.createdAt ?? null,
      tone: 'held',
    };
  }
  const occurredAt = progress.occurredAt ?? request.updatedAt ?? request.createdAt ?? null;

  if (progress.status === 'failed') {
    return {
      code: 'failed',
      label: 'Provider preparation failed',
      detail: 'Provider details could not be prepared. Operator attention is needed.',
      occurredAt,
      tone: 'failed',
    };
  }
  if (progress.status === 'cancelled') {
    return {
      code: 'under_review',
      label: 'Provider preparation stopped',
      detail: 'Provider preparation stopped. Operator review is needed before continuing.',
      occurredAt,
      tone: 'held',
    };
  }
  if (progress.status === 'completed' && progress.phase === 'execution') {
    if (progress.pendingRequestCount > 0) {
      return {
        code: 'under_review',
        label: 'More provider details need review',
        detail: 'Provider preparation has remaining work. Operator review is needed before acquisition can continue.',
        occurredAt,
        tone: 'held',
      };
    }
    return {
      code: 'under_review',
      label: progress.failedCount > 0 ? 'Provider details need review' : 'Provider details prepared',
      detail: progress.failedCount > 0
        ? 'Some provider details could not be prepared. Operator review is needed.'
        : 'Provider details are ready for acquisition review. Music has not been imported yet.',
      occurredAt,
      tone: 'held',
    };
  }
  if (['pending', 'running', 'completed'].includes(progress.status)) {
    return {
      code: 'queued',
      label: progress.phase === 'execution' ? 'Preparing provider details' : 'Planning provider request',
      detail: 'Provider preparation is in progress for this request. Music has not been imported yet.',
      occurredAt,
      tone: 'held',
    };
  }
  return null;
}
