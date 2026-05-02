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

import { createAuditReadService } from './audit-read-service.js';
import { getOperationRunDescriptorDefinition } from '../shared/operation-run-descriptors.js';
import {
  buildTimelinePage,
  compareTimelineEntriesDesc,
  decodeTimelineCursor,
  normalizeTimelinePageLimit,
  resolveTimelineCursorOccurredAt,
} from './timeline-pagination.js';

function toSortableTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function mapAuditStatus(eventType) {
  return eventType === 'metadata_release_group_detected' ? 'info' : 'neutral';
}

function mapRunStatus(status) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'running':
      return 'active';
    default:
      return 'neutral';
  }
}

function mapHeartbeatStatus(status) {
  switch (status) {
    case 'paused':
    case 'error':
      return 'error';
    case 'running':
    case 'active':
      return 'active';
    default:
      return 'neutral';
  }
}

export function createActivityFeedService({
  auditReadService = createAuditReadService(),
  operationHistoryService = null,
  nowFn = () => new Date(),
} = {}) {
  async function buildRecentActivityFeed({ before = null, heartbeats = [], limit = 10 } = {}) {
    const normalizedLimit = normalizeTimelinePageLimit(limit, { defaultLimit: 10, maxLimit: 25 });
    const queryLimit = normalizedLimit + 1;
    const beforeCursor = decodeTimelineCursor(before);
    const beforeOccurredAt = beforeCursor
      ? resolveTimelineCursorOccurredAt(beforeCursor)
      : null;
    const [auditEvents, operationRuns] = await Promise.all([
      auditReadService.listRecentAuditEvents({ before, limit: queryLimit }),
      operationHistoryService?.listRecentActivityRuns?.({ before, limit: queryLimit })
        ?? operationHistoryService?.listRecentOperationRuns?.({ limit: queryLimit })
        ?? [],
    ]);

    const auditEntries = auditEvents.map((event) => ({
      entryType: 'audit',
      entityId: event.entityId,
      entityType: event.entityType,
      eventId: event.id,
      eventType: event.eventType,
      id: `audit:${event.id}`,
      message: event.summary,
      metadataArtistId: event.entityType === 'metadata_artist'
        ? event.entityId
        : event.details?.metadataArtistId ?? null,
      metadataReleaseGroupId: event.details?.metadataReleaseGroupId ?? null,
      occurredAt: event.occurredAt,
      status: mapAuditStatus(event.eventType),
      title: event.eventType === 'metadata_release_group_detected'
        ? 'Metadata detection'
        : 'Audit event',
    }));
    const operationEntries = operationRuns.map((run) => ({
      entryType: 'operation_run',
      id: `run:${run.id}`,
      message: run.errorMessage ?? run.summary?.currentStep ?? `${run.status} operation run`,
      occurredAt: run.finishedAt ?? run.cancelledAt ?? run.startedAt,
      operationType: run.operationType,
      runId: run.id,
      status: mapRunStatus(run.status),
      title: getOperationRunDescriptorDefinition(run.operationType)?.title ?? run.operationType,
    }));
    const heartbeatEntries = heartbeats
      .filter((heartbeat) => heartbeat?.lastTickAt && heartbeat.status !== 'idle')
      .filter((heartbeat) => !beforeOccurredAt || toSortableTime(heartbeat.lastTickAt) < toSortableTime(beforeOccurredAt))
      .map((heartbeat) => ({
        entryType: 'heartbeat',
        id: `heartbeat:${heartbeat.key}:${heartbeat.lastTickAt}`,
        message: heartbeat.message,
        occurredAt: heartbeat.lastTickAt,
        status: mapHeartbeatStatus(heartbeat.status),
        title: heartbeat.label,
      }));

    const page = buildTimelinePage({
      cursorPayload: (entry) => ({ occurredAt: entry.occurredAt }),
      entries: [...auditEntries, ...operationEntries, ...heartbeatEntries]
        .sort(compareTimelineEntriesDesc),
      limit: normalizedLimit,
    });

    return {
      checkedAt: nowFn().toISOString(),
      entries: page.entries,
      pageInfo: page.pageInfo,
    };
  }

  return {
    buildRecentActivityFeed,
  };
}