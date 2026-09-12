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

import { normalizeNullableTrackInteger, normalizeNullableTrackUuid } from './operator-track-override-validation.js';
import { getPool } from '../database.js';
import {
  defaultOperatorTrackOverridePolicy,
  operatorTrackOverrideRemapStatuses,
} from './operator-track-override-policy.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function createUserNotFoundError(userId) {
  const error = new Error(`App user was not found: ${userId}`);
  error.status = 404;
  error.code = 'app_user_not_found';
  return error;
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'validation_error';
  return error;
}

export function normalizeOperatorTrackOverridePatch(patch = {}) {
  const {
    isDesired,
    mediumPosition = defaultOperatorTrackOverridePolicy.mediumPosition,
    metadataReleaseId = defaultOperatorTrackOverridePolicy.metadataReleaseId,
    recordingMbid = defaultOperatorTrackOverridePolicy.recordingMbid,
    remapStatus = defaultOperatorTrackOverridePolicy.remapStatus,
    trackLengthMsSnapshot = defaultOperatorTrackOverridePolicy.trackLengthMsSnapshot,
    trackMbid = defaultOperatorTrackOverridePolicy.trackMbid,
    trackPosition = defaultOperatorTrackOverridePolicy.trackPosition,
    trackTitleSnapshot = defaultOperatorTrackOverridePolicy.trackTitleSnapshot,
  } = patch;

  if (typeof isDesired !== 'boolean') {
    throw createValidationError('isDesired must be a boolean');
  }

  const normalizedTrackMbid = normalizeNullableTrackUuid(trackMbid, 'trackMbid');
  const normalizedRecordingMbid = normalizeNullableTrackUuid(recordingMbid, 'recordingMbid');
  const normalizedMediumPosition = normalizeNullableTrackInteger(mediumPosition, 'mediumPosition');
  const normalizedTrackPosition = normalizeNullableTrackInteger(trackPosition, 'trackPosition');
  const normalizedMetadataReleaseId = normalizeNullableTrackUuid(metadataReleaseId, 'metadataReleaseId');
  const normalizedTrackTitleSnapshot = typeof trackTitleSnapshot === 'string'
    ? trackTitleSnapshot.trim()
    : null;
  const normalizedRemapStatus = typeof remapStatus === 'string' && remapStatus.trim().length > 0
    ? remapStatus.trim().toLowerCase()
    : defaultOperatorTrackOverridePolicy.remapStatus;

  if (!operatorTrackOverrideRemapStatuses.includes(normalizedRemapStatus)) {
    throw createValidationError(`Unsupported remap status: ${normalizedRemapStatus}`);
  }

  if (!normalizedTrackMbid) {
    if (!normalizedRecordingMbid) {
      throw createValidationError('recordingMbid is required when trackMbid is not provided');
    }

    if (normalizedMediumPosition == null || normalizedTrackPosition == null) {
      throw createValidationError(
        'mediumPosition and trackPosition are required when trackMbid is not provided',
      );
    }
  }

  if ((normalizedMediumPosition == null) !== (normalizedTrackPosition == null)) {
    throw createValidationError('mediumPosition and trackPosition must be provided together');
  }

  return {
    isDesired,
    mediumPosition: normalizedMediumPosition,
    metadataReleaseId: normalizedMetadataReleaseId,
    recordingMbid: normalizedRecordingMbid,
    remapStatus: normalizedRemapStatus,
    trackLengthMsSnapshot: normalizeNullableTrackInteger(
      trackLengthMsSnapshot,
      'trackLengthMsSnapshot',
      0,
    ),
    trackMbid: normalizedTrackMbid,
    trackPosition: normalizedTrackPosition,
    trackTitleSnapshot: normalizedTrackTitleSnapshot?.length > 0 ? normalizedTrackTitleSnapshot : null,
  };
}

export function createOperatorTrackOverrideService({
  getPoolFn = getPool,
  operatorTrackOverrideStore = createOperatorTrackOverrideStore(),
} = {}) {
  async function ensureUserExists(appUserId) {
    const pool = getPoolFn();
    const result = await pool.query('SELECT id FROM app_users WHERE id = $1 LIMIT 1', [appUserId]);
    if (result.rows.length === 0) {
      throw createUserNotFoundError(appUserId);
    }
  }

  async function ensureArtistExists(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query('SELECT id FROM metadata_artists WHERE id = $1 LIMIT 1', [metadataArtistId]);
    if (result.rows.length === 0) {
      throw createMetadataNotFoundError('artist', metadataArtistId);
    }
  }

  async function getReleaseGroupContext(metadataReleaseGroupId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, metadata_artist_id
        FROM metadata_release_groups
        WHERE id = $1
        LIMIT 1
      `,
      [metadataReleaseGroupId],
    );

    if (result.rows.length === 0) {
      throw createMetadataNotFoundError('release group', metadataReleaseGroupId);
    }

    return {
      metadataArtistId: result.rows[0].metadata_artist_id,
      metadataReleaseGroupId: result.rows[0].id,
    };
  }

  async function ensureResolvedReleaseBelongsToGroup({ metadataReleaseGroupId, metadataReleaseId }) {
    if (!metadataReleaseId) {
      return;
    }

    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id
        FROM metadata_releases
        WHERE id = $1
          AND metadata_release_group_id = $2
        LIMIT 1
      `,
      [metadataReleaseId, metadataReleaseGroupId],
    );

    if (result.rows.length === 0) {
      throw createValidationError(
        `Resolved release ${metadataReleaseId} does not belong to release group ${metadataReleaseGroupId}`,
      );
    }
  }

  async function getOperatorTrackOverride({
    appUserId,
    mediumPosition = null,
    metadataArtistId,
    metadataReleaseGroupId,
    metadataReleaseId = null,
    recordingMbid = null,
    trackMbid = null,
    trackPosition = null,
  }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);
    const context = await getReleaseGroupContext(metadataReleaseGroupId);
    if (context.metadataArtistId !== metadataArtistId) {
      throw createValidationError(
        `Release group ${metadataReleaseGroupId} does not belong to artist ${metadataArtistId}`,
      );
    }

    return operatorTrackOverrideStore.getOperatorTrackOverride({
      appUserId,
      mediumPosition,
      metadataReleaseGroupId,
      metadataReleaseId,
      recordingMbid,
      trackMbid,
      trackPosition,
    });
  }

  async function updateOperatorTrackOverride({
    appUserId,
    metadataArtistId,
    metadataReleaseGroupId,
    patch,
  }) {
    const normalizedPatch = normalizeOperatorTrackOverridePatch(patch ?? {});
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);
    const context = await getReleaseGroupContext(metadataReleaseGroupId);
    if (context.metadataArtistId !== metadataArtistId) {
      throw createValidationError(
        `Release group ${metadataReleaseGroupId} does not belong to artist ${metadataArtistId}`,
      );
    }

    await ensureResolvedReleaseBelongsToGroup({
      metadataReleaseGroupId,
      metadataReleaseId: normalizedPatch.metadataReleaseId,
    });

    await operatorTrackOverrideStore.upsertOperatorTrackOverride({
      ...normalizedPatch,
      appUserId,
      metadataArtistId,
      metadataReleaseGroupId,
    });

    return {
      appUserId,
      metadataArtistId,
      metadataReleaseGroupId,
      override: normalizedPatch,
    };
  }

  return {
    getOperatorTrackOverride,
    updateOperatorTrackOverride,
  };
}
