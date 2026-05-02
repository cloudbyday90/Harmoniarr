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

import { recordAuditEvent } from '../audit.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

export function createLibraryExternalIntakeService({
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRunByMediaRequestId = async () => null,
  getNow = () => new Date(),
  mediaRequestStore = null,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryExternalIntakePlanning;

  async function queueExternalMediaRequestPlanning({
    mediaRequestId,
    normalizedSource,
    requestMetadata = null,
    triggerSource = 'request_submit',
    triggeredByUserId = null,
  }) {
    const activeRun = await getActiveRunByMediaRequestId(mediaRequestId);
    if (activeRun) {
      return {
        accepted: true,
        reusedExistingRun: true,
        run: activeRun,
      };
    }

    const run = await createOperationRun({
      canonicalUrl: normalizedSource.canonicalUrl,
      mediaRequestId,
      resourceType: normalizedSource.resourceType,
      sourceIdentifier: normalizedSource.sourceIdentifier,
      sourceProvider: normalizedSource.provider,
      triggerSource,
      triggeredByUserId,
    });

    const queuedAt = getNow().toISOString();
    if (mediaRequestStore?.mergeMediaRequestEvidence) {
      await mediaRequestStore.mergeMediaRequestEvidence({
        evidencePatch: {
          providerAutomation: {
            canonicalUrl: normalizedSource.canonicalUrl,
            operationRunId: run.id,
            queuedAt,
            resourceType: normalizedSource.resourceType,
            sourceIdentifier: normalizedSource.sourceIdentifier,
            sourceProvider: normalizedSource.provider,
            status: 'queued',
            triggerSource,
          },
        },
        mediaRequestId,
      });
    }

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'app_user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        mediaRequestId,
        operationRunId: run.id,
        resourceType: normalizedSource.resourceType,
        sourceIdentifier: normalizedSource.sourceIdentifier,
        sourceProvider: normalizedSource.provider,
        triggerSource,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'External provider intake planning queued',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      reusedExistingRun: false,
      run,
    };
  }

  return {
    queueExternalMediaRequestPlanning,
  };
}