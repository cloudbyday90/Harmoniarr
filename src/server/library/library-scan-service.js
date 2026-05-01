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
import { createSettingsService } from '../settings-service.js';
import { buildLibraryScanContext } from './library-scan-readiness.js';

export function createLibraryScanService({
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  recordAuditEventFn = recordAuditEvent,
  settingsService = createSettingsService(),
  startWorkerRun = async () => {
    throw new Error('startWorkerRun dependency is required');
  },
} = {}) {
  async function startLibraryScan({ requestMetadata = null, triggeredByUserId = null } = {}) {
    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'library_scan_in_progress', 'A library scan is already running or queued');
    }

    const settingsPayload = await settingsService.buildSettingsPayload();
    const { libraryRoot, readiness } = buildLibraryScanContext(settingsPayload);

    if (readiness.status !== 'ready') {
      throw createApiError(409, 'library_scan_not_ready', readiness.message);
    }

    const run = await createOperationRun({
      libraryRoot,
      status: 'pending',
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        libraryRoot,
        runId: run.id,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: 'library_scan_started',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Library scan started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    await startWorkerRun({
      libraryRoot,
      runId: run.id,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startLibraryScan,
  };
}