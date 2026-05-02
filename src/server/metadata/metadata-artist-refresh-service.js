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

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

export function createMetadataArtistRefreshService({
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRunByMetadataArtistId = async () => null,
  getMetadataArtist = async () => {
    throw new Error('getMetadataArtist dependency is required');
  },
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.metadataArtistRefresh;

  async function startMetadataArtistRefresh({
    metadataArtistId,
    requestMetadata = null,
    triggerSource = 'manual',
    triggeredByUserId = null,
  } = {}) {
    const activeRun = await getActiveRunByMetadataArtistId(metadataArtistId);
    if (activeRun) {
      throw createApiError(409, 'metadata_artist_refresh_in_progress', 'A metadata refresh is already running or queued for this artist');
    }

    const artistPayload = await getMetadataArtist({ artistId: metadataArtistId });
    const artistName = artistPayload?.artist?.name ?? 'Unknown artist';
    const musicBrainzArtistId = artistPayload?.artist?.source?.musicbrainzArtistId ?? null;

    if (!musicBrainzArtistId) {
      throw createApiError(409, 'metadata_artist_refresh_not_supported', 'This artist cannot be refreshed because no MusicBrainz source identifier is recorded');
    }

    const run = await createOperationRun({
      artistName,
      metadataArtistId,
      musicBrainzArtistId,
      triggerSource,
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        artistName,
        metadataArtistId,
        musicBrainzArtistId,
        runId: run.id,
        triggerSource,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Metadata artist refresh started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startMetadataArtistRefresh,
  };
}