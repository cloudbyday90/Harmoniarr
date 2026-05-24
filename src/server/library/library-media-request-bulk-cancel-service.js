import { createApiError } from '../auth.js';

const MAX_BATCH_SIZE = 50;

function normalizeMediaRequestIds(value) {
  if (!Array.isArray(value)) {
    throw createApiError(400, 'validation_error', 'mediaRequestIds must be an array');
  }

  if (value.length === 0) {
    throw createApiError(400, 'validation_error', 'mediaRequestIds must contain at least one entry');
  }

  if (value.length > MAX_BATCH_SIZE) {
    throw createApiError(400, 'validation_error', `mediaRequestIds must contain ${MAX_BATCH_SIZE} entries or less`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw createApiError(400, 'validation_error', `mediaRequestIds[${index}] must be a string`);
    }

    const normalized = entry.trim();
    if (!normalized) {
      throw createApiError(400, 'validation_error', `mediaRequestIds[${index}] must not be empty`);
    }

    return normalized;
  });
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

  if (normalized.length > 500) {
    throw createApiError(400, 'validation_error', 'reason must be 500 characters or less');
  }

  return normalized;
}

export function createLibraryMediaRequestBulkCancelService({
  cancelMediaRequest = async () => {},
} = {}) {
  async function bulkCancelMediaRequests({ actorUserId, actorUserRole = null, mediaRequestIds, reason = null, requestMetadata = null } = {}) {
    const normalizedIds = normalizeMediaRequestIds(mediaRequestIds);
    const normalizedReason = normalizeOptionalReason(reason);

    const results = [];
    for (const mediaRequestId of normalizedIds) {
      try {
        const result = await cancelMediaRequest({
          actorUserId,
          actorUserRole,
          mediaRequestId,
          reason: normalizedReason,
          requestMetadata,
        });
        results.push({ mediaRequestId, ok: true, cancel: result });
      } catch (error) {
        results.push({
          error: { code: error?.code ?? 'unknown_error', message: error?.message ?? 'Unknown error', status: error?.status ?? 500 },
          mediaRequestId,
          ok: false,
        });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return {
      failed,
      results,
      succeeded,
      total: results.length,
    };
  }

  return {
    bulkCancelMediaRequests,
  };
}
