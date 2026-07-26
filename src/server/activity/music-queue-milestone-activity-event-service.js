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

const ACTIVITY_SCHEMA_VERSION = 1;

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

function resolveMusicQueueContext(candidate) {
  if (candidate?.musicQueueContext && typeof candidate.musicQueueContext === 'object') {
    return candidate.musicQueueContext;
  }

  if (candidate?.normalizedPayload?.musicQueue && typeof candidate.normalizedPayload.musicQueue === 'object') {
    return candidate.normalizedPayload.musicQueue;
  }

  return {};
}

function resolveReleaseIdentity(candidate) {
  const requestOwnership = resolveRequestOwnership(candidate);
  const releaseIdentity = candidate?.releaseIdentity && typeof candidate.releaseIdentity === 'object'
    ? candidate.releaseIdentity
    : {};
  const musicQueueContext = resolveMusicQueueContext(candidate);

  return {
    artistName: normalizeOptionalString(releaseIdentity.artistName)
      ?? normalizeOptionalString(requestOwnership.artistName),
    importCandidateId: normalizeOptionalString(candidate?.id),
    releaseTitle: normalizeOptionalString(releaseIdentity.releaseTitle)
      ?? normalizeOptionalString(requestOwnership.releaseTitle)
      ?? normalizeOptionalString(requestOwnership.releaseGroupTitle),
    wantedReleaseId: normalizeOptionalString(candidate?.wantedReleaseId)
      ?? normalizeOptionalString(musicQueueContext.wantedReleaseId)
      ?? normalizeOptionalString(musicQueueContext.qualityOverride?.wantedReleaseId)
      ?? normalizeOptionalString(requestOwnership.wantedReleaseId),
  };
}

function buildEntity(candidate) {
  const identity = resolveReleaseIdentity(candidate);
  const entityId = identity.wantedReleaseId ?? identity.importCandidateId;
  if (!entityId) {
    return null;
  }

  return {
    entityArtist: identity.artistName,
    entityId,
    entityTitle: identity.releaseTitle,
    entityType: identity.wantedReleaseId ? 'wanted_release' : 'import_candidate',
    importCandidateId: identity.importCandidateId,
    wantedReleaseId: identity.wantedReleaseId,
  };
}

function buildPayload(entity, payload = {}) {
  return {
    schemaVersion: ACTIVITY_SCHEMA_VERSION,
    wantedReleaseId: entity.wantedReleaseId,
    importCandidateId: entity.importCandidateId,
    ...payload,
  };
}

function toActivityEvent({ actorUserId = null, candidate, eventType, payload }) {
  const entity = buildEntity(candidate);
  if (!entity) {
    return null;
  }

  const { importCandidateId, wantedReleaseId, ...activityEntity } = entity;
  return {
    actorUserId: normalizeOptionalString(actorUserId),
    ...activityEntity,
    eventType,
    extraPayload: buildPayload({ importCandidateId, wantedReleaseId }, payload),
  };
}

/**
 * Builds a release-scoped history event after Harmoniarr has selected a match.
 * The payload retains only the durable identifiers needed for a safe handoff.
 */
export function buildMusicQueueMatchSelectedActivityEvent({
  actorUserId = null,
  candidate = null,
  selectionMode = 'automatic',
} = {}) {
  return toActivityEvent({
    actorUserId,
    candidate,
    eventType: 'music_queue_match_selected',
    payload: {
      selectionMode: selectionMode === 'manual' ? 'manual' : 'automatic',
    },
  });
}

/**
 * Builds a release-scoped history event after the provider accepts a transfer.
 */
export function buildMusicQueueDownloadStartedActivityEvent({
  candidate = null,
  operationRunId = null,
  queuedFileCount = null,
  queuedWithWarnings = false,
} = {}) {
  return toActivityEvent({
    candidate,
    eventType: 'music_queue_download_started',
    payload: {
      operationRunId: normalizeOptionalString(operationRunId),
      queuedFileCount: normalizeNonNegativeInteger(queuedFileCount),
      queuedWithWarnings: queuedWithWarnings === true,
    },
  });
}

/**
 * Builds the existing completion event with a release subject instead of a
 * provider folder path.
 */
export function buildMusicQueueDownloadCompletedActivityEvent({
  candidate = null,
  operationRunId = null,
} = {}) {
  return toActivityEvent({
    candidate,
    eventType: 'download_completed',
    payload: {
      operationRunId: normalizeOptionalString(operationRunId),
    },
  });
}

/**
 * Builds one audio-inspection event. Ordinary successful checks remain
 * informational, while warnings and unavailable tooling get a clear repair
 * handoff in the client.
 */
export function buildMusicQueueAudioInspectionActivityEvent({
  candidate = null,
  inspectionUnavailableCount = 0,
  operationRunId = null,
  warningCount = 0,
} = {}) {
  const unavailableCount = normalizeNonNegativeInteger(inspectionUnavailableCount) ?? 0;
  const normalizedWarningCount = normalizeNonNegativeInteger(warningCount) ?? 0;
  const eventType = unavailableCount > 0
    ? 'music_queue_audio_check_failed'
    : normalizedWarningCount > 0
      ? 'music_queue_audio_warning'
      : 'music_queue_audio_checked';

  return toActivityEvent({
    candidate,
    eventType,
    payload: {
      inspectionUnavailableCount: unavailableCount,
      operationRunId: normalizeOptionalString(operationRunId),
      warningCount: normalizedWarningCount,
    },
  });
}
