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
import { createMetadataMonitoringStore } from './metadata-monitoring-store.js';
import { createMetadataRefreshSchedulerService } from './metadata-refresh-scheduler-service.js';

const allowedReleaseGroupTypes = new Set(['album', 'ep']);

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function normalizeArtistMonitoringPatch({ isMonitored, monitoredReleaseGroupTypes }) {
  if (typeof isMonitored !== 'boolean') {
    const error = new Error('isMonitored must be a boolean');
    error.status = 400;
    error.code = 'validation_error';
    throw error;
  }

  const normalizedTypes = Array.isArray(monitoredReleaseGroupTypes)
    ? monitoredReleaseGroupTypes
      .map((entry) => String(entry).trim().toLowerCase())
      .filter(Boolean)
    : ['album', 'ep'];

  if (normalizedTypes.length === 0) {
    const error = new Error('monitoredReleaseGroupTypes must include at least one entry');
    error.status = 400;
    error.code = 'validation_error';
    throw error;
  }

  for (const type of normalizedTypes) {
    if (!allowedReleaseGroupTypes.has(type)) {
      const error = new Error(`Unsupported monitored release-group type: ${type}`);
      error.status = 400;
      error.code = 'validation_error';
      throw error;
    }
  }

  return {
    isMonitored,
    monitoredReleaseGroupTypes: [...new Set(normalizedTypes)],
  };
}

export function createMetadataMonitoringService({
  getPoolFn = getPool,
  metadataMonitoringStore = createMetadataMonitoringStore(),
  metadataRefreshSchedulerService = createMetadataRefreshSchedulerService({ metadataMonitoringStore }),
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

  async function getArtistMonitoring({ metadataArtistId }) {
    await ensureArtistExists(metadataArtistId);
    return metadataMonitoringStore.getArtistMonitoring(metadataArtistId);
  }

  async function updateArtistMonitoring({ metadataArtistId, patch }) {
    await ensureArtistExists(metadataArtistId);
    const normalizedPatch = normalizeArtistMonitoringPatch(patch ?? {});

    await metadataMonitoringStore.upsertArtistMonitoring({
      ...normalizedPatch,
      metadataArtistId,
    });

    if (normalizedPatch.isMonitored) {
      await metadataRefreshSchedulerService.ensureArtistRefreshScheduled({ metadataArtistId });
    } else {
      await metadataRefreshSchedulerService.clearArtistRefreshSchedule({ metadataArtistId });
    }

    return {
      artistId: metadataArtistId,
      monitoring: normalizedPatch,
    };
  }

  return {
    getArtistMonitoring,
    updateArtistMonitoring,
  };
}