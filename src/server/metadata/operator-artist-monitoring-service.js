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

function normalizeEnumValue({ field, value, allowedValues, fallback }) {
  const resolved = typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : fallback;

  if (!allowedValues.includes(resolved)) {
    const error = new Error(`Unsupported ${field}: ${resolved}`);
    error.status = 400;
    error.code = 'validation_error';
    throw error;
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
    const error = new Error('isMonitored must be a boolean');
    error.status = 400;
    error.code = 'validation_error';
    throw error;
  }

  const normalizedTypes = Array.isArray(monitoredReleaseGroupTypes)
    ? [...new Set(monitoredReleaseGroupTypes
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean))]
    : [...defaultOperatorArtistMonitoringPolicy.monitoredReleaseGroupTypes];

  if (normalizedTypes.length === 0) {
    const error = new Error('monitoredReleaseGroupTypes must include at least one entry');
    error.status = 400;
    error.code = 'validation_error';
    throw error;
  }

  for (const type of normalizedTypes) {
    if (!operatorArtistMonitoringReleaseGroupTypes.includes(type)) {
      const error = new Error(`Unsupported monitored release-group type: ${type}`);
      error.status = 400;
      error.code = 'validation_error';
      throw error;
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
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
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
