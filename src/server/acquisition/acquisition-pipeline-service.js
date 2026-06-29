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
import { createAcquisitionQualityPolicyService } from './acquisition-quality-policy-service.js';
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

export function createAcquisitionPipelineService({
  acquisitionPipelineStore,
  qualityPolicyService = createAcquisitionQualityPolicyService(),
  statusService = createAcquisitionPipelineStatusService(),
} = {}) {
  if (!acquisitionPipelineStore) {
    throw new TypeError('createAcquisitionPipelineService requires acquisitionPipelineStore');
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

  return {
    getMusicQueueRelease,
    listMusicQueueReleases,
  };
}
