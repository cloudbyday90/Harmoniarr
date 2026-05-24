import { createApiError } from '../auth.js';

const MAX_BATCH_SIZE = 50;

const SUPPORTED_ACTIONS = new Set(['select', 'hold', 'reject', 'reopen']);

function normalizeImportCandidateIds(value) {
  if (!Array.isArray(value)) {
    throw createApiError(400, 'validation_error', 'importCandidateIds must be an array');
  }

  if (value.length === 0) {
    throw createApiError(400, 'validation_error', 'importCandidateIds must contain at least one entry');
  }

  if (value.length > MAX_BATCH_SIZE) {
    throw createApiError(400, 'validation_error', `importCandidateIds must contain ${MAX_BATCH_SIZE} entries or less`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw createApiError(400, 'validation_error', `importCandidateIds[${index}] must be a string`);
    }

    const normalized = entry.trim();
    if (!normalized) {
      throw createApiError(400, 'validation_error', `importCandidateIds[${index}] must not be empty`);
    }

    return normalized;
  });
}

function normalizeAction(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'action must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_ACTIONS.has(normalized)) {
    throw createApiError(400, 'validation_error', `action must be one of: ${[...SUPPORTED_ACTIONS].join(', ')}`);
  }

  return normalized;
}

function normalizeOptionalReason(value) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'reason must be a string');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > 400) {
    throw createApiError(400, 'validation_error', 'reason must be 400 characters or less');
  }

  return normalized;
}

export function createImportCandidateBulkReviewService({
  holdImportCandidate = async () => {},
  rejectImportCandidate = async () => {},
  reopenImportCandidate = async () => {},
  selectImportCandidate = async () => {},
} = {}) {
  const actionHandlers = {
    hold: holdImportCandidate,
    reopen: reopenImportCandidate,
    reject: rejectImportCandidate,
    select: selectImportCandidate,
  };

  async function bulkReviewImportCandidates({ action, actorUserId = null, importCandidateIds, reason = null, requestMetadata = null } = {}) {
    const normalizedIds = normalizeImportCandidateIds(importCandidateIds);
    const normalizedAction = normalizeAction(action);
    const normalizedReason = normalizeOptionalReason(reason);
    const handler = actionHandlers[normalizedAction];

    const results = [];
    for (const importCandidateId of normalizedIds) {
      try {
        const result = await handler({
          actorUserId,
          importCandidateId,
          reason: normalizedReason,
          requestMetadata,
        });
        results.push({ importCandidateId, ok: true, review: result });
      } catch (error) {
        results.push({
          error: { code: error?.code ?? 'unknown_error', message: error?.message ?? 'Unknown error', status: error?.status ?? 500 },
          importCandidateId,
          ok: false,
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return {
      action: normalizedAction,
      failed,
      results,
      succeeded,
      total: results.length,
    };
  }

  return {
    bulkReviewImportCandidates,
  };
}
