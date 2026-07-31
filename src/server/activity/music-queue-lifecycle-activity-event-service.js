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

import {
  addMusicQueueActivityFanoutScope,
  fanOutMusicQueueActivityEvent,
  resolveMusicQueueWantedReleaseIds,
} from './music-queue-activity-fanout-service.js';
import { normalizeImportCandidateAddBlockerCode } from '../import-candidates/import-candidate-add-blocker.js';

const MUSIC_QUEUE_ACTIVITY_SCHEMA_VERSION = 1;

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function resolveRequestOwnership(candidate) {
  if (candidate?.requestOwnership && typeof candidate.requestOwnership === 'object') {
    return candidate.requestOwnership;
  }

  if (candidate?.normalizedPayload?.requestOwnership
    && typeof candidate.normalizedPayload.requestOwnership === 'object') {
    return candidate.normalizedPayload.requestOwnership;
  }

  return {};
}

function resolveReleaseIdentity(candidate) {
  const requestOwnership = resolveRequestOwnership(candidate);
  const releaseIdentity = candidate?.releaseIdentity && typeof candidate.releaseIdentity === 'object'
    ? candidate.releaseIdentity
    : {};

  return {
    artistName: normalizeOptionalString(releaseIdentity.artistName)
      ?? normalizeOptionalString(requestOwnership.artistName),
    releaseTitle: normalizeOptionalString(releaseIdentity.releaseTitle)
      ?? normalizeOptionalString(requestOwnership.releaseTitle)
      ?? normalizeOptionalString(requestOwnership.releaseGroupTitle),
    wantedReleaseIds: resolveMusicQueueWantedReleaseIds(candidate),
    wantedReleaseId: normalizeOptionalString(candidate?.wantedReleaseId)
      ?? normalizeOptionalString(requestOwnership.wantedReleaseId),
  };
}

function buildMusicQueueEntity(candidate) {
  const identity = resolveReleaseIdentity(candidate);
  const importCandidateId = normalizeOptionalString(candidate?.id);
  const wantedReleaseId = identity.wantedReleaseIds[0] ?? identity.wantedReleaseId;

  return {
    entityArtist: identity.artistName,
    entityId: wantedReleaseId ?? importCandidateId,
    entityTitle: identity.releaseTitle,
    entityType: wantedReleaseId ? 'wanted_release' : 'import_candidate',
    wantedReleaseId,
    wantedReleaseIds: identity.wantedReleaseIds,
  };
}

function buildRecoveryPayload({
  operationRunId = null,
  recovery = null,
  wantedReleaseId = null,
} = {}) {
  const rediscovery = recovery?.rediscovery && typeof recovery.rediscovery === 'object'
    ? recovery.rediscovery
    : null;
  const terminalOutcome = normalizeOptionalString(recovery?.terminalOutcome);
  const addBlockerCode = normalizeImportCandidateAddBlockerCode(recovery?.addBlockerCode);

  const payload = {
    schemaVersion: MUSIC_QUEUE_ACTIVITY_SCHEMA_VERSION,
    wantedReleaseId,
    recoveryCode: normalizeOptionalString(recovery?.reason),
    operationRunId: normalizeOptionalString(operationRunId),
    retryAt: normalizeOptionalString(recovery?.retryAt),
    nextSearchAfter: normalizeOptionalString(rediscovery?.nextSearchAfter),
    rediscoveryExhausted: rediscovery?.exhausted === true,
    rediscoveryScheduled: rediscovery?.scheduled === true,
    skippedCandidateCount: normalizeNonNegativeInteger(recovery?.skippedCandidateCount),
  };

  if (terminalOutcome) {
    payload.terminalOutcome = terminalOutcome;
  }

  if (addBlockerCode) {
    payload.addBlockerCode = addBlockerCode;
  }

  return payload;
}

/**
 * Builds one durable, release-scoped event for an automatic Music Queue
 * recovery. The payload deliberately excludes provider errors, source users,
 * and paths because Activity is household history rather than a diagnostics
 * sink.
 */
export function buildMusicQueueRecoveryActivityEvent({
  candidate = null,
  operationRunId = null,
  recovery = null,
} = {}) {
  if (!candidate || !recovery || typeof recovery !== 'object') {
    return null;
  }

  const entity = buildMusicQueueEntity(candidate);
  if (!entity.entityId) {
    return null;
  }

  const { wantedReleaseId, wantedReleaseIds, ...activityEntity } = entity;

  let eventType = recovery.requiresOperator === true
    && recovery.terminalOutcome === 'import_blocked'
    ? 'music_queue_import_blocked'
    : 'music_queue_download_failed';
  if (recovery.recovered === true) {
    eventType = recovery.retrySameCandidate === true
      ? 'music_queue_download_retrying'
      : 'music_queue_match_retrying';
  } else if (recovery.rediscovery?.scheduled === true || recovery.rediscovery?.exhausted === true) {
    eventType = 'music_queue_no_matches_left';
  }

  return addMusicQueueActivityFanoutScope({
    ...activityEntity,
    eventType,
    extraPayload: buildRecoveryPayload({
      operationRunId,
      recovery,
      wantedReleaseId,
    }),
  }, { wantedReleaseIds });
}

/**
 * Builds the history row for a user-initiated search-again action after its
 * rediscovery request has persisted successfully.
 */
export function buildMusicQueueSearchQueuedActivityEvent({
  discoveryRunId = null,
  dispatchAlreadyActive = false,
  rediscovery = null,
  release = null,
  wantedReleaseId = null,
} = {}) {
  const resolvedWantedReleaseId = normalizeOptionalString(wantedReleaseId);
  if (!resolvedWantedReleaseId) {
    return null;
  }

  return {
    entityArtist: normalizeOptionalString(release?.artistName),
    entityId: resolvedWantedReleaseId,
    entityTitle: normalizeOptionalString(release?.releaseTitle)
      ?? normalizeOptionalString(release?.releaseGroupTitle),
    entityType: 'wanted_release',
    eventType: 'music_queue_search_queued',
    extraPayload: {
      schemaVersion: MUSIC_QUEUE_ACTIVITY_SCHEMA_VERSION,
      wantedReleaseId: resolvedWantedReleaseId,
      discoveryRunId: normalizeOptionalString(discoveryRunId),
      dispatchAlreadyActive: dispatchAlreadyActive === true,
      nextSearchAfter: normalizeOptionalString(rediscovery?.nextSearchAfter),
    },
  };
}

/**
 * Builds one release-scoped event after Soulseek has accepted the first normal
 * search that was waiting for provider recovery. The recovery marker itself is
 * deliberately not exposed because Activity is not a provider diagnostics log.
 */
export function buildMusicQueueProviderRecoverySearchStartedActivityEvent({
  claimedRequest = null,
} = {}) {
  const wantedReleaseIds = resolveMusicQueueWantedReleaseIds(claimedRequest);
  const wantedReleaseId = wantedReleaseIds[0] ?? normalizeOptionalString(claimedRequest?.wantedReleaseId);
  if (!wantedReleaseId) {
    return null;
  }

  return addMusicQueueActivityFanoutScope({
    entityArtist: normalizeOptionalString(claimedRequest?.artistName),
    entityId: wantedReleaseId,
    entityTitle: normalizeOptionalString(claimedRequest?.releaseTitle)
      ?? normalizeOptionalString(claimedRequest?.releaseGroupTitle),
    entityType: 'wanted_release',
    eventType: 'music_queue_search_started',
    extraPayload: {
      schemaVersion: MUSIC_QUEUE_ACTIVITY_SCHEMA_VERSION,
      wantedReleaseId,
    },
  }, { wantedReleaseIds });
}

/**
 * Records diagnostic Activity without turning its persistence into a workflow
 * failure. This also absorbs a synchronous mock or adapter failure.
 */
export function recordActivityEventSafely(recordActivityEventFn, event) {
  if (typeof recordActivityEventFn !== 'function' || !event) {
    return;
  }

  try {
    for (const scopedEvent of fanOutMusicQueueActivityEvent(event)) {
      Promise.resolve(recordActivityEventFn(scopedEvent)).catch(() => {});
    }
  } catch {
    // Activity cannot interrupt an already-persisted queue transition.
  }
}
