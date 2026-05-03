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

import {
  buildArtworkCleanupRunDashboardLocation,
  buildLibraryDiscoveryRunDashboardLocation,
  buildLibraryScanRunDashboardLocation,
} from './dashboard-route-state.js';
import {
  buildImportReviewApplyRunLocation,
  buildImportReviewExecutionRunLocation,
} from './import-review-route-state.js';
import {
  canRequestOperationRunCancellation,
  canRequestOperationRunRetry,
  getOperationRunDescriptorDefinition,
  getOperationRunDescriptorDefinitionForEventType,
  operationRunRegistry,
} from '../../shared/operation-run-descriptors.js';
import { buildOperationRunDetailLocation } from './operations-route-state.js';

const operationRunLinkDefinitionsByType = new Map([
  [operationRunRegistry.artworkCleanup.operationType, {
    buildLocation: buildArtworkCleanupRunDashboardLocation,
    openLabel: 'Open artwork cleanup run',
  }],
  [operationRunRegistry.importCandidateExecutionPlanning.operationType, {
    buildLocation: buildImportReviewExecutionRunLocation,
    openLabel: 'Open import execution run',
  }],
  [operationRunRegistry.importCandidateApply.operationType, {
    buildLocation: buildImportReviewApplyRunLocation,
    openLabel: 'Open import apply run',
  }],
  [operationRunRegistry.libraryScan.operationType, {
    buildLocation: buildLibraryScanRunDashboardLocation,
    openLabel: 'Open library scan run',
  }],
  [operationRunRegistry.libraryDiscoveryDispatch.operationType, {
    buildLocation: buildLibraryDiscoveryRunDashboardLocation,
    openLabel: 'Open library discovery run',
  }],
  [operationRunRegistry.backupRestoreApply.operationType, {
    buildLocation: buildOperationRunDetailLocation,
    openLabel: 'Open backup restore run',
  }],
]);

const operationEventAliasDefinitions = new Map([
  ['backup_restore_completed', operationRunRegistry.backupRestoreApply.operationType],
  ['backup_restore_failed', operationRunRegistry.backupRestoreApply.operationType],
]);

function formatOperationTypeFallback(operationType) {
  if (typeof operationType !== 'string' || operationType.trim().length === 0) {
    return 'Operation run';
  }

  return operationType
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function buildDefinitionLinkTarget(definition, runId) {
  if (!definition) {
    return null;
  }

  const routeDefinition = operationRunLinkDefinitionsByType.get(definition.operationType);
  const to = routeDefinition?.buildLocation?.(runId) ?? null;

  if (!to) {
    return null;
  }

  return {
    label: routeDefinition.openLabel,
    to,
  };
}

function getOperationRunDescriptorDefinitionForAnyEventType(eventType) {
  return getOperationRunDescriptorDefinitionForEventType(eventType)
    ?? getOperationRunDescriptorDefinition(operationEventAliasDefinitions.get(eventType));
}

export function buildOperationRunLinkTarget({ operationType, runId }) {
  return buildDefinitionLinkTarget(getOperationRunDescriptorDefinition(operationType), runId);
}

export function buildOperationRunLinkTargetFromEvent({ entityId, eventType }) {
  return buildDefinitionLinkTarget(getOperationRunDescriptorDefinitionForAnyEventType(eventType), entityId);
}

export function getOperationRunDescriptor(operationType) {
  const definition = getOperationRunDescriptorDefinition(operationType);
  const routeDefinition = definition
    ? operationRunLinkDefinitionsByType.get(definition.operationType)
    : null;

  return {
    operationType,
    openLabel: routeDefinition?.openLabel ?? 'Open operation run',
    title: definition?.title ?? formatOperationTypeFallback(operationType),
  };
}

export {
  canRequestOperationRunCancellation,
  canRequestOperationRunRetry,
};
