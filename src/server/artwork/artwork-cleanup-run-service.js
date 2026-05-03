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
import { calculateArtworkCleanupCutoff } from './artwork-cleanup-service.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { getArtworkCleanupSnapshot } from './artwork-repository.js';

export function createArtworkCleanupRunService({
  assertMaintenanceWriteAllowed = async () => {},
  artworkPolicyService = createArtworkPolicyService(),
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  getArtworkCleanupSnapshotFn = getArtworkCleanupSnapshot,
  nowFn = () => new Date(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.artworkCleanup;

  async function startArtworkCleanupRun({ requestMetadata = null, triggeredByUserId = null } = {}) {
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'artwork_cleanup_in_progress', 'An artwork cleanup run is already running or queued');
    }

    const policy = await artworkPolicyService.getArtworkRuntimePolicy();
    const retentionDays = policy.cleanup?.unassignedRetentionDays ?? 90;
    const retentionCutoff = calculateArtworkCleanupCutoff({
      now: nowFn(),
      retentionDays,
    });
    const snapshot = await getArtworkCleanupSnapshotFn({ unassignedBefore: retentionCutoff });

    if (snapshot.eligibleAssetCount < 1) {
      throw createApiError(409, 'artwork_cleanup_not_ready', 'No retention-eligible unassigned artwork assets are available for cleanup');
    }

    const run = await createOperationRun({
      requestedAssetCount: snapshot.eligibleAssetCount,
      retentionCutoff,
      status: 'pending',
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        requestedAssetCount: snapshot.eligibleAssetCount,
        retentionCutoff,
        runId: run.id,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Artwork cleanup started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startArtworkCleanupRun,
  };
}