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

import { getPool } from '../database.js';
import { normalizeOperatorArtistMonitoringPatch } from './operator-artist-monitoring-service.js';
import { createOperatorArtistMonitoringStore } from './operator-artist-monitoring-store.js';
import { createOperatorArtistProjectionService } from './operator-artist-projection-service.js';
import { createOperatorArtistReconciliationRunStore } from './operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationSnapshotStore } from './operator-artist-reconciliation-snapshot-store.js';
import { normalizeOperatorReleaseGroupSelectionPatch } from './operator-release-group-selection-service.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { normalizeOperatorTrackOverridePatch } from './operator-track-override-service.js';
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

function isUniqueViolation(error) {
  return error?.code === '23505';
}

function assertPlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createValidationError(`${field} must be an object`);
  }
}

function assertArray(value, field) {
  if (!Array.isArray(value)) {
    throw createValidationError(`${field} must be an array`);
  }
}

function buildTrackOverrideIdentityKey(trackOverride) {
  if (trackOverride.trackMbid) {
    return `track:${trackOverride.metadataReleaseGroupId}:${trackOverride.trackMbid}`;
  }

  return [
    'fallback',
    trackOverride.metadataReleaseGroupId,
    trackOverride.metadataReleaseId ?? '',
    trackOverride.recordingMbid ?? '',
    trackOverride.mediumPosition ?? '',
    trackOverride.trackPosition ?? '',
  ].join(':');
}

function summarizeSnapshot(snapshot) {
  return {
    createdAt: snapshot.createdAt ?? null,
    id: snapshot.id,
    snapshotRevision: snapshot.snapshotRevision,
    updatedAt: snapshot.updatedAt ?? null,
  };
}

function summarizeQueueResult(queueResult) {
  return {
    accepted: true,
    coalesced: queueResult.action === 'replaced_pending' || queueResult.action === 'replaced_pending_follow_up',
    queuedBehindRun: Boolean(queueResult.runningRun),
    replacedPending: queueResult.action === 'replaced_pending' || queueResult.action === 'replaced_pending_follow_up',
    run: queueResult.run,
    runningRun: queueResult.runningRun ?? null,
  };
}

function normalizeReleaseGroupSelections(releaseGroupSelections = []) {
  assertArray(releaseGroupSelections, 'releaseGroupSelections');
  const normalizedSelections = [];
  const seenReleaseGroupIds = new Set();

  for (const [index, rawSelection] of releaseGroupSelections.entries()) {
    assertPlainObject(rawSelection, `releaseGroupSelections[${index}]`);
    const metadataReleaseGroupId = typeof rawSelection.metadataReleaseGroupId === 'string'
      ? rawSelection.metadataReleaseGroupId.trim()
      : '';

    if (metadataReleaseGroupId.length === 0) {
      throw createValidationError(`releaseGroupSelections[${index}].metadataReleaseGroupId is required`);
    }

    if (seenReleaseGroupIds.has(metadataReleaseGroupId)) {
      throw createValidationError(`Duplicate release-group selection for ${metadataReleaseGroupId}`);
    }
    seenReleaseGroupIds.add(metadataReleaseGroupId);

    normalizedSelections.push({
      metadataReleaseGroupId,
      ...normalizeOperatorReleaseGroupSelectionPatch(rawSelection),
    });
  }

  return normalizedSelections;
}

function normalizeTrackOverrides(trackOverrides = []) {
  assertArray(trackOverrides, 'trackOverrides');
  const normalizedOverrides = [];
  const seenOverrideKeys = new Set();

  for (const [index, rawOverride] of trackOverrides.entries()) {
    assertPlainObject(rawOverride, `trackOverrides[${index}]`);
    const metadataReleaseGroupId = typeof rawOverride.metadataReleaseGroupId === 'string'
      ? rawOverride.metadataReleaseGroupId.trim()
      : '';

    if (metadataReleaseGroupId.length === 0) {
      throw createValidationError(`trackOverrides[${index}].metadataReleaseGroupId is required`);
    }

    const normalizedOverride = {
      metadataReleaseGroupId,
      ...normalizeOperatorTrackOverridePatch(rawOverride),
    };
    const identityKey = buildTrackOverrideIdentityKey(normalizedOverride);

    if (seenOverrideKeys.has(identityKey)) {
      throw createValidationError(`Duplicate track override identity for ${metadataReleaseGroupId}`);
    }
    seenOverrideKeys.add(identityKey);
    normalizedOverrides.push(normalizedOverride);
  }

  return normalizedOverrides;
}

function buildSnapshotPayload({
  metadataArtistId,
  monitoring,
  releaseGroupSelections,
  trackOverrides,
}) {
  const sortedSelections = [...releaseGroupSelections].sort((left, right) => (
    left.metadataReleaseGroupId.localeCompare(right.metadataReleaseGroupId)
  ));
  const sortedOverrides = [...trackOverrides].sort((left, right) => (
    buildTrackOverrideIdentityKey(left).localeCompare(buildTrackOverrideIdentityKey(right))
  ));

  return {
    metadataArtistId,
    monitoring: {
      acquisitionProfileKey: monitoring.acquisitionProfileKey,
      isMonitored: monitoring.isMonitored,
      monitoredReleaseGroupTypes: structuredClone(monitoring.monitoredReleaseGroupTypes),
      releaseScope: monitoring.releaseScope,
      searchOnAddMode: monitoring.searchOnAddMode,
      selectionSourceMode: monitoring.selectionSourceMode,
      wantedAutomationMode: monitoring.wantedAutomationMode,
    },
    releaseGroupSelections: structuredClone(sortedSelections),
    savedBy: 'operator_artist_detail',
    trackOverrides: structuredClone(sortedOverrides),
  };
}

async function fetchArtistRow({ client, metadataArtistId }) {
  const result = await client.query(
    `
      SELECT id, name
      FROM metadata_artists
      WHERE id = $1
      LIMIT 1
    `,
    [metadataArtistId],
  );

  if (result.rows.length === 0) {
    throw createMetadataNotFoundError('artist', metadataArtistId);
  }

  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
  };
}

async function ensureUserExists({ appUserId, client }) {
  const result = await client.query(
    'SELECT id FROM app_users WHERE id = $1 LIMIT 1',
    [appUserId],
  );

  if (result.rows.length === 0) {
    throw createUserNotFoundError(appUserId);
  }
}

async function fetchExistingMonitoringTimestamps({ appUserId, client, metadataArtistId }) {
  const result = await client.query(
    `
      SELECT last_reconciled_at, last_saved_snapshot_at
      FROM operator_artist_monitoring
      WHERE app_user_id = $1
        AND metadata_artist_id = $2
      LIMIT 1
    `,
    [appUserId, metadataArtistId],
  );

  return {
    lastReconciledAt: result.rows[0]?.last_reconciled_at?.toISOString?.() ?? null,
    lastSavedSnapshotAt: result.rows[0]?.last_saved_snapshot_at?.toISOString?.() ?? null,
  };
}

async function fetchReleaseGroupOwnership({ client, metadataArtistId, referencedReleaseGroupIds }) {
  if (referencedReleaseGroupIds.length === 0) {
    return new Map();
  }

  const result = await client.query(
    `
      SELECT id, metadata_artist_id
      FROM metadata_release_groups
      WHERE id = ANY($1::uuid[])
    `,
    [referencedReleaseGroupIds],
  );
  const rowsById = new Map(result.rows.map((row) => [row.id, row]));

  for (const metadataReleaseGroupId of referencedReleaseGroupIds) {
    const row = rowsById.get(metadataReleaseGroupId);
    if (!row) {
      throw createMetadataNotFoundError('release group', metadataReleaseGroupId);
    }

    if (row.metadata_artist_id !== metadataArtistId) {
      throw createValidationError(
        `Release group ${metadataReleaseGroupId} does not belong to artist ${metadataArtistId}`,
      );
    }
  }

  return rowsById;
}

async function ensureResolvedReleasesBelongToGroups({ client, resolvedReleaseReferences }) {
  if (resolvedReleaseReferences.length === 0) {
    return;
  }

  const uniqueReleaseIds = [...new Set(
    resolvedReleaseReferences.map((reference) => reference.metadataReleaseId),
  )];
  const result = await client.query(
    `
      SELECT id, metadata_release_group_id
      FROM metadata_releases
      WHERE id = ANY($1::uuid[])
    `,
    [uniqueReleaseIds],
  );
  const rowsById = new Map(result.rows.map((row) => [row.id, row]));

  for (const reference of resolvedReleaseReferences) {
    const row = rowsById.get(reference.metadataReleaseId);
    if (!row) {
      throw createMetadataNotFoundError('release', reference.metadataReleaseId);
    }

    if (row.metadata_release_group_id !== reference.metadataReleaseGroupId) {
      throw createValidationError(
        `Resolved release ${reference.metadataReleaseId} does not belong to release group ${reference.metadataReleaseGroupId}`,
      );
    }
  }
}

export function createOperatorArtistSaveService({
  getPoolFn = getPool,
  maxSaveRetries = 3,
  getOperatorArtistProjection = null,
  operatorArtistMonitoringStore = createOperatorArtistMonitoringStore(),
  operatorArtistProjectionService = null,
  operatorArtistReconciliationRunStore = createOperatorArtistReconciliationRunStore(),
  operatorArtistReconciliationSnapshotStore = createOperatorArtistReconciliationSnapshotStore(),
  operatorReleaseGroupSelectionStore = createOperatorReleaseGroupSelectionStore(),
  operatorTrackOverrideStore = createOperatorTrackOverrideStore(),
  startMetadataArtistRefresh = null,
} = {}) {
  const resolvedOperatorArtistProjectionService = operatorArtistProjectionService
    ?? createOperatorArtistProjectionService();
  const readOperatorArtistProjection = getOperatorArtistProjection
    ?? resolvedOperatorArtistProjectionService.getOperatorArtistProjection;

  async function saveOperatorArtist({
    appUserId,
    draft,
    metadataArtistId,
    triggerSource = 'save',
    triggeredByUserId = null,
  }) {
    assertPlainObject(draft, 'draft');
    assertPlainObject(draft.monitoring, 'draft.monitoring');

    const normalizedMonitoringPatch = normalizeOperatorArtistMonitoringPatch(draft.monitoring);
    const normalizedReleaseGroupSelections = normalizeReleaseGroupSelections(
      draft.releaseGroupSelections ?? [],
    );
    const normalizedTrackOverrides = normalizeTrackOverrides(draft.trackOverrides ?? []);

    if (normalizedMonitoringPatch.isMonitored !== true) {
      if (normalizedReleaseGroupSelections.length > 0 || normalizedTrackOverrides.length > 0) {
        throw createValidationError(
          'Explicit release-group selections and track overrides require isMonitored to be true',
        );
      }
    }

    if (
      normalizedMonitoringPatch.selectionSourceMode === 'policy_only'
      && (normalizedReleaseGroupSelections.length > 0 || normalizedTrackOverrides.length > 0)
    ) {
      throw createValidationError(
        'selectionSourceMode policy_only does not allow explicit release-group selections or track overrides',
      );
    }

    const referencedReleaseGroupIds = [...new Set([
      ...normalizedReleaseGroupSelections.map((selection) => selection.metadataReleaseGroupId),
      ...normalizedTrackOverrides.map((trackOverride) => trackOverride.metadataReleaseGroupId),
    ])];
    const resolvedReleaseReferences = [
      ...normalizedReleaseGroupSelections
        .filter((selection) => selection.resolvedMetadataReleaseId)
        .map((selection) => ({
          metadataReleaseGroupId: selection.metadataReleaseGroupId,
          metadataReleaseId: selection.resolvedMetadataReleaseId,
        })),
      ...normalizedTrackOverrides
        .filter((trackOverride) => trackOverride.metadataReleaseId)
        .map((trackOverride) => ({
          metadataReleaseGroupId: trackOverride.metadataReleaseGroupId,
          metadataReleaseId: trackOverride.metadataReleaseId,
        })),
    ];

    const pool = getPoolFn();

    for (let attemptIndex = 0; attemptIndex < maxSaveRetries; attemptIndex += 1) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await ensureUserExists({ appUserId, client });
        const artist = await fetchArtistRow({ client, metadataArtistId });
        const existingMonitoring = await fetchExistingMonitoringTimestamps({
          appUserId,
          client,
          metadataArtistId,
        });

        await fetchReleaseGroupOwnership({
          client,
          metadataArtistId,
          referencedReleaseGroupIds,
        });
        await ensureResolvedReleasesBelongToGroups({
          client,
          resolvedReleaseReferences,
        });

        const persistedMonitoring = {
          ...normalizedMonitoringPatch,
          appUserId,
          lastReconciledAt: existingMonitoring.lastReconciledAt,
          lastSavedSnapshotAt: existingMonitoring.lastSavedSnapshotAt,
          metadataArtistId,
        };

        await operatorArtistMonitoringStore.upsertOperatorArtistMonitoring({
          ...persistedMonitoring,
          queryable: client,
        });
        await operatorReleaseGroupSelectionStore.replaceOperatorArtistReleaseGroupSelections({
          appUserId,
          metadataArtistId,
          operatorReleaseGroupSelections: normalizedReleaseGroupSelections,
          queryable: client,
        });
        await operatorTrackOverrideStore.replaceOperatorArtistTrackOverrides({
          appUserId,
          metadataArtistId,
          operatorTrackOverrides: normalizedTrackOverrides,
          queryable: client,
        });

        const snapshotPayload = buildSnapshotPayload({
          metadataArtistId,
          monitoring: persistedMonitoring,
          releaseGroupSelections: normalizedReleaseGroupSelections,
          trackOverrides: normalizedTrackOverrides,
        });
        const snapshot = await operatorArtistReconciliationSnapshotStore.createOperatorArtistReconciliationSnapshot({
          appUserId,
          metadataArtistId,
          queryable: client,
          snapshotPayload,
        });

        await operatorArtistMonitoringStore.upsertOperatorArtistMonitoring({
          ...persistedMonitoring,
          lastSavedSnapshotAt: snapshot.updatedAt ?? snapshot.createdAt ?? null,
          queryable: client,
        });

        const queueResult = await operatorArtistReconciliationRunStore.queueLatestSnapshotRun({
          appUserId,
          artistName: artist.name ?? 'Unknown artist',
          client,
          metadataArtistId,
          snapshotId: snapshot.id,
          snapshotRevision: snapshot.snapshotRevision,
          triggerSource,
          triggeredByUserId,
        });

        await client.query('COMMIT');

        if (normalizedMonitoringPatch.isMonitored === true && typeof startMetadataArtistRefresh === 'function') {
          // Kick off a metadata catalog refresh so the artist's discography is
          // fetched as soon as they are monitored. Each artist queues its own
          // run; successive adds are independent. A run that is already queued
          // or running for this artist surfaces as a 409 which we ignore.
          void Promise.resolve()
            .then(() => startMetadataArtistRefresh({
              metadataArtistId,
              triggerSource: 'monitor_added',
              triggeredByUserId,
            }))
            .catch((error) => {
              if (error?.code === 'metadata_artist_refresh_in_progress') {
                return;
              }
              // Swallow remaining errors: the scheduled heartbeat refresh
              // remains the durable fallback, so add must not fail on this.
            });
        }

        let projection = null;
        try {
          projection = await readOperatorArtistProjection({ appUserId, metadataArtistId });
        } catch {
          projection = null;
        }

        return {
          artistId: metadataArtistId,
          operator: projection?.operator ?? null,
          projection,
          reconciliation: summarizeQueueResult(queueResult),
          snapshot: summarizeSnapshot(snapshot),
        };
      } catch (error) {
        await client.query('ROLLBACK');

        if (isUniqueViolation(error) && attemptIndex + 1 < maxSaveRetries) {
          continue;
        }

        throw error;
      } finally {
        client.release();
      }
    }

    throw createValidationError('Unable to save operator artist state');
  }

  return {
    saveOperatorArtist,
  };
}
