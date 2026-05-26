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
import { createOperatorArtistMonitoringStore } from './operator-artist-monitoring-store.js';
import { createOperatorArtistProjectionService } from './operator-artist-projection-service.js';

function createUserNotFoundError(userId) {
  const error = new Error(`App user was not found: ${userId}`);
  error.status = 404;
  error.code = 'app_user_not_found';
  return error;
}

function normalizeLimit(limit, defaultValue = 25, maxValue = 50) {
  if (limit == null || limit === '') {
    return defaultValue;
  }

  const numericLimit = Number(limit);
  if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
    const error = new Error('limit must be a positive integer');
    error.status = 400;
    error.code = 'validation_error';
    throw error;
  }

  return Math.min(numericLimit, maxValue);
}

function summarizeCardState({
  artist,
  monitoring,
  overview,
  reconciliation,
}) {
  return {
    artist: {
      country: artist?.country ?? null,
      disambiguation: artist?.disambiguation ?? null,
      id: artist?.id ?? null,
      musicBrainzArtistId: artist?.musicBrainzArtistId ?? null,
      name: artist?.name ?? null,
      sortName: artist?.sortName ?? null,
      type: artist?.type ?? null,
    },
    operator: {
      monitoring,
      overview: {
        desiredReleaseGroupCount: overview?.desiredReleaseGroupCount ?? 0,
        desiredTrackOverrideCount: overview?.desiredTrackOverrideCount ?? 0,
        hasManualOverrides: overview?.hasManualOverrides === true,
        partialReleaseGroupCount: overview?.partialReleaseGroupCount ?? 0,
        releaseGroupCount: overview?.releaseGroupCount ?? 0,
        reviewNeededTrackOverrideCount: overview?.reviewNeededTrackOverrideCount ?? 0,
        selectedReleaseGroupCount: overview?.selectedReleaseGroupCount ?? 0,
        suppressedTrackOverrideCount: overview?.suppressedTrackOverrideCount ?? 0,
        trackOverrideCount: overview?.trackOverrideCount ?? 0,
        unselectedReleaseGroupCount: overview?.unselectedReleaseGroupCount ?? 0,
      },
      reconciliation: {
        latestRun: reconciliation?.latestRun ?? null,
        latestSnapshot: reconciliation?.latestSnapshot ?? null,
        pendingRun: reconciliation?.pendingRun ?? null,
        runningRun: reconciliation?.runningRun ?? null,
        status: reconciliation?.status ?? 'idle',
      },
    },
  };
}

export function createOperatorMonitoredArtistProjectionService({
  getPoolFn = getPool,
  getOperatorArtistProjection = null,
  listOperatorMonitoredArtists = null,
  operatorArtistMonitoringStore = createOperatorArtistMonitoringStore(),
  operatorArtistProjectionService = createOperatorArtistProjectionService(),
} = {}) {
  const readOperatorArtistProjection = getOperatorArtistProjection
    ?? operatorArtistProjectionService.getOperatorArtistProjection;
  const readOperatorMonitoredArtists = listOperatorMonitoredArtists
    ?? operatorArtistMonitoringStore.listOperatorMonitoredArtists;

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

  async function listOperatorMonitoredArtistProjections({
    appUserId,
    limit,
  }) {
    await ensureUserExists(appUserId);

    const normalizedLimit = normalizeLimit(limit);
    const monitoredArtists = await readOperatorMonitoredArtists({
      appUserId,
      limit: normalizedLimit,
      offset: 0,
    });

    const settledResults = await Promise.allSettled(
      monitoredArtists.map(async ({ artist, monitoring }) => {
        const projection = await readOperatorArtistProjection({
          appUserId,
          metadataArtistId: artist.id,
        });

        return summarizeCardState({
          artist: {
            ...artist,
            country: projection.artist?.country ?? artist.country ?? null,
            disambiguation: projection.artist?.disambiguation ?? artist.disambiguation ?? null,
            musicBrainzArtistId: projection.artist?.musicBrainzArtistId ?? artist.musicBrainzArtistId ?? null,
            name: projection.artist?.name ?? artist.name ?? null,
            sortName: projection.artist?.sortName ?? artist.sortName ?? null,
            type: projection.artist?.type ?? artist.type ?? null,
          },
          monitoring: projection.operator?.monitoring ?? monitoring,
          overview: projection.operator?.overview,
          reconciliation: projection.operator?.reconciliation,
        });
      }),
    );

    const results = [];
    for (const settledResult of settledResults) {
      if (settledResult.status === 'fulfilled') {
        results.push(settledResult.value);
        continue;
      }

      const error = settledResult.reason;
      if (error?.code !== 'metadata_not_found') {
        throw error;
      }
    }

    return {
      limit: normalizedLimit,
      results,
    };
  }

  return {
    listOperatorMonitoredArtistProjections,
  };
}
