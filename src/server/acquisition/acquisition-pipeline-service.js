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

import { createApiError } from '../auth.js';
import {
  createAcquisitionQualityPolicyService,
  QUALITY_DECISION_CODES,
} from './acquisition-quality-policy-service.js';
import { createAcquisitionPipelineStatusService } from './acquisition-pipeline-status-service.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRequiredAppUserId(appUserId, context) {
  const normalized = normalizeString(appUserId);
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${context} requires an appUserId`);
  }

  return normalized;
}

function normalizeRequiredId(value, fieldName) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw createApiError(400, 'validation_error', `${fieldName} is required`);
  }

  return normalized;
}

function findReleaseMatch(release, matchId) {
  const matches = release?.discoveryRequest?.importReviewSummary?.matches;
  if (!Array.isArray(matches)) return null;
  return matches.find((match) => normalizeString(match?.matchId) === matchId) ?? null;
}

function getCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getStatusCount(statusCounts, status) {
  return getCount(statusCounts?.[status]);
}

function buildSetupEvidence(release) {
  const discoveryRequest = release.discoveryRequest ?? {};
  const blockedReason = normalizeString(discoveryRequest.blockedReason);
  return {
    folderBlocked: blockedReason === 'missing_download_folder' || blockedReason === 'download_folder_unavailable',
    mediaToolingBlocked: blockedReason === 'media_tooling_unavailable',
    message: blockedReason || null,
    providerBlocked: blockedReason === 'slskd_not_configured' || blockedReason === 'provider_unavailable',
  };
}

function buildMatchEvidence(release) {
  const importReviewSummary = release.discoveryRequest?.importReviewSummary ?? {};
  const executionSummary = importReviewSummary.downloadExecutionSummary ?? {};
  const statusCounts = importReviewSummary.statusCounts ?? {};
  return {
    bestCompositeScore: importReviewSummary.bestCompositeScore ?? null,
    executionStatusCounts: executionSummary.itemStatusCounts ?? {},
    latestStatus: importReviewSummary.latestStatus ?? null,
    latestUpdatedAt: importReviewSummary.latestUpdatedAt ?? executionSummary.latestUpdatedAt ?? null,
    matches: Array.isArray(importReviewSummary.matches) ? importReviewSummary.matches : [],
    pendingCount: getStatusCount(statusCounts, 'pending') + getStatusCount(statusCounts, 'held'),
    readiness: importReviewSummary.selectionReadiness ?? null,
    scoredCount: importReviewSummary.selectionReadiness?.scoredCandidateCount ?? 0,
    secondBestCompositeScore: importReviewSummary.secondBestCompositeScore ?? null,
    statusCounts,
    totalCount: importReviewSummary.totalCount ?? 0,
  };
}

function buildSearchEvidence(release) {
  const discoveryRequest = release.discoveryRequest ?? {};
  return {
    blockedReason: discoveryRequest.blockedReason ?? null,
    lastSearchAt: discoveryRequest.lastSearchAt ?? null,
    nextSearchAfter: discoveryRequest.nextSearchAfter ?? null,
    searchAttemptCount: discoveryRequest.searchAttemptCount ?? 0,
    status: discoveryRequest.requestStatus ?? null,
  };
}

function buildReleaseEvidence(release) {
  return {
    missingTrackCount: release.missingTrackCount ?? 0,
    visibilityState: release.visibilityState ?? null,
    wantedStatus: release.wantedStatus ?? null,
  };
}

function buildQualityEvidence(release, qualityPolicyService) {
  const profileCode = release.evidence?.qualityProfile
    ?? release.discoveryRequest?.evidence?.qualityProfile
    ?? release.acquisitionProfile
    ?? 'lossless_archive';
  return qualityPolicyService.evaluateQualityEvidence({
    candidate: release.discoveryRequest?.evidence?.bestCandidate ?? {},
    mediaVerification: release.discoveryRequest?.evidence?.mediaVerification ?? {},
    profileCode,
    qualityOverride: release.discoveryRequest?.evidence?.musicQueueQualityOverride ?? null,
  });
}

function projectRelease(release, { qualityPolicyService, statusService }) {
  const quality = buildQualityEvidence(release, qualityPolicyService);
  const evidence = {
    match: buildMatchEvidence(release),
    quality,
    release: buildReleaseEvidence(release),
    search: buildSearchEvidence(release),
    setup: buildSetupEvidence(release),
  };
  const status = statusService.deriveMusicQueueStatus(evidence);

  return {
    artistName: release.artistName,
    evidence,
    expectedTrackCount: release.expectedTrackCount ?? 0,
    id: release.id,
    lastReconciledAt: release.lastReconciledAt ?? null,
    matchedTrackCount: release.matchedTrackCount ?? 0,
    metadataArtistId: release.metadataArtistId,
    metadataReleaseGroupId: release.metadataReleaseGroupId,
    metadataReleaseId: release.metadataReleaseId,
    missingTrackCount: release.missingTrackCount ?? 0,
    musicbrainzReleaseGroupId: release.musicbrainzReleaseGroupId ?? null,
    musicbrainzReleaseId: release.musicbrainzReleaseId ?? null,
    quality,
    releaseDate: release.releaseDate ?? null,
    releaseGroupTitle: release.releaseGroupTitle,
    releaseGroupType: release.releaseGroupType ?? null,
    releaseTitle: release.releaseTitle,
    status,
    wantedStatus: release.wantedStatus,
  };
}

function buildSummary(releases) {
  const counts = releases.reduce((accumulator, release) => {
    const code = release.status?.code ?? 'unknown';
    accumulator[code] = (accumulator[code] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    counts,
    total: releases.length,
  };
}

const REDISCOVERY_ALLOWED_STATUS_CODES = new Set([
  'failed',
  'no_matches_left',
  'quality_choice_needed',
]);

export function createAcquisitionPipelineService({
  acquisitionPipelineStore,
  allowMusicQueueFallbackQuality = null,
  getNow = () => new Date(),
  qualityPolicyService = createAcquisitionQualityPolicyService(),
  rejectImportCandidate = null,
  recordActivityEventFn = null,
  requestMusicQueueRediscovery = null,
  selectImportCandidate = null,
  startLibraryDiscoveryRun = null,
  statusService = createAcquisitionPipelineStatusService(),
} = {}) {
  if (!acquisitionPipelineStore) {
    throw new TypeError('createAcquisitionPipelineService requires acquisitionPipelineStore');
  }

  async function startDiscoveryRunIfAvailable({
    actorUserId,
    requestMetadata,
    triggerSource,
  }) {
    let dispatchAlreadyActive = false;
    let run = null;
    if (typeof startLibraryDiscoveryRun === 'function') {
      try {
        const started = await startLibraryDiscoveryRun({
          requestMetadata,
          triggerSource,
          triggeredByUserId: actorUserId,
        });
        run = started?.run ?? null;
      } catch (error) {
        if (error?.code !== 'library_discovery_in_progress') {
          throw error;
        }
        dispatchAlreadyActive = true;
      }
    }

    return { dispatchAlreadyActive, run };
  }

  async function getScopedReleaseMatch({ appUserId, matchId, wantedReleaseId }, context) {
    const scopedAppUserId = normalizeRequiredAppUserId(appUserId, context);
    const scopedWantedReleaseId = normalizeRequiredId(wantedReleaseId, 'wantedReleaseId');
    const scopedMatchId = normalizeRequiredId(matchId, 'matchId');

    const release = await acquisitionPipelineStore.getWantedReleaseEvidence({
      appUserId: scopedAppUserId,
      wantedReleaseId: scopedWantedReleaseId,
    });
    if (!release) {
      throw createApiError(404, 'music_queue_release_not_found', 'Music Queue release was not found');
    }

    const match = findReleaseMatch(release, scopedMatchId);
    if (!match) {
      throw createApiError(404, 'music_queue_match_not_found', 'Music Queue match was not found for this release');
    }

    return {
      appUserId: scopedAppUserId,
      match,
      matchId: scopedMatchId,
      release,
      wantedReleaseId: scopedWantedReleaseId,
    };
  }

  async function requestMusicQueueReleaseRediscovery({
    appUserId,
    actorUserId = null,
    requestMetadata = null,
    wantedReleaseId,
  } = {}) {
    if (typeof requestMusicQueueRediscovery !== 'function') {
      throw createApiError(503, 'music_queue_retry_unavailable', 'Music Queue retry is not available');
    }

    const scopedAppUserId = normalizeRequiredAppUserId(appUserId, 'requestMusicQueueReleaseRediscovery');
    const scopedWantedReleaseId = normalizeRequiredId(wantedReleaseId, 'wantedReleaseId');
    const release = await acquisitionPipelineStore.getWantedReleaseEvidence({
      appUserId: scopedAppUserId,
      wantedReleaseId: scopedWantedReleaseId,
    });
    if (!release) {
      throw createApiError(404, 'music_queue_release_not_found', 'Music Queue release was not found');
    }

    const projectedRelease = projectRelease(release, { qualityPolicyService, statusService });
    if (!REDISCOVERY_ALLOWED_STATUS_CODES.has(projectedRelease.status?.code)) {
      throw createApiError(409, 'music_queue_retry_not_available', 'This release is not stopped in a state that can be searched again');
    }

    const metadataReleaseId = normalizeString(release.metadataReleaseId);
    if (!metadataReleaseId) {
      throw createApiError(409, 'music_queue_retry_missing_release', 'This release is missing the metadata release needed to search again');
    }

    const requestedAt = getNow().toISOString();
    const rediscovery = await requestMusicQueueRediscovery({
      metadataReleaseId,
      reasonCode: projectedRelease.status?.code === 'quality_choice_needed'
        ? 'quality_choice_search_again'
        : 'music_queue_try_again',
      requestedAt,
      requestedByUserId: actorUserId,
      wantedReleaseId: scopedWantedReleaseId,
    });
    if (!rediscovery) {
      throw createApiError(409, 'music_queue_retry_not_available', 'This release could not be queued for another search');
    }

    const { dispatchAlreadyActive, run } = await startDiscoveryRunIfAvailable({
      actorUserId,
      requestMetadata,
      triggerSource: 'music_queue_try_again',
    });

    const refreshed = await getMusicQueueRelease({
      appUserId: scopedAppUserId,
      wantedReleaseId: scopedWantedReleaseId,
    });

    return {
      action: {
        code: 'search_again',
        dispatchAlreadyActive,
        discoveryRunId: run?.id ?? null,
        wantedReleaseId: scopedWantedReleaseId,
      },
      rediscovery,
      release: refreshed.release,
      run,
    };
  }

  async function allowMusicQueueReleaseFallbackQuality({
    appUserId,
    actorUserId = null,
    requestMetadata = null,
    wantedReleaseId,
  } = {}) {
    if (typeof allowMusicQueueFallbackQuality !== 'function') {
      throw createApiError(503, 'music_queue_fallback_unavailable', 'Music Queue fallback quality is not available');
    }

    const scopedAppUserId = normalizeRequiredAppUserId(appUserId, 'allowMusicQueueReleaseFallbackQuality');
    const scopedWantedReleaseId = normalizeRequiredId(wantedReleaseId, 'wantedReleaseId');
    const release = await acquisitionPipelineStore.getWantedReleaseEvidence({
      appUserId: scopedAppUserId,
      wantedReleaseId: scopedWantedReleaseId,
    });
    if (!release) {
      throw createApiError(404, 'music_queue_release_not_found', 'Music Queue release was not found');
    }

    const projectedRelease = projectRelease(release, { qualityPolicyService, statusService });
    if (projectedRelease.status?.code !== 'quality_choice_needed') {
      throw createApiError(409, 'music_queue_fallback_not_available', 'This release is not waiting for a quality choice');
    }
    if (projectedRelease.quality?.code !== QUALITY_DECISION_CODES.BELOW_MINIMUM) {
      throw createApiError(409, 'music_queue_fallback_not_available', 'Fallback quality can only be allowed when matches are below the selected preference');
    }

    const metadataReleaseId = normalizeString(release.metadataReleaseId);
    if (!metadataReleaseId) {
      throw createApiError(409, 'music_queue_fallback_missing_release', 'This release is missing the metadata release needed to allow fallback quality');
    }

    const allowedAt = getNow().toISOString();
    const profileCode = projectedRelease.quality?.profile?.code ?? 'lossless_archive';
    const override = await allowMusicQueueFallbackQuality({
      allowedAt,
      allowedByUserId: actorUserId,
      metadataReleaseId,
      priorQualityProfile: profileCode,
      reasonCode: 'operator_allowed_fallback_quality',
      wantedReleaseId: scopedWantedReleaseId,
    });
    if (!override) {
      throw createApiError(409, 'music_queue_fallback_not_available', 'Fallback quality could not be saved for this release');
    }

    if (typeof recordActivityEventFn === 'function') {
      try {
        Promise.resolve(recordActivityEventFn({
          actorUserId,
          entityArtist: release.artistName ?? null,
          entityId: scopedWantedReleaseId,
          entityTitle: release.releaseTitle ?? release.releaseGroupTitle ?? null,
          entityType: 'wanted_release',
          eventType: 'quality_fallback_allowed',
          extraPayload: {
            metadataReleaseId,
            priorQualityProfile: profileCode,
            queuedRediscovery: true,
            reasonCode: 'operator_allowed_fallback_quality',
          },
        })).catch(() => {});
      } catch {
        // Activity is diagnostic; the user action already persisted successfully.
      }
    }

    const { dispatchAlreadyActive, run } = await startDiscoveryRunIfAvailable({
      actorUserId,
      requestMetadata,
      triggerSource: 'music_queue_quality_fallback',
    });

    const refreshed = await getMusicQueueRelease({
      appUserId: scopedAppUserId,
      wantedReleaseId: scopedWantedReleaseId,
    });

    return {
      action: {
        code: 'allow_fallback_quality',
        dispatchAlreadyActive,
        discoveryRunId: run?.id ?? null,
        wantedReleaseId: scopedWantedReleaseId,
      },
      override,
      release: refreshed.release,
      run,
    };
  }

  async function runScopedMatchAction({
    actionCode,
    appUserId,
    actorUserId = null,
    matchId,
    reason = null,
    requestMetadata = null,
    transition,
    wantedReleaseId,
  }) {
    if (typeof transition !== 'function') {
      throw createApiError(503, 'music_queue_match_action_unavailable', 'Music Queue match actions are not available');
    }

    const scoped = await getScopedReleaseMatch({
      appUserId,
      matchId,
      wantedReleaseId,
    }, actionCode);

    const review = await transition({
      actorUserId,
      importCandidateId: scoped.matchId,
      reason,
      requestMetadata,
    });
    const refreshed = await getMusicQueueRelease({
      appUserId: scoped.appUserId,
      wantedReleaseId: scoped.wantedReleaseId,
    });

    return {
      action: {
        code: actionCode,
        matchId: scoped.matchId,
      },
      release: refreshed.release,
      review,
    };
  }

  async function listMusicQueueReleases({ appUserId, limit, offset } = {}) {
    const scopedAppUserId = normalizeRequiredAppUserId(appUserId, 'listMusicQueueReleases');
    const payload = await acquisitionPipelineStore.listWantedReleaseEvidence({
      appUserId: scopedAppUserId,
      limit,
      offset,
    });
    const releases = payload.releases.map((release) => projectRelease(release, {
      qualityPolicyService,
      statusService,
    }));

    return {
      checkedAt: payload.checkedAt,
      pagination: payload.pagination,
      releases,
      summary: buildSummary(releases),
    };
  }

  async function getMusicQueueRelease({ appUserId, wantedReleaseId } = {}) {
    const scopedAppUserId = normalizeRequiredAppUserId(appUserId, 'getMusicQueueRelease');
    const release = await acquisitionPipelineStore.getWantedReleaseEvidence({
      appUserId: scopedAppUserId,
      wantedReleaseId,
    });
    if (!release) {
      throw createApiError(404, 'music_queue_release_not_found', 'Music Queue release was not found');
    }

    return {
      checkedAt: new Date().toISOString(),
      release: projectRelease(release, { qualityPolicyService, statusService }),
    };
  }

  function useMusicQueueMatch(options = {}) {
    return runScopedMatchAction({
      ...options,
      actionCode: 'use_match',
      reason: options.reason ?? 'Selected from Music Queue',
      transition: selectImportCandidate,
    });
  }

  function rejectMusicQueueMatch(options = {}) {
    return runScopedMatchAction({
      ...options,
      actionCode: 'reject_match',
      reason: options.reason ?? 'Rejected from Music Queue',
      transition: rejectImportCandidate,
    });
  }

  return {
    allowMusicQueueReleaseFallbackQuality,
    getMusicQueueRelease,
    listMusicQueueReleases,
    requestMusicQueueReleaseRediscovery,
    rejectMusicQueueMatch,
    useMusicQueueMatch,
  };
}
