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

export function createLibraryDiscoveryRunService({
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  recordAuditEventFn = recordAuditEvent,
  startWorkerRun = async () => {
    throw new Error('startWorkerRun dependency is required');
  },
} = {}) {
  async function startLibraryDiscoveryRun({
    requestMetadata = null,
    triggerSource = 'manual',
    triggeredByUserId = null,
  } = {}) {
    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'library_discovery_in_progress', 'A library discovery dispatch is already running or queued');
    }

    const run = await createOperationRun({
      status: 'pending',
      triggerSource,
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        runId: run.id,
        triggerSource,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: 'library_discovery_dispatch_started',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Library discovery dispatch started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    await startWorkerRun({
      requestMetadata,
      runId: run.id,
      triggerSource,
      triggeredByUserId,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startLibraryDiscoveryRun,
  };
}