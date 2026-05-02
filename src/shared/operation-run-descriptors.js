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

export const operationRunRegistry = Object.freeze({
  artworkCleanup: Object.freeze({
    leaseJobType: 'artwork_cleanup',
    operationType: 'artwork_cleanup',
    startedEventType: 'artwork_cleanup_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Artwork cleanup',
  }),
  importCandidateApply: Object.freeze({
    leaseJobType: 'import_candidate_apply',
    operationType: 'import_candidate_apply',
    startedEventType: 'import_candidate_apply_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Import apply',
  }),
  importCandidateExecutionPlanning: Object.freeze({
    leaseJobType: 'import_candidate_execution_planning',
    operationType: 'import_candidate_execution_planning',
    startedEventType: 'import_candidate_execution_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Import execution',
  }),
  importCandidateMediaInspection: Object.freeze({
    leaseJobType: 'import_candidate_media_inspection',
    operationType: 'import_candidate_media_inspection',
    startedEventType: 'import_candidate_media_inspection_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Import media inspection',
  }),
  importCandidateTranscodeOrchestration: Object.freeze({
    leaseJobType: 'import_candidate_transcode_orchestration',
    operationType: 'import_candidate_transcode_orchestration',
    startedEventType: 'import_candidate_transcode_orchestration_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Import transcode orchestration',
  }),
  libraryExternalIntakePlanning: Object.freeze({
    leaseJobType: 'library_external_intake_planning',
    operationType: 'library_external_intake_planning',
    startedEventType: 'library_external_intake_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'External intake planning',
  }),
  libraryExternalIntakeExecution: Object.freeze({
    leaseJobType: 'library_external_intake_execution',
    operationType: 'library_external_intake_execution',
    startedEventType: 'library_external_intake_execution_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'External intake execution',
  }),
  libraryDiscoveryDispatch: Object.freeze({
    leaseJobType: 'library_discovery_dispatch',
    operationType: 'library_discovery_dispatch',
    startedEventType: 'library_discovery_dispatch_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Library discovery',
  }),
  libraryOrganizeApply: Object.freeze({
    leaseJobType: 'library_organize_apply',
    operationType: 'library_organize_apply',
    startedEventType: 'library_organize_apply_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Library organize apply',
  }),
  libraryScan: Object.freeze({
    leaseJobType: 'library_scan',
    operationType: 'library_scan',
    startedEventType: 'library_scan_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Library scan',
  }),
  metadataArtistRefresh: Object.freeze({
    leaseJobType: 'metadata_artist_refresh',
    operationType: 'metadata_artist_refresh',
    startedEventType: 'metadata_artist_refresh_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Metadata artist refresh',
  }),
  operatorNotificationFanout: Object.freeze({
    leaseJobType: 'operator_notification_fanout',
    operationType: 'operator_notification_fanout',
    startedEventType: 'operator_notification_fanout_started',
    supportsCancellation: true,
    supportsManualRetry: true,
    title: 'Operator notification fan-out',
  }),
  backupRestoreApply: Object.freeze({
    leaseJobType: 'backup_restore_apply',
    operationType: 'backup_restore_apply',
    startedEventType: 'backup_restore_started',
    supportsCancellation: false,
    supportsManualRetry: true,
    title: 'Backup restore apply',
  }),
});

export const operationRunDescriptors = Object.freeze(Object.values(operationRunRegistry));

const operationRunDescriptorsByType = new Map(
  operationRunDescriptors.map((descriptor) => [descriptor.operationType, descriptor]),
);
const operationRunDescriptorsByStartedEventType = new Map(
  operationRunDescriptors.map((descriptor) => [descriptor.startedEventType, descriptor]),
);

export function getOperationRunDescriptorDefinition(operationType) {
  return operationRunDescriptorsByType.get(operationType) ?? null;
}

export function getOperationRunDescriptorDefinitionForEventType(startedEventType) {
  return operationRunDescriptorsByStartedEventType.get(startedEventType) ?? null;
}

export function canRequestOperationRunCancellation(run) {
  const descriptor = getOperationRunDescriptorDefinition(run?.operationType);

  if (!descriptor?.supportsCancellation) {
    return false;
  }

  return (run?.status === 'pending' || run?.status === 'running')
    && !run?.cancelRequestedAt
    && !run?.cancelledAt;
}

export function canRequestOperationRunRetry(run) {
  const descriptor = getOperationRunDescriptorDefinition(run?.operationType);

  if (!descriptor?.supportsManualRetry) {
    return false;
  }

  return run?.status === 'failed' || run?.status === 'cancelled';
}