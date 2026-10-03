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
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { lockLibraryDiscoveryRunCreation } from './library-discovery-run-lock-store.js';

export function createLibraryDiscoveryRunService({
  assertMaintenanceWriteAllowed = async () => {},
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  recordAuditEventFn = recordAuditEvent,
  withTransaction = createDatabaseTransactionRunner(),
  lockRunCreation = lockLibraryDiscoveryRunCreation,
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryDiscoveryDispatch;

  async function startLibraryDiscoveryRun({
    requestMetadata = null,
    triggerSource = 'manual',
    triggeredByUserId = null,
  } = {}) {
    return withTransaction(async (queryable) => {
      await assertMaintenanceWriteAllowed({ queryable });
      await lockRunCreation({ queryable });

      const activeRun = await getActiveRun({ queryable });
      if (activeRun) {
        throw createApiError(409, 'library_discovery_in_progress', 'A library discovery dispatch is already running or queued');
      }

      const run = await createOperationRun({
        queryable,
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
        eventType: operationDescriptor.startedEventType,
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'Library discovery dispatch started',
        userAgent: requestMetadata?.userAgent ?? null,
      }, queryable);

      return {
        accepted: true,
        run,
      };
    });
  }

  return {
    startLibraryDiscoveryRun,
  };
}
