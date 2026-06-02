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
import { createSettingsService } from '../settings-service.js';
import { buildLibraryScanContext } from './library-scan-readiness.js';
import { countLibraryScanReleaseHints } from './library-scan-release-hints.js';

export function createLibraryScanService({
  assertMaintenanceWriteAllowed = async () => {},
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  recordAuditEventFn = recordAuditEvent,
  settingsService = createSettingsService(),
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryScan;

  async function buildReadyLibraryScanRoot() {
    const settingsPayload = await settingsService.buildSettingsPayload();
    const { libraryRoot, readiness } = buildLibraryScanContext(settingsPayload);

    if (readiness.status !== 'ready') {
      throw createApiError(409, 'library_scan_not_ready', readiness.message);
    }

    return libraryRoot;
  }

  async function writeLibraryScanAuditEvent({
    libraryRoot,
    releaseHints,
    requestMetadata = null,
    run,
    summary = 'Library scan started',
    triggeredByRunId = null,
    triggeredByUserId = null,
    triggerReason = null,
  }) {
    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        libraryRoot,
        releaseHintCount: countLibraryScanReleaseHints(releaseHints),
        runId: run.id,
        triggeredByRunId,
        triggerReason,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary,
      userAgent: requestMetadata?.userAgent ?? null,
    });
  }

  async function startLibraryScan({
    requestMetadata = null,
    releaseHints = [],
    triggeredByRunId = null,
    triggeredByUserId = null,
    triggerReason = null,
  } = {}) {
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'library_scan_in_progress', 'A library scan is already running or queued');
    }

    const libraryRoot = await buildReadyLibraryScanRoot();

    const run = await createOperationRun({
      libraryRoot,
      releaseHints,
      status: 'pending',
      triggeredByRunId,
      triggeredByUserId,
      triggerReason,
    });

    await writeLibraryScanAuditEvent({
      libraryRoot,
      releaseHints,
      requestMetadata,
      run,
      triggeredByRunId,
      triggeredByUserId,
      triggerReason,
    });

    return {
      accepted: true,
      run,
    };
  }

  async function queueDeferredLibraryScan({
    deferredReason = null,
    requestMetadata = null,
    releaseHints = [],
    triggeredByRunId = null,
    triggeredByUserId = null,
    triggerReason = null,
  } = {}) {
    await assertMaintenanceWriteAllowed();
    const libraryRoot = await buildReadyLibraryScanRoot();

    const run = await createOperationRun({
      deferredReason,
      libraryRoot,
      releaseHints,
      status: 'pending',
      triggeredByRunId,
      triggeredByUserId,
      triggerReason,
    });

    await writeLibraryScanAuditEvent({
      libraryRoot,
      releaseHints,
      requestMetadata,
      run,
      summary: 'Library scan queued',
      triggeredByRunId,
      triggeredByUserId,
      triggerReason,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    queueDeferredLibraryScan,
    startLibraryScan,
  };
}
