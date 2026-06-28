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

import { createMusicBrainzClient } from '../integrations/musicbrainz/musicbrainz-client.js';
import { createMetadataReleaseDetectionService } from './metadata-release-detection-service.js';
import {
  normalizeMusicBrainzArtist,
  normalizeMusicBrainzReleaseGroup,
} from '../integrations/musicbrainz/musicbrainz-normalizer.js';
import { createMetadataService } from './metadata-service.js';
import { observeMusicBrainzProviderCall } from './musicbrainz-provider-health.js';

const releaseGroupBrowsePageSize = 100;

async function browseAllArtistReleaseGroups({
  musicBrainzArtistId,
  musicBrainzClient,
  providerHealthRecorder,
  throwIfCancelled,
}) {
  const releaseGroups = [];
  const seenIds = new Set();
  let offset = 0;
  while (true) {
    await throwIfCancelled();
    const payload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.browseArtistReleaseGroups({
        artistId: musicBrainzArtistId,
        limit: releaseGroupBrowsePageSize,
        offset,
        releaseGroupStatus: 'website-default',
      }),
    );

    const pageResults = Array.isArray(payload['release-groups']) ? payload['release-groups'] : [];
    const total = payload['release-group-count'] ?? payload.count ?? 0;

    for (const releaseGroup of pageResults) {
      if (!releaseGroup?.id || seenIds.has(releaseGroup.id)) {
        continue;
      }

      seenIds.add(releaseGroup.id);
      releaseGroups.push(releaseGroup);
    }

    if (pageResults.length === 0) {
      break;
    }

    offset += pageResults.length;
    if (offset >= total) {
      break;
    }
  }

  return releaseGroups;
}

export function createMetadataRefreshService({
  getArtistRefreshMonitoring = null,
  getMetadataArtistByMusicBrainzId = async () => null,
  listOperatorArtistMonitoringByMetadataArtist = async () => [],
  materializeMonitoredReleaseGroups = null,
  metadataService = createMetadataService(),
  metadataReleaseDetectionService = createMetadataReleaseDetectionService(),
  musicBrainzClient = createMusicBrainzClient(),
  nowFn = () => new Date(),
  providerHealthRecorder = null,
  queueOperatorArtistReconciliation = null,
  reconcileWantedReleases = null,
} = {}) {
  async function queueOperatorReconciliationsAfterRefresh({
    metadataArtistId,
    monitoringRows = null,
    triggerSource,
  }) {
    if (!metadataArtistId || typeof queueOperatorArtistReconciliation !== 'function') {
      return {
        queuedCount: 0,
        skippedNotReadyCount: 0,
      };
    }

    const monitoredRows = Array.isArray(monitoringRows)
      ? monitoringRows
      : await listOperatorArtistMonitoringByMetadataArtist({ metadataArtistId });
    let queuedCount = 0;
    let skippedNotReadyCount = 0;

    for (const monitoring of monitoredRows) {
      if (monitoring?.isMonitored !== true || !monitoring.appUserId) {
        continue;
      }

      try {
        await queueOperatorArtistReconciliation({
          appUserId: monitoring.appUserId,
          metadataArtistId,
          triggerSource: `metadata_refresh:${triggerSource}`,
        });
        queuedCount += 1;
      } catch (error) {
        if (error?.code === 'operator_artist_reconciliation_not_ready') {
          skippedNotReadyCount += 1;
          continue;
        }
        throw error;
      }
    }

    return {
      queuedCount,
      skippedNotReadyCount,
    };
  }

  async function refreshArtistCatalogById({
    metadataArtistId = null,
    musicBrainzArtistId,
    runId = null,
    throwIfCancelled = async () => {},
    triggerSource = 'manual',
  } = {}) {
    const fetchedAt = nowFn().toISOString();
    await throwIfCancelled();

    let existingArtist = null;
    try {
      existingArtist = await getMetadataArtistByMusicBrainzId({ musicBrainzArtistId });
    } catch {
      // Refresh still works without the cached artist projection.
    }
    const existingReleaseGroupIds = new Set((existingArtist?.releaseGroups ?? [])
      .map((releaseGroup) => releaseGroup.source?.musicbrainzReleaseGroupId)
      .filter(Boolean));

    const artistPayload = await observeMusicBrainzProviderCall(
      providerHealthRecorder,
      () => musicBrainzClient.lookupArtist({ artistId: musicBrainzArtistId, includeAliases: true }),
    );

    const normalizedArtist = normalizeMusicBrainzArtist({
      artist: artistPayload,
      fetchedAt,
    });
    const storedArtist = await metadataService.storeArtist(normalizedArtist);
    const resolvedMetadataArtistId = metadataArtistId ?? storedArtist.id;

    const releaseGroups = await browseAllArtistReleaseGroups({
      musicBrainzArtistId,
      musicBrainzClient,
      providerHealthRecorder,
      throwIfCancelled,
    });
    const detectedReleaseGroups = [];

    for (const releaseGroup of releaseGroups) {
      await throwIfCancelled();
      const storedReleaseGroup = await metadataService.storeReleaseGroup(normalizeMusicBrainzReleaseGroup({
        artistDetails: artistPayload,
        fetchedAt,
        releaseGroup,
      }));
      if (!existingReleaseGroupIds.has(releaseGroup.id)) {
        detectedReleaseGroups.push(storedReleaseGroup.releaseGroup);
      }
    }

    await throwIfCancelled();
    const monitoredRows = resolvedMetadataArtistId
      ? await listOperatorArtistMonitoringByMetadataArtist({ metadataArtistId: resolvedMetadataArtistId })
      : [];
    let releaseMaterialization = {
      eligibleReleaseGroupCount: 0,
      importedReleaseCount: 0,
      skippedExistingCanonicalCount: 0,
      skippedExistingReleaseCount: 0,
      skippedNoCandidateCount: 0,
    };
    if (typeof materializeMonitoredReleaseGroups === 'function') {
      releaseMaterialization = await materializeMonitoredReleaseGroups({
        metadataArtistId: resolvedMetadataArtistId,
        monitoringRows: monitoredRows,
        throwIfCancelled,
      });
    }

    await throwIfCancelled();
    let wantedReconciliationCompleted = false;
    if (reconcileWantedReleases) {
      await reconcileWantedReleases();
      wantedReconciliationCompleted = true;
    }
    const operatorReconciliationQueue = await queueOperatorReconciliationsAfterRefresh({
      metadataArtistId: resolvedMetadataArtistId,
      monitoringRows: monitoredRows,
      triggerSource,
    });
    let detectionMonitoring = existingArtist?.monitoring ?? null;
    if (resolvedMetadataArtistId && typeof getArtistRefreshMonitoring === 'function') {
      try {
        detectionMonitoring = await getArtistRefreshMonitoring(resolvedMetadataArtistId);
      } catch {
        // Detection can still record with the cached artist monitoring fallback.
      }
    }

    const detectionEvents = existingArtist
      ? await metadataReleaseDetectionService.recordDetectedReleaseGroups({
        artistName: storedArtist.name ?? artistPayload.name,
        metadataArtistId: resolvedMetadataArtistId,
        monitoring: detectionMonitoring,
        operationRunId: runId,
        refreshedAt: fetchedAt,
        releaseGroups: detectedReleaseGroups,
        triggerSource,
      })
      : [];

    return {
      artist: storedArtist,
      detectedReleaseGroupCount: detectionEvents.length,
      materializedEligibleReleaseGroupCount: releaseMaterialization.eligibleReleaseGroupCount,
      materializedImportedReleaseCount: releaseMaterialization.importedReleaseCount,
      materializedSkippedExistingCanonicalCount: releaseMaterialization.skippedExistingCanonicalCount,
      materializedSkippedExistingReleaseCount: releaseMaterialization.skippedExistingReleaseCount,
      materializedSkippedNoCandidateCount: releaseMaterialization.skippedNoCandidateCount,
      operatorReconciliationQueuedCount: operatorReconciliationQueue.queuedCount,
      operatorReconciliationSkippedNotReadyCount: operatorReconciliationQueue.skippedNotReadyCount,
      refreshedAt: fetchedAt,
      releaseGroupCount: releaseGroups.length,
      wantedReconciliationCompleted,
    };
  }

  return {
    refreshArtistCatalogById,
  };
}
