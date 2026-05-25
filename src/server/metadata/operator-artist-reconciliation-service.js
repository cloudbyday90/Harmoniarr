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
import { createOperatorArtistReconciliationRunStore } from './operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationSnapshotService } from './operator-artist-reconciliation-snapshot-service.js';

export function createOperatorArtistReconciliationService({
  getLatestOperatorArtistReconciliationSnapshot = null,
  getMetadataArtist = null,
  queueLatestSnapshotRun = null,
  recordAuditEventFn = recordAuditEvent,
  snapshotService = null,
  runStore = null,
} = {}) {
  const operationDescriptor = operationRunRegistry.operatorArtistReconciliation;
  const resolvedRunStore = runStore ?? createOperatorArtistReconciliationRunStore();
  const resolvedSnapshotService = snapshotService ?? createOperatorArtistReconciliationSnapshotService();
  const getLatestSnapshot = getLatestOperatorArtistReconciliationSnapshot
    ?? resolvedSnapshotService.getLatestOperatorArtistReconciliationSnapshot;
  const queueLatestRun = queueLatestSnapshotRun ?? resolvedRunStore.queueLatestSnapshotRun;

  if (typeof getMetadataArtist !== 'function') {
    throw new Error('getMetadataArtist dependency is required');
  }

  function createMetadataArtistNotFoundError(metadataArtistId) {
    return createApiError(
      404,
      'metadata_artist_not_found',
      `The requested metadata artist could not be found: ${metadataArtistId}`,
    );
  }

  async function queueOperatorArtistReconciliation({
    appUserId,
    metadataArtistId,
    requestMetadata = null,
    triggerSource = 'save',
    triggeredByUserId = null,
  } = {}) {
    const latestSnapshot = await getLatestSnapshot({ appUserId, metadataArtistId });
    if (!latestSnapshot) {
      throw createApiError(
        409,
        'operator_artist_reconciliation_not_ready',
        'No saved artist reconciliation snapshot is available yet for this operator and artist',
      );
    }

    const artistPayload = await getMetadataArtist({ artistId: metadataArtistId });
    if (!artistPayload?.artist?.id) {
      throw createMetadataArtistNotFoundError(metadataArtistId);
    }

    const artistName = artistPayload?.artist?.name ?? 'Unknown artist';
    const queueResult = await queueLatestRun({
      appUserId,
      artistName,
      metadataArtistId,
      snapshotId: latestSnapshot.id,
      snapshotRevision: latestSnapshot.snapshotRevision,
      triggerSource,
      triggeredByUserId,
    });
    const shouldRecordAuditEvent = queueResult.action === 'created'
      || queueResult.action === 'queued_follow_up';

    if (shouldRecordAuditEvent) {
      await recordAuditEventFn({
        actorType: triggeredByUserId ? 'user' : 'system',
        actorUserId: triggeredByUserId,
        details: {
          appUserId,
          artistName,
          metadataArtistId,
          runId: queueResult.run.id,
          runningRunId: queueResult.runningRun?.id ?? null,
          snapshotId: latestSnapshot.id,
          snapshotRevision: latestSnapshot.snapshotRevision,
          triggerSource,
        },
        entityId: queueResult.run.id,
        entityType: 'operation_run',
        eventType: operationDescriptor.startedEventType,
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: queueResult.action === 'queued_follow_up'
          ? 'Latest save queued behind running artist reconciliation'
          : 'Artist reconciliation queued',
        userAgent: requestMetadata?.userAgent ?? null,
      });
    }

    return {
      accepted: true,
      coalesced: queueResult.action === 'replaced_pending' || queueResult.action === 'replaced_pending_follow_up',
      queuedBehindRun: Boolean(queueResult.runningRun),
      replacedPending: queueResult.action === 'replaced_pending' || queueResult.action === 'replaced_pending_follow_up',
      run: queueResult.run,
      runningRun: queueResult.runningRun ?? null,
    };
  }

  return {
    queueOperatorArtistReconciliation,
  };
}
