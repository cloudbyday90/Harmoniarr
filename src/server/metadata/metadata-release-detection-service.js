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

import { recordAuditEvent } from '../audit.js';
import { createLibraryWantedReleaseStore } from '../library/library-wanted-release-store.js';
import { createMetadataReleaseDetectionRetentionService } from './metadata-release-detection-retention-service.js';
import { createMetadataReleaseDetectionStore } from './metadata-release-detection-store.js';

function normalizeReleaseGroupType(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function buildMonitoringDecision({ isMonitored, monitoredTypeSet, primaryType, resultingWantedStatus }) {
  if (!isMonitored) {
    return 'not_monitored';
  }

  if (!monitoredTypeSet.has(normalizeReleaseGroupType(primaryType))) {
    return 'ignored_release_type';
  }

  if (resultingWantedStatus === 'missing' || resultingWantedStatus === 'partial') {
    return 'wanted_release_detected';
  }

  return 'already_satisfied';
}

function buildAuditSummary({ artistName, event }) {
  const releaseType = event.primaryType ? event.primaryType.toLowerCase() : 'release';
  const wantedSuffix = event.resultingWantedStatus
    ? ` (${event.resultingWantedStatus} wanted state)`
    : '';

  return `Detected new ${releaseType} ${event.title} for ${artistName}${wantedSuffix}`;
}

export function createMetadataReleaseDetectionService({
  libraryWantedReleaseStore = createLibraryWantedReleaseStore(),
  metadataReleaseDetectionRetentionService = null,
  metadataReleaseDetectionStore = createMetadataReleaseDetectionStore(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const resolvedMetadataReleaseDetectionRetentionService = metadataReleaseDetectionRetentionService
    ?? createMetadataReleaseDetectionRetentionService({ metadataReleaseDetectionStore });

  async function recordDetectedReleaseGroups({
    artistName,
    metadataArtistId,
    monitoring,
    operationRunId = null,
    refreshedAt,
    releaseGroups,
    triggerSource = 'manual',
  } = {}) {
    if (!Array.isArray(releaseGroups) || releaseGroups.length < 1) {
      return [];
    }

    const wantedStatuses = await libraryWantedReleaseStore.listWantedStatusesForReleaseGroups({
      metadataReleaseGroupIds: releaseGroups.map((releaseGroup) => releaseGroup.id),
    });
    const wantedByReleaseGroupId = new Map(
      wantedStatuses.map((entry) => [entry.metadataReleaseGroupId, entry.wantedStatus]),
    );
    const monitoredTypeSet = new Set((monitoring?.monitoredReleaseGroupTypes ?? ['album', 'ep'])
      .map(normalizeReleaseGroupType)
      .filter(Boolean));
    const eventsToRecord = releaseGroups.map((releaseGroup) => {
      const resultingWantedStatus = wantedByReleaseGroupId.get(releaseGroup.id) ?? null;

      return {
        details: {
          artistName,
          monitoredReleaseGroupTypes: monitoring?.monitoredReleaseGroupTypes ?? ['album', 'ep'],
        },
        detectionType: 'release_group_detected',
        firstReleaseDate: releaseGroup.firstReleaseDate ?? null,
        metadataArtistId,
        metadataReleaseGroupId: releaseGroup.id,
        monitoringDecision: buildMonitoringDecision({
          isMonitored: monitoring?.isMonitored === true,
          monitoredTypeSet,
          primaryType: releaseGroup.primaryType,
          resultingWantedStatus,
        }),
        musicBrainzReleaseGroupId: releaseGroup.source?.musicbrainzReleaseGroupId ?? null,
        occurredAt: refreshedAt,
        operationRunId,
        primaryType: releaseGroup.primaryType ?? null,
        provider: 'musicbrainz',
        resultingWantedStatus,
        title: releaseGroup.title,
        triggerSource,
      };
    });
    const recordedEvents = await metadataReleaseDetectionStore.recordDetectionEvents({
      events: eventsToRecord,
    });

    await Promise.all(recordedEvents.map((event) => recordAuditEventFn({
      actorType: 'system',
      details: {
        metadataReleaseDetectionEventId: event.id,
        metadataReleaseGroupId: event.metadataReleaseGroupId,
        monitoringDecision: event.monitoringDecision,
        operationRunId: event.operationRunId,
        resultingWantedStatus: event.resultingWantedStatus,
        triggerSource: event.triggerSource,
      },
      entityId: metadataArtistId,
      entityType: 'metadata_artist',
      eventType: 'metadata_release_group_detected',
      summary: buildAuditSummary({ artistName, event }),
    })));
    await resolvedMetadataReleaseDetectionRetentionService.applyRetentionPolicy({ metadataArtistId });

    return recordedEvents;
  }

  async function listDetectionEventsPageForArtist({ before = null, limit = 10, metadataArtistId } = {}) {
    return metadataReleaseDetectionStore.listEventsPageForArtist({
      before,
      limit,
      metadataArtistId,
    });
  }

  async function listRecentDetectionEventsForArtist({ limit = 10, metadataArtistId } = {}) {
    return metadataReleaseDetectionStore.listRecentEventsForArtist({ limit, metadataArtistId });
  }

  return {
    listDetectionEventsPageForArtist,
    listRecentDetectionEventsForArtist,
    recordDetectedReleaseGroups,
  };
}