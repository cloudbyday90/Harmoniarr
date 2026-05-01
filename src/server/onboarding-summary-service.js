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

import { getMigrationStatus } from './migrations.js';
import {
  classifyMusicBrainzDependencyError,
  classifySlskdDependencyError,
} from './dependency-health-service.js';
import { createPathValidationSummary } from './paths/path-validation-summary.js';
import { createLibraryScanSummaryService } from './library-scan-summary-service.js';
import { createSettingsService } from './settings-service.js';
import { createSlskdService } from './slskd/slskd-service.js';
import { createMusicBrainzSearchService } from './metadata/musicbrainz-search-service.js';
import { createBackgroundJobHealthService } from './background-job-health-service.js';

function createStep({
  id,
  title,
  status,
  message,
  action = null,
  meta = null,
}) {
  return {
    id,
    title,
    status,
    message,
    ...(action ? { action } : {}),
    ...(meta ? { meta } : {}),
  };
}

function toChecklistStatus(status) {
  return status === 'healthy'
    ? 'complete'
    : 'attention';
}

function createPathValidationStep(pathValidationSummary) {
  return createStep({
    id: 'paths',
    title: 'Validate library and download paths',
    status: toChecklistStatus(pathValidationSummary.summary.status),
    message: pathValidationSummary.summary.message,
    action: {
      label: 'Open Settings',
      to: '/app/settings',
    },
    meta: {
      checkedAt: pathValidationSummary.checkedAt,
      configuredDownloadMappings: pathValidationSummary.configuredDownloadMappings,
    },
  });
}

function createSlskdConnectionStep(connectionStatus) {
  return createStep({
    id: 'slskd-connection',
    title: 'Connect to slskd',
    status: toChecklistStatus(connectionStatus.status),
    message: connectionStatus.message ?? 'slskd connection is ready.',
    action: {
      label: 'Configure slskd',
      to: '/app/settings',
    },
    meta: {
      isConnected: connectionStatus.details?.isConnected ?? false,
      isLoggedIn: connectionStatus.details?.isLoggedIn ?? false,
      isTransitioning: connectionStatus.details?.isTransitioning ?? false,
    },
  });
}

function createSlskdAuthenticationStep(authenticationStatus) {
  return createStep({
    id: 'slskd-authentication',
    title: 'Verify slskd authentication',
    status: authenticationStatus.status,
    message: authenticationStatus.message,
    action: {
      label: 'Review slskd credentials',
      to: '/app/settings',
    },
  });
}

function createMetadataProviderStep(metadataStatus) {
  return createStep({
    id: 'metadata-provider',
    title: 'Reach MusicBrainz metadata',
    status: toChecklistStatus(metadataStatus.status),
    message: metadataStatus.message ?? 'MusicBrainz lookups are reachable.',
    action: {
      label: 'Open Metadata Workspace',
      to: '/app/metadata',
    },
  });
}

function createDatabaseStep(migrationStatus) {
  return createStep({
    id: 'database',
    title: 'Apply database migrations',
    status: migrationStatus.pending.length === 0 ? 'complete' : 'attention',
    message: migrationStatus.pending.length === 0
      ? 'Database migrations are current.'
      : `${migrationStatus.pending.length} migration${migrationStatus.pending.length === 1 ? '' : 's'} still need attention.`,
  });
}

function createWorkerStep(workerHealth) {
  return createStep({
    id: 'background-workers',
    title: 'Observe background workers',
    status: workerHealth.status === 'healthy' ? 'complete' : 'info',
    message: workerHealth.message,
    meta: {
      activeLeaseCount: workerHealth.activeLeaseCount,
      runningOperationCount: workerHealth.runningOperationCount,
    },
  });
}

function createLibraryScanStep(scanSummary) {
  if (scanSummary.readiness.status === 'blocked') {
    return createStep({
      id: 'library-scan',
      title: 'Prepare the first library scan',
      status: 'attention',
      message: scanSummary.summary.message,
      action: scanSummary.nextAction,
      meta: {
        libraryRoot: scanSummary.libraryRoot,
      },
    });
  }

  if (scanSummary.latestRun?.status === 'completed') {
    return createStep({
      id: 'library-scan',
      title: 'Review library scan status',
      status: 'complete',
      message: scanSummary.summary.message,
      meta: {
        libraryRoot: scanSummary.libraryRoot,
        finishedAt: scanSummary.latestRun.finishedAt,
        filesSeen: scanSummary.latestRun.filesSeen,
      },
    });
  }

  if (scanSummary.latestRun?.status === 'failed' || scanSummary.latestRun?.status === 'cancelled') {
    return createStep({
      id: 'library-scan',
      title: 'Review library scan status',
      status: 'attention',
      message: scanSummary.summary.message,
      meta: {
        libraryRoot: scanSummary.libraryRoot,
        lastStatus: scanSummary.latestRun.status,
        startedAt: scanSummary.latestRun.startedAt,
      },
    });
  }

  return createStep({
    id: 'library-scan',
    title: 'Review library scan status',
    status: 'info',
    message: scanSummary.summary.message,
    meta: {
      libraryRoot: scanSummary.libraryRoot,
      lastStatus: scanSummary.latestRun?.status ?? 'not_started',
      startedAt: scanSummary.latestRun?.startedAt ?? null,
    },
  });
}

function buildSummary(steps) {
  const checklistSteps = steps.filter((step) => step.status !== 'info');
  const issueSteps = checklistSteps.filter((step) => step.status === 'attention');
  const completeStepCount = checklistSteps.filter((step) => step.status === 'complete').length;

  return {
    status: issueSteps.length > 0 ? 'attention' : 'complete',
    completeStepCount,
    totalStepCount: checklistSteps.length,
    issueCount: issueSteps.length,
    message: issueSteps.length > 0
      ? `${issueSteps.length} setup item${issueSteps.length === 1 ? '' : 's'} need attention before scans or imports.`
      : 'Core onboarding checks are ready for library scan and import work.',
  };
}

function buildNextAction(steps) {
  const actionableStep = steps.find((step) => step.status === 'attention' && step.action);
  return actionableStep?.action ?? null;
}

function createFallbackMetadataStatus(error) {
  const status = classifyMusicBrainzDependencyError(error);
  return {
    ...status,
    message: status.message ?? 'MusicBrainz reachability could not be verified.',
  };
}

function createFallbackSlskdStatus(error) {
  const status = classifySlskdDependencyError(error);
  return {
    ...status,
    message: status.message ?? 'slskd reachability could not be verified.',
  };
}

export function createOnboardingSummaryService({
  backgroundJobHealthService = createBackgroundJobHealthService(),
  getMigrationStatusFn = getMigrationStatus,
  libraryScanSummaryService = createLibraryScanSummaryService(),
  musicBrainzSearchService = createMusicBrainzSearchService(),
  settingsService = createSettingsService(),
  slskdService = createSlskdService(),
} = {}) {
  async function buildOnboardingSummary() {
    const checkedAt = new Date().toISOString();
    const settingsPayload = await settingsService.buildSettingsPayload();
    const pathValidationSummary = createPathValidationSummary(settingsPayload);

    const [connectionResult, metadataResult, migrationResult, scanResult, workerResult] = await Promise.allSettled([
      slskdService.getConnectionStatus(),
      musicBrainzSearchService.checkProviderHealth(),
      getMigrationStatusFn(),
      libraryScanSummaryService.buildLibraryScanSummary(),
      backgroundJobHealthService.getWorkerHealth(),
    ]);

    const connectionStatus = connectionResult.status === 'fulfilled'
      ? connectionResult.value
      : createFallbackSlskdStatus(connectionResult.reason);

    let authenticationStatus;
    if (connectionStatus.details?.isConnected) {
      try {
        const authResult = await slskdService.validateAuthentication();
        authenticationStatus = {
          status: authResult.isValid ? 'complete' : 'attention',
          message: authResult.isValid
            ? 'slskd authentication is valid.'
            : 'slskd authentication could not be verified.',
        };
      } catch (error) {
        const authError = createFallbackSlskdStatus(error);
        authenticationStatus = {
          status: 'attention',
          message: authError.message,
        };
      }
    } else {
      authenticationStatus = {
        status: 'attention',
        message: 'slskd must connect before authentication can be verified.',
      };
    }

    const metadataStatus = metadataResult.status === 'fulfilled'
      ? metadataResult.value
      : createFallbackMetadataStatus(metadataResult.reason);
    const migrationStatus = migrationResult.status === 'fulfilled'
      ? migrationResult.value
      : { applied: 0, pending: ['migration_status_unavailable'] };
    const libraryScanSummary = scanResult.status === 'fulfilled'
      ? scanResult.value
      : {
          checkedAt,
          libraryRoot: settingsPayload.settings?.paths?.music ?? null,
          readiness: {
            status: 'blocked',
            message: 'Library scan status is unavailable until shared settings can be read.',
          },
          summary: {
            status: 'blocked',
            message: 'Library scan status is unavailable until shared settings can be read.',
          },
          latestRun: null,
          nextAction: {
            label: 'Open Settings',
            to: '/app/settings',
          },
        };
    const workerHealth = workerResult.status === 'fulfilled'
      ? workerResult.value
      : {
          activeLeaseCount: 0,
          runningOperationCount: 0,
          status: 'informational',
          message: 'Background worker health is unavailable in this slice.',
        };

    const steps = [
      createPathValidationStep(pathValidationSummary),
      createSlskdConnectionStep(connectionStatus),
      createSlskdAuthenticationStep(authenticationStatus),
      createMetadataProviderStep(metadataStatus),
      createDatabaseStep(migrationStatus),
      createLibraryScanStep(libraryScanSummary),
      createWorkerStep(workerHealth),
    ];

    return {
      checkedAt,
      summary: buildSummary(steps),
      nextAction: buildNextAction(steps),
      steps,
    };
  }

  return {
    buildOnboardingSummary,
  };
}