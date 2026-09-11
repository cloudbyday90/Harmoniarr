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

import { createOperationRunInterruptionGate } from '../operation-run-cancellation.js';
import { createLibraryExternalRequestDiscoveryRunStore } from './library-external-request-discovery-run-store.js';
import { createLibraryExternalRequestDiscoveryService } from './library-external-request-discovery-service.js';
import { createLibraryExternalRequestDiscoveryWorker } from './library-external-request-discovery-worker.js';

export function createLibraryExternalRequestDiscoveryModule({
  assertMaintenanceWriteAllowed,
  getAppUserById,
  getPoolFn,
  getReleaseTracklistExpectationsFn,
  importCandidateService,
  mediaRequestStore,
  operationPauseService = null,
  reviewStore,
  runStore = createLibraryExternalRequestDiscoveryRunStore({ getPoolFn }),
  slskdService,
} = {}) {
  const isCancellationRequested = createOperationRunInterruptionGate({
    isCancellationRequested: runStore.isCancellationRequested,
    operationLabel: 'External request discovery',
    operationPauseService,
  });
  const externalRequestDiscoveryService = createLibraryExternalRequestDiscoveryService({
    assertMaintenanceWriteAllowed,
    getAppUserById,
    getReleaseTracklistExpectationsFn,
    importCandidateService,
    isCancellationRequested,
    mediaRequestStore,
    reviewStore,
    slskdService,
  });
  const libraryExternalRequestDiscoveryWorker = createLibraryExternalRequestDiscoveryWorker({
    ...runStore,
    discoverExternalRequestRelease: externalRequestDiscoveryService.discoverExternalRequestRelease,
    isCancellationRequested,
  });
  return {
    externalRequestDiscoveryRunStore: runStore,
    externalRequestDiscoveryService,
    libraryExternalRequestDiscoveryWorker,
  };
}
