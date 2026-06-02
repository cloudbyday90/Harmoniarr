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
import { createLibraryDiscoveryRequestStore } from './library-discovery-request-store.js';

const discoveryInProgressCode = 'library_discovery_in_progress';

function normalizeMetadataReleaseId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function createLibraryDiscoveryRecoveryRetryService({
  assertMaintenanceWriteAllowed = async () => {},
  getNow = () => new Date(),
  libraryDiscoveryRequestStore = createLibraryDiscoveryRequestStore(),
  recordAuditEventFn = recordAuditEvent,
  startLibraryDiscoveryRun = async () => {
    throw new Error('startLibraryDiscoveryRun dependency is required');
  },
} = {}) {
  async function retryDownloadRecoveryDiscoveryRequest({
    metadataReleaseId,
    requestMetadata = null,
    triggeredByUserId = null,
  } = {}) {
    const normalizedMetadataReleaseId = normalizeMetadataReleaseId(metadataReleaseId);
    if (!normalizedMetadataReleaseId) {
      throw createApiError(400, 'metadata_release_id_required', 'A metadata release id is required');
    }

    await assertMaintenanceWriteAllowed();

    const resetAt = getNow().toISOString();
    const discoveryRequest = await libraryDiscoveryRequestStore.resetDownloadRecoveryExhaustion({
      metadataReleaseId: normalizedMetadataReleaseId,
      resetAt,
      resetByUserId: triggeredByUserId,
    });

    if (!discoveryRequest) {
      throw createApiError(
        409,
        'download_recovery_retry_unavailable',
        'Download recovery retry is only available for exhausted recovery requests',
      );
    }

    let dispatchAlreadyActive = false;
    let run = null;

    try {
      const runResult = await startLibraryDiscoveryRun({
        requestMetadata,
        triggerSource: 'download_recovery_retry',
        triggeredByUserId,
      });
      run = runResult?.run ?? null;
    } catch (error) {
      if (error?.code !== discoveryInProgressCode) {
        throw error;
      }
      dispatchAlreadyActive = true;
    }

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        dispatchAlreadyActive,
        metadataReleaseId: normalizedMetadataReleaseId,
        resetAt,
        runId: run?.id ?? null,
      },
      entityId: normalizedMetadataReleaseId,
      entityType: 'library_discovery_request',
      eventType: 'download_recovery_retry_requested',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Download recovery retry requested',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      discoveryRequest,
      dispatchAlreadyActive,
      run,
    };
  }

  return {
    retryDownloadRecoveryDiscoveryRequest,
  };
}
