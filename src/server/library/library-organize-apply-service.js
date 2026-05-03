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

export function createLibraryOrganizeApplyService({
  assertMaintenanceWriteAllowed = async () => {},
  buildLibraryOrganizePreview = async () => ({ counts: { renameRequiredCount: 0 } }),
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.libraryOrganizeApply;

  async function startLibraryOrganizeApplyRun({ requestMetadata = null, triggeredByUserId = null } = {}) {
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'library_organize_apply_in_progress', 'A library organize apply run is already running or queued');
    }

    const organizePreview = await buildLibraryOrganizePreview();
    const plannedRenameCount = organizePreview.counts?.renameRequiredCount ?? 0;

    if (plannedRenameCount < 1) {
      throw createApiError(409, 'library_organize_apply_not_ready', 'No library files currently require organize apply changes');
    }

    const run = await createOperationRun({
      plannedRenameCount,
      status: 'pending',
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        plannedRenameCount,
        runId: run.id,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Library organize apply started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startLibraryOrganizeApplyRun,
  };
}
