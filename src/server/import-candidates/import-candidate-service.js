/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash } from 'node:crypto';
import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { filterSlskdResponsesForCandidates } from '../library/candidate-source-filter.js';
import { resolveScoringSettings, scoreDownloadResult } from '../library/download-result-scoring.js';
import { loadSettings } from '../settings.js';
import { scoreCandidateFormatMatch } from '../library/format-preference-scoring.js';
import { getPool } from '../database.js';
import {
  getImportCandidateById,
  insertImportCandidateEvent,
  listImportCandidateFiles,
  listImportCandidates as listImportCandidatesFromRepository,
  listImportCandidatesBySourceMediaRequestIds as listImportCandidatesBySourceMediaRequestIdsFromRepository,
  replaceImportCandidateFiles,
  transitionImportCandidateStatus,
  upsertImportCandidate,
} from './import-candidate-repository.js';

const candidateStatuses = new Set(['pending', 'held', 'rejected', 'selected', 'downloading', 'import_pending', 'applied', 'failed']);

function normalizeOptionalString(value, {
  fieldName,
  maxLength,
} = {}) {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', `${fieldName} must be a string`);
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw createApiError(400, 'validation_error', `${fieldName} must be ${maxLength} characters or less`);
  }

  return normalized;
}

function normalizeRequiredString(value, {
  fieldName,
  maxLength,
}) {
  const normalized = normalizeOptionalString(value, { fieldName, maxLength });
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  return normalized;
}

function normalizeCandidateStatus(value) {
  const normalized = normalizeOptionalString(value, {
    fieldName: 'status',
    maxLength: 30,
  });

  if (normalized && !candidateStatuses.has(normalized)) {
    throw createApiError(400, 'validation_error', 'status is invalid');
  }

  return normalized;
}

function normalizeInteger(value, {
  fallback,
  fieldName,
  max,
  min,
}) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw createApiError(400, 'validation_error', `${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

function normalizeReason(value) {
  return normalizeOptionalString(value, {
    fieldName: 'reason',
    maxLength: 500,
  });
}

function toNonNegativeInteger(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeExtension(filename, extension) {
  if (typeof extension === 'string' && extension.trim()) {
    return extension.trim().replace(/^\./, '').toLowerCase();
  }

  const basename = typeof filename === 'string' ? filename : '';
  const lastDot = basename.lastIndexOf('.');
  return lastDot >= 0 && lastDot < basename.length - 1
    ? basename.slice(lastDot + 1).toLowerCase()
    : null;
}

function splitRemotePath(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const separatorIndex = Math.max(
    normalized.lastIndexOf('\\'),
    normalized.lastIndexOf('/'),
  );

  if (separatorIndex < 0) {
    return {
      folderPath: '',
      filename: normalized,
    };
  }

  return {
    folderPath: normalized.slice(0, separatorIndex),
    filename: normalized.slice(separatorIndex + 1),
  };
}

function buildSourceResponseKey({ folderPath, username }) {
  return createHash('sha256')
    .update(JSON.stringify({ folderPath, username }))
    .digest('hex');
}

function buildUsernameKey(username) {
  return normalizeOptionalString(username, {
    fieldName: 'username',
    maxLength: 100,
  })?.toLowerCase() ?? '';
}

function deriveTrustedUsernames(reputationIndex) {
  const trusted = new Set();
  if (!(reputationIndex instanceof Map)) {
    return trusted;
  }
  for (const reputation of reputationIndex.values()) {
    if (reputation?.trustState === 'trusted' && typeof reputation.username === 'string' && reputation.username) {
      trusted.add(reputation.username);
    }
  }
  return trusted;
}

function normalizeResponseFile(file, {
  fallbackIndex,
  isLocked,
}) {
  const remotePath = splitRemotePath(file?.filename);
  if (!remotePath?.filename) {
    return null;
  }

  return {
    sourceFileIndex: fallbackIndex,
    filename: remotePath.filename,
    folderPath: remotePath.folderPath,
    extension: normalizeExtension(remotePath.filename, file.extension),
    sizeBytes: toNonNegativeInteger(file.size),
    bitRateKbps: toNonNegativeInteger(file.bitRate),
    bitDepth: toNonNegativeInteger(file.bitDepth),
    lengthSeconds: toNonNegativeInteger(file.length),
    sampleRateHz: toNonNegativeInteger(file.sampleRate),
    isLocked: Boolean(isLocked || file.isLocked),
    rawPayload: file,
  };
}

export function normalizeSlskdResponsesToImportCandidates({
  blacklistedTitleTerms = null,
  formatPreferences = null,
  discoveredAt = new Date(),
  ignoredUsernames = null,
  requestOwnership = null,
  responses = [],
  searchId,
}) {
  const groups = new Map();
  let sourceFileIndex = 0;

  const { responses: filteredResponses } = filterSlskdResponsesForCandidates({
    responses,
    ignoredUsernames,
    blacklistedTitleTerms,
  });

  for (const response of filteredResponses) {
    const username = typeof response?.username === 'string' ? response.username.trim() : '';
    if (!username) {
      continue;
    }

    const responseFiles = [
      ...(
        Array.isArray(response.files)
          ? response.files.map((file) => ({ file, isLocked: false }))
          : []
      ),
      ...(
        Array.isArray(response.lockedFiles)
          ? response.lockedFiles.map((file) => ({ file, isLocked: true }))
          : []
      ),
    ];

    for (const { file, isLocked } of responseFiles) {
      const normalizedFile = normalizeResponseFile(file, {
        fallbackIndex: sourceFileIndex,
        isLocked,
      });
      sourceFileIndex += 1;

      if (!normalizedFile) {
        continue;
      }

      const groupKey = `${username}\u0000${normalizedFile.folderPath}`;
      const group = groups.get(groupKey) ?? {
        files: [],
        rawFiles: [],
        rawLockedFiles: [],
        response,
        username,
        folderPath: normalizedFile.folderPath,
      };
      group.files.push(normalizedFile);
      if (normalizedFile.isLocked) {
        group.rawLockedFiles.push(file);
      } else {
        group.rawFiles.push(file);
      }
      groups.set(groupKey, group);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const totalSizeBytes = group.files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);
    const lockedFileCount = group.files.filter((file) => file.isLocked).length;
    const extensions = Array.from(new Set(group.files.map((file) => file.extension).filter(Boolean))).sort();

    const formatScore = formatPreferences
      ? scoreCandidateFormatMatch({
        preferredFormat: formatPreferences.preferredFormat,
        minimumQuality: formatPreferences.minimumQuality,
        extensions,
        files: group.files,
      })
      : null;

    return {
      sourceProvider: 'slskd',
      sourceSearchId: searchId,
      sourceResponseKey: buildSourceResponseKey(group),
      username: group.username,
      folderPath: group.folderPath,
      candidateType: 'manual_search',
      status: 'pending',
      fileCount: group.files.length,
      lockedFileCount,
      totalSizeBytes,
      rawPayload: {
        username: group.username,
        folderPath: group.folderPath,
        requestOwnership,
        response: {
          ...group.response,
          files: group.rawFiles,
          lockedFiles: group.rawLockedFiles,
        },
      },
      normalizedPayload: {
        username: group.username,
        folderPath: group.folderPath,
        hasFreeUploadSlot: group.response.hasFreeUploadSlot ?? false,
        queueLength: group.response.queueLength ?? null,
        requestOwnership,
        uploadSpeed: group.response.uploadSpeed ?? null,
        fileCount: group.files.length,
        lockedFileCount,
        totalSizeBytes,
        extensions,
        ...(formatScore ? {
          formatMatchLabel: formatScore.label,
          formatMatchScore: formatScore.score,
        } : {}),
      },
      discoveredAt: discoveredAt.toISOString(),
      files: group.files,
    };
  });
}

export function createImportCandidateService({
  getImportCandidateByIdFn = getImportCandidateById,
  insertImportCandidateEventFn = insertImportCandidateEvent,
  listImportCandidateFilesFn = listImportCandidateFiles,
  listImportCandidatesFn = listImportCandidatesFromRepository,
  listImportCandidatesBySourceMediaRequestIdsFn = listImportCandidatesBySourceMediaRequestIdsFromRepository,
  listIgnoredUsernamesFn = async () => [],
  listSourceUserReputationIndexFn = async () => new Map(),
  normalizeSlskdResponsesFn = normalizeSlskdResponsesToImportCandidates,
  pool = getPool(),
  recordAuditEventFn = recordAuditEvent,
  recordSourceUserOutcomeEvidenceFn = async () => null,
  replaceImportCandidateFilesFn = replaceImportCandidateFiles,
  scoreDownloadResultFn = scoreDownloadResult,
  loadSettingsFn = loadSettings,
  slskdService,
  browseEnrichmentService = null,
  transitionImportCandidateStatusFn = transitionImportCandidateStatus,
  upsertImportCandidateFn = upsertImportCandidate,
} = {}) {
  async function withTransaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listImportCandidates({
    folderPath,
    limit,
    offset,
    requestedForUserId,
    sourceSearchId,
    status,
    username,
  } = {}) {
    const filters = {
      folderPath: normalizeOptionalString(folderPath, {
        fieldName: 'folderPath',
        maxLength: 500,
      }),
      requestedForUserId: normalizeOptionalString(requestedForUserId, {
        fieldName: 'requestedForUserId',
        maxLength: 100,
      }),
      sourceSearchId: normalizeOptionalString(sourceSearchId, {
        fieldName: 'sourceSearchId',
        maxLength: 100,
      }),
      status: normalizeCandidateStatus(status),
      username: normalizeOptionalString(username, {
        fieldName: 'username',
        maxLength: 100,
      }),
    };
    const pagination = {
      limit: normalizeInteger(limit, {
        fallback: 25,
        fieldName: 'limit',
        max: 1000,
        min: 1,
      }),
      offset: normalizeInteger(offset, {
        fallback: 0,
        fieldName: 'offset',
        max: 10000,
        min: 0,
      }),
    };
    const result = await listImportCandidatesFn({
      ...filters,
      ...pagination,
    });

    return {
      candidates: result.items,
      filters,
      pagination: {
        ...pagination,
        total: result.total,
      },
    };
  }

  async function listImportCandidatesBySourceMediaRequestIds({ sourceMediaRequestIds } = {}) {
    if (!Array.isArray(sourceMediaRequestIds)) {
      throw createApiError(400, 'validation_error', 'sourceMediaRequestIds must be an array');
    }

    const normalizedIds = [...new Set(sourceMediaRequestIds
      .map((value) => normalizeOptionalString(value, {
        fieldName: 'sourceMediaRequestIds',
        maxLength: 100,
      }))
      .filter(Boolean))];

    if (normalizedIds.length === 0) {
      return [];
    }

    if (normalizedIds.length > 200) {
      throw createApiError(400, 'validation_error', 'sourceMediaRequestIds must contain 200 items or fewer');
    }

    return listImportCandidatesBySourceMediaRequestIdsFn(normalizedIds);
  }

  async function getImportCandidate({
    importCandidateId,
  }) {
    const normalizedImportCandidateId = normalizeRequiredString(importCandidateId, {
      fieldName: 'importCandidateId',
      maxLength: 100,
    });
    const candidate = await getImportCandidateByIdFn(normalizedImportCandidateId);
    if (!candidate) {
      throw createApiError(404, 'import_candidate_not_found', 'Import candidate not found');
    }

    return {
      ...candidate,
      files: await listImportCandidateFilesFn(candidate.id),
    };
  }

  async function transitionCandidateReviewStatus({
    actorUserId = null,
    eventType,
    fromStatuses,
    importCandidateId,
    reason = null,
    requestMetadata = null,
    summary,
    toStatus,
  }) {
    const normalizedImportCandidateId = normalizeRequiredString(importCandidateId, {
      fieldName: 'importCandidateId',
      maxLength: 100,
    });
    const normalizedReason = normalizeReason(reason);

    const transitionResult = await withTransaction(async (client) => {
      const currentCandidate = await getImportCandidateByIdFn(normalizedImportCandidateId, client);
      if (!currentCandidate) {
        throw createApiError(404, 'import_candidate_not_found', 'Import candidate not found');
      }

      const transitionedCandidate = await transitionImportCandidateStatusFn({
        fromStatuses,
        importCandidateId: normalizedImportCandidateId,
        toStatus,
      }, client);

      if (!transitionedCandidate) {
        throw createApiError(
          409,
          'import_candidate_status_conflict',
          `Import candidate cannot transition from ${currentCandidate.status} to ${toStatus}`,
        );
      }

      const event = await insertImportCandidateEventFn({
        actorUserId,
        details: {
          sourceProvider: transitionedCandidate.sourceProvider,
          sourceSearchId: transitionedCandidate.sourceSearchId,
        },
        eventType,
        importCandidateId: transitionedCandidate.id,
        newStatus: toStatus,
        previousStatus: currentCandidate.status,
        reason: normalizedReason,
      }, client);

      return {
        candidate: transitionedCandidate,
        event,
      };
    });

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      eventType,
      summary,
      entityType: 'import_candidate',
      entityId: transitionResult.candidate.id,
      details: {
        importCandidateId: transitionResult.candidate.id,
        newStatus: toStatus,
        previousStatus: transitionResult.event.previousStatus,
        reason: normalizedReason,
        sourceProvider: transitionResult.candidate.sourceProvider,
        sourceSearchId: transitionResult.candidate.sourceSearchId,
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return transitionResult;
  }

  function holdImportCandidate({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_held',
      fromStatuses: ['pending'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate held for review',
      toStatus: 'held',
    });
  }

  function selectImportCandidate({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_selected',
      fromStatuses: ['pending', 'held'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate selected for download planning',
      toStatus: 'selected',
    });
  }

  function markImportCandidateDownloading({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_downloading',
      fromStatuses: ['selected'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate download started',
      toStatus: 'downloading',
    });
  }

  function retryImportCandidateDownload({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_download_retry_scheduled',
      fromStatuses: ['downloading'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate download retry scheduled',
      toStatus: 'selected',
    });
  }

  function markImportCandidateImportPending({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_import_pending',
      fromStatuses: ['selected', 'downloading'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate download completed and awaits import review',
      toStatus: 'import_pending',
    });
  }

  function markImportCandidateApplied({
    actorUserId = null,
    importCandidateId,
    qualityLabel = null,
    qualityWeight = 1,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_applied',
      fromStatuses: ['import_pending'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate applied into the library',
      toStatus: 'applied',
    }).then(async (transitionResult) => {
      try {
        await recordSourceUserOutcomeEvidenceFn({
          actorUserId,
          eventType: 'import_candidate_applied',
          occurredAt: transitionResult?.candidate?.updatedAt ?? null,
          outcome: 'success',
          qualityLabel,
          qualityWeight,
          reason,
          username: transitionResult?.candidate?.username,
        });
      } catch {
        // Trust evidence must not block the core status transition.
      }
      return transitionResult;
    });
  }

  function markImportCandidateDownloadFailed({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_download_failed',
      fromStatuses: ['selected', 'downloading'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate download failed',
      toStatus: 'failed',
    }).then(async (transitionResult) => {
      try {
        await recordSourceUserOutcomeEvidenceFn({
          actorUserId,
          eventType: 'import_candidate_download_failed',
          occurredAt: transitionResult?.candidate?.updatedAt ?? null,
          outcome: 'failure',
          reason,
          username: transitionResult?.candidate?.username,
        });
      } catch {
        // Trust evidence must not block the core status transition.
      }
      return transitionResult;
    });
  }

  function rejectImportCandidate({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_rejected',
      fromStatuses: ['pending', 'held', 'selected'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate rejected',
      toStatus: 'rejected',
    });
  }

  function reopenImportCandidate({
    actorUserId = null,
    importCandidateId,
    reason = null,
    requestMetadata = null,
  }) {
    return transitionCandidateReviewStatus({
      actorUserId,
      eventType: 'import_candidate_reopened',
      fromStatuses: ['held', 'rejected', 'failed', 'selected'],
      importCandidateId,
      reason,
      requestMetadata,
      summary: 'Import candidate reopened',
      toStatus: 'pending',
    });
  }

  async function ingestSlskdSearchResponses({
    actorUserId = null,
    albumTitle = null,
    blacklistedTitleTerms = null,
    expectedTrackCount = null,
    expectedTrackTitles = null,
    expectedDurationSeconds = null,
    formatPreferences = null,
    ignoredUsernames = null,
    requestOwnership = null,
    requestMetadata = null,
    searchId,
  }) {
    const searchResponses = await slskdService.getSearchResponses({ searchId });
    // Feed the G6 candidate source filter from the operator-controlled ignore
    // list (the "act" side of the learn->act loop). An explicit ignoredUsernames
    // argument still wins; otherwise the current ignore list is resolved here so
    // every ingest path (album + per-track fallback) drops ignored peers before
    // any candidate is built. Best-effort: a lookup failure must not block ingest.
    let effectiveIgnoredUsernames = ignoredUsernames;
    if (effectiveIgnoredUsernames === null) {
      try {
        effectiveIgnoredUsernames = await listIgnoredUsernamesFn();
      } catch {
        effectiveIgnoredUsernames = null;
      }
    }
    const candidates = normalizeSlskdResponsesFn({
      blacklistedTitleTerms,
      formatPreferences,
      ignoredUsernames: effectiveIgnoredUsernames,
      requestOwnership,
      responses: searchResponses.responses,
      searchId: searchResponses.searchId,
    });
    let reputationIndex;
    try {
      reputationIndex = await listSourceUserReputationIndexFn({
        usernames: candidates.map((candidate) => candidate.username),
      });
    } catch {
      reputationIndex = new Map();
    }

    let enrichedCandidates = candidates;
    if (browseEnrichmentService) {
      try {
        enrichedCandidates = await browseEnrichmentService.enrichCandidatesWithBrowse({
          candidates,
          albumTitle,
          expectedTrackCount,
          trustedUsernames: deriveTrustedUsernames(reputationIndex),
          formatPreferences,
          requestOwnership,
          searchId: searchResponses.searchId,
        });
      } catch {
        enrichedCandidates = candidates;
      }
    }

    let effectiveScorers;
    try {
      effectiveScorers = resolveScoringSettings(await loadSettingsFn());
    } catch {
      effectiveScorers = resolveScoringSettings(undefined);
    }

    for (const candidate of enrichedCandidates) {
      const scoring = scoreDownloadResultFn({
        candidate,
        formatPreferences,
        albumTitle,
        expectedTrackCount,
        expectedTrackTitles,
        expectedDurationSeconds,
        uploaderReputation: reputationIndex.get(buildUsernameKey(candidate.username)) ?? null,
        scorers: effectiveScorers,
      });

      if (scoring.compositeScore !== null) {
        candidate.normalizedPayload.compositeScore = scoring.compositeScore;
        candidate.normalizedPayload.scoreBreakdown = scoring.breakdown;
      }

      if (scoring.trackMatchSummary) {
        candidate.normalizedPayload.trackMatchSummary = scoring.trackMatchSummary;
      }
    }

    const storedCandidates = await withTransaction(async (client) => {
      const stored = [];

      for (const candidate of enrichedCandidates) {
        const storedCandidate = await upsertImportCandidateFn(candidate, client);
        const storedFiles = await replaceImportCandidateFilesFn(
          storedCandidate.id,
          candidate.files,
          client,
        );
        stored.push({
          ...storedCandidate,
          files: storedFiles,
        });
      }

      return stored;
    });

    await recordAuditEventFn({
      actorUserId,
      actorType: actorUserId ? 'user' : 'system',
      eventType: 'import_candidates_slskd_ingested',
      summary: 'slskd search responses ingested as import candidates',
      entityType: 'slskd_search',
      entityId: null,
      details: {
        sourceProvider: 'slskd',
        sourceSearchId: searchResponses.searchId,
        candidateCount: storedCandidates.length,
        fileCount: storedCandidates.reduce((total, candidate) => total + candidate.fileCount, 0),
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      sourceProvider: 'slskd',
      sourceSearchId: searchResponses.searchId,
      candidateCount: storedCandidates.length,
      fileCount: storedCandidates.reduce((total, candidate) => total + candidate.fileCount, 0),
      candidates: storedCandidates,
    };
  }

  return {
    getImportCandidate,
    holdImportCandidate,
    ingestSlskdSearchResponses,
    listImportCandidates,
    listImportCandidatesBySourceMediaRequestIds,
    markImportCandidateDownloadFailed,
    markImportCandidateDownloading,
    markImportCandidateApplied,
    markImportCandidateImportPending,
    rejectImportCandidate,
    reopenImportCandidate,
    retryImportCandidateDownload,
    selectImportCandidate,
  };
}
