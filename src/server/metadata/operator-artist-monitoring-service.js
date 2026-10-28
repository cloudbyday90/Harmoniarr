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

import { createApiError } from '../api-error.js';
import { runParallelTasksAndDrain } from '../parallel-task-drain.js';
import { getPool } from '../database.js';
import {
  defaultOperatorArtistMonitoringPolicy,
  operatorArtistMonitoringAcquisitionProfileKeys,
  operatorArtistMonitoringReleaseGroupTypes,
  operatorArtistMonitoringReleaseScopes,
  operatorArtistMonitoringSearchOnAddModes,
  operatorArtistMonitoringSelectionSourceModes,
  operatorArtistMonitoringWantedAutomationModes,
} from './operator-artist-monitoring-policy.js';
import { createOperatorArtistMonitoringStore } from './operator-artist-monitoring-store.js';

function createMetadataNotFoundError(entityType, entityId) {
  return createApiError(404, 'metadata_not_found', `Metadata ${entityType} was not found: ${entityId}`);
}

function createUserNotFoundError(userId) {
  return createApiError(404, 'app_user_not_found', `App user was not found: ${userId}`);
}

function normalizeEnumValue({ field, value, allowedValues, fallback }) {
  const resolved = typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : fallback;

  if (!allowedValues.includes(resolved)) {
    throw createApiError(400, 'validation_error', `Unsupported ${field}: ${resolved}`);
  }

  return resolved;
}

export function normalizeOperatorArtistMonitoringPatch(patch = {}) {
  const {
    acquisitionProfileKey = defaultOperatorArtistMonitoringPolicy.acquisitionProfileKey,
    isMonitored,
    lastReconciledAt = defaultOperatorArtistMonitoringPolicy.lastReconciledAt,
    lastSavedSnapshotAt = defaultOperatorArtistMonitoringPolicy.lastSavedSnapshotAt,
    monitoredReleaseGroupTypes = defaultOperatorArtistMonitoringPolicy.monitoredReleaseGroupTypes,
    releaseScope = defaultOperatorArtistMonitoringPolicy.releaseScope,
    searchOnAddMode = defaultOperatorArtistMonitoringPolicy.searchOnAddMode,
    selectionSourceMode = defaultOperatorArtistMonitoringPolicy.selectionSourceMode,
    wantedAutomationMode = defaultOperatorArtistMonitoringPolicy.wantedAutomationMode,
  } = patch;

  if (typeof isMonitored !== 'boolean') {
    throw createApiError(400, 'validation_error', 'isMonitored must be a boolean');
  }

  const normalizedTypes = Array.isArray(monitoredReleaseGroupTypes)
    ? [...new Set(monitoredReleaseGroupTypes
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean))]
    : [...defaultOperatorArtistMonitoringPolicy.monitoredReleaseGroupTypes];

  if (normalizedTypes.length === 0) {
    throw createApiError(400, 'validation_error', 'monitoredReleaseGroupTypes must include at least one entry');
  }

  for (const type of normalizedTypes) {
    if (!operatorArtistMonitoringReleaseGroupTypes.includes(type)) {
      throw createApiError(400, 'validation_error', `Unsupported monitored release-group type: ${type}`);
    }
  }

  return {
    acquisitionProfileKey: normalizeEnumValue({
      allowedValues: operatorArtistMonitoringAcquisitionProfileKeys,
      fallback: defaultOperatorArtistMonitoringPolicy.acquisitionProfileKey,
      field: 'acquisition profile key',
      value: acquisitionProfileKey,
    }),
    isMonitored,
    lastReconciledAt: lastReconciledAt ?? null,
    lastSavedSnapshotAt: lastSavedSnapshotAt ?? null,
    monitoredReleaseGroupTypes: normalizedTypes,
    releaseScope: normalizeEnumValue({
      allowedValues: operatorArtistMonitoringReleaseScopes,
      fallback: defaultOperatorArtistMonitoringPolicy.releaseScope,
      field: 'release scope',
      value: releaseScope,
    }),
    searchOnAddMode: normalizeEnumValue({
      allowedValues: operatorArtistMonitoringSearchOnAddModes,
      fallback: defaultOperatorArtistMonitoringPolicy.searchOnAddMode,
      field: 'search-on-add mode',
      value: searchOnAddMode,
    }),
    selectionSourceMode: normalizeEnumValue({
      allowedValues: operatorArtistMonitoringSelectionSourceModes,
      fallback: defaultOperatorArtistMonitoringPolicy.selectionSourceMode,
      field: 'selection source mode',
      value: selectionSourceMode,
    }),
    wantedAutomationMode: normalizeEnumValue({
      allowedValues: operatorArtistMonitoringWantedAutomationModes,
      fallback: defaultOperatorArtistMonitoringPolicy.wantedAutomationMode,
      field: 'wanted automation mode',
      value: wantedAutomationMode,
    }),
  };
}

export function createOperatorArtistMonitoringService({
  getPoolFn = getPool,
  operatorArtistMonitoringStore = createOperatorArtistMonitoringStore(),
} = {}) {
  async function ensureArtistExists(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT id FROM metadata_artists WHERE id = $1 LIMIT 1',
      [metadataArtistId],
    );

    if (result.rows.length === 0) {
      throw createMetadataNotFoundError('artist', metadataArtistId);
    }
  }

  async function ensureUserExists(appUserId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT id FROM app_users WHERE id = $1 LIMIT 1',
      [appUserId],
    );

    if (result.rows.length === 0) {
      throw createUserNotFoundError(appUserId);
    }
  }

  async function getOperatorArtistMonitoring({ appUserId, metadataArtistId }) {
    await runParallelTasksAndDrain([
      () => ensureUserExists(appUserId),
      () => ensureArtistExists(metadataArtistId),
    ]);

    return operatorArtistMonitoringStore.getOperatorArtistMonitoring({
      appUserId,
      metadataArtistId,
    });
  }

  async function updateOperatorArtistMonitoring({ appUserId, metadataArtistId, patch }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);

    const normalizedPatch = normalizeOperatorArtistMonitoringPatch(patch ?? {});

    await operatorArtistMonitoringStore.upsertOperatorArtistMonitoring({
      ...normalizedPatch,
      appUserId,
      metadataArtistId,
    });

    return {
      appUserId,
      metadataArtistId,
      monitoring: normalizedPatch,
    };
  }

  return {
    getOperatorArtistMonitoring,
    updateOperatorArtistMonitoring,
  };
}
