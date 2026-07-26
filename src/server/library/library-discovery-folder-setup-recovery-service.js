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

import { DEFAULT_DISCOVERY_SETTINGS, resolveDiscoverySettings } from './library-discovery-dispatch-service.js';

const discoveryInProgressCode = 'library_discovery_in_progress';

function buildDeferredRecovery({ releasedCount, reason }) {
  return {
    dispatchAlreadyActive: reason === discoveryInProgressCode,
    dispatchDeferred: true,
    releasedCount,
    runStarted: false,
  };
}

function resolveRecoveryBatchSize(settings) {
  const batchSize = resolveDiscoverySettings(settings).dispatchBatchSize;
  return Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 50
    ? batchSize
    : DEFAULT_DISCOVERY_SETTINGS.dispatchBatchSize;
}

/**
 * Releases a small, explicit subset of Music Queue requests after Settings
 * validates the folders that previously stopped only automatic handoff.
 */
export function createLibraryDiscoveryFolderSetupRecoveryService({
  getNow = () => new Date(),
  libraryDiscoveryRequestStore,
  startLibraryDiscoveryRun = async () => {
    throw new Error('startLibraryDiscoveryRun dependency is required');
  },
} = {}) {
  if (!libraryDiscoveryRequestStore?.releaseFolderSetupBlockedAutomaticDiscoveryRequests) {
    throw new Error('libraryDiscoveryRequestStore.releaseFolderSetupBlockedAutomaticDiscoveryRequests dependency is required');
  }

  async function recoverAfterValidatedFolderSetup({
    actorUserId = null,
    requestMetadata = null,
    settings = null,
  } = {}) {
    const limit = resolveRecoveryBatchSize(settings);
    const releasedAt = getNow().toISOString();
    const releasedCount = await libraryDiscoveryRequestStore.releaseFolderSetupBlockedAutomaticDiscoveryRequests({
      limit,
      releasedAt,
    });

    if (releasedCount < 1) {
      return {
        dispatchAlreadyActive: false,
        dispatchDeferred: false,
        releasedCount: 0,
        runStarted: false,
      };
    }

    try {
      const result = await startLibraryDiscoveryRun({
        requestMetadata,
        triggerSource: 'folder_setup_recovery',
        triggeredByUserId: actorUserId,
      });

      return {
        dispatchAlreadyActive: false,
        dispatchDeferred: false,
        releasedCount,
        runStarted: Boolean(result?.run),
      };
    } catch (error) {
      return buildDeferredRecovery({
        releasedCount,
        reason: error?.code ?? null,
      });
    }
  }

  return {
    recoverAfterValidatedFolderSetup,
  };
}
