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

import express from 'express';
import { resolve } from 'node:path';
import { createAppUserModule } from './app-user-module.js';
import { createActivityModule } from './activity/activity-module.js';
import { createArtworkModule } from './artwork/artwork-module.js';
import { createAuthModule } from './auth-module.js';
import { createDeploymentSecurityService } from './deployment-security-service.js';
import { createDependencyHealthService, createProviderHealthRecorder } from './dependency-health-service.js';
import { createDownloaderModule } from './downloader/downloader-module.js';
import {
  createApiJsonBodyParser,
  createApiRequestContractMiddleware,
  createBrowserSecurityHeadersMiddleware,
  createHttpsEnforcementMiddleware,
  normalizeApiParsingError,
} from './http-hardening.js';
import { normalizeDatabaseConnectionError } from './database-error-mapper.js';
import { createImportCandidateModule } from './import-candidates/import-candidate-module.js';
import { createLibraryModule } from './library/library-module.js';
import { createPushModule } from './push/push-module.js';
import { createFulfillmentModule } from './fulfillment/fulfillment-module.js';
import { createPlexWebhookIngestionService } from './integrations/plex/plex-webhook-ingestion-service.js';
import { createSlskdWebhookIngestionService } from './integrations/slskd/slskd-webhook-ingestion-service.js';
import { createMediaCommandService } from './media/media-command-service.js';
import { createFfmpegSpectralAnalyzer } from './media/ffmpeg-spectral-analyzer.js';
import { createMediaInspectionService } from './media/media-inspection-service.js';
import { createMetadataModule } from './metadata/metadata-module.js';
import { createMediaToolingStatusService } from './media/media-tooling-status-service.js';
import { createMediaTranscodeExecutionService } from './media/media-transcode-execution-service.js';
import { createOperationsModule } from './operations-module.js';
import { createProviderModule } from './provider-module.js';
import { createPlexDirectSignInService } from './integrations/plex/plex-direct-sign-in-service.js';
import { createPlexDirectoryImportService } from './integrations/plex/plex-directory-import-service.js';
import { createPlexLinkedAccountManagementService } from './integrations/plex/plex-linked-account-management-service.js';
import { createPlexLinkedAccountReconciliationService } from './integrations/plex/plex-linked-account-reconciliation-service.js';
import { createProviderClientResolverService } from './integrations/providers/provider-client-resolver-service.js';
import { createRequestRateLimiterService } from './request-rate-limiter.js';
import { createControlPlaneRedactionService } from './control-plane-redaction-service.js';
import { createRestoreScopeRuntimeSnapshotStore } from './recovery/restore-scope-runtime-snapshot-store.js';
import { createMaintenanceLockOperationPauseService } from './recovery/maintenance-lock-operation-pause-service.js';
import { createMaintenanceLockService } from './recovery/maintenance-lock-service.js';
import { createControlPlaneIdempotencyService } from './recovery/control-plane-idempotency-service.js';
import { registerArtworkRoutes } from './routes/artwork-routes.js';
import { registerActivityRoutes } from './routes/activity-routes.js';
import { registerAppUserRoutes } from './routes/app-user-routes.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerAdminRecoveryRoutes } from './routes/admin-recovery-routes.js';
import { registerDownloaderRoutes } from './routes/downloader-routes.js';
import { registerImportCandidateRoutes } from './routes/import-candidate-routes.js';
import { registerLibraryRoutes } from './routes/library-routes.js';
import { registerMetadataRoutes } from './routes/metadata-routes.js';
import { registerOperationsRoutes } from './routes/operations-routes.js';
import { registerProviderRoutes } from './routes/provider-routes.js';
import { registerPushRoutes } from './routes/push-routes.js';
import { registerPlexWebhookRoutes } from './routes/plex-webhook-routes.js';
import { registerSlskdRoutes } from './routes/slskd-routes.js';
import { registerSlskdWebhookRoutes } from './routes/slskd-webhook-routes.js';
import { registerSystemRoutes } from './routes/system-routes.js';
import { createRuntimeResourceService } from './runtime-resource-service.js';
import { loadSettings } from './settings.js';
import { createFidelityThresholdLoaders } from './fidelity-threshold-settings.js';
import { createSettingsService } from './settings-service.js';
import { shouldSendNotification } from './notification/notification-preference-service.js';
import { broadcastAdminNotification } from './notification/notification-admin-dispatch-service.js';
import { createNotificationDispatchCooldownService } from './notification/notification-dispatch-cooldown-service.js';
import { createNotificationDispatchHistoryService } from './notification/notification-dispatch-history-service.js';
import { buildReleaseAddedCooldownKey } from './notification/release-added-identity.js';
import { broadcastHouseholdNotification } from './notification/notification-household-dispatch-service.js';
import { createSlskdConfigService } from './slskd/slskd-config-service.js';
import { createSlskdModule } from './slskd/slskd-module.js';
import { createSystemModule } from './system-module.js';

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid APP_PORT value: ${value}`);
  }

  return parsed;
}

export function createSecurityEventLogger({
  controlPlaneRedactionService = createControlPlaneRedactionService(),
  stderr = process.stderr,
} = {}) {
  return function logSecurityEvent({ bucketName, request, retryAfterSeconds }) {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : request.socket?.remoteAddress ?? 'unknown';
    const requestPath = controlPlaneRedactionService.redactLogMessage(request.originalUrl ?? request.url);
    const safeIpAddress = controlPlaneRedactionService.redactLogMessage(ipAddress);
    stderr.write(
      `[harmoniarr-security] rate_limited bucket=${bucketName} method=${request.method} path=${requestPath} ip=${safeIpAddress} retry_after_s=${retryAfterSeconds}\n`,
    );
  };
}

function buildLoginRateLimitKey(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const ipAddress = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : request.socket?.remoteAddress ?? 'unknown';
  const username = typeof request.body?.username === 'string'
    ? request.body.username.trim().toLowerCase()
    : '';

  return username ? `${ipAddress}:${username}` : ipAddress;
}

function resolveBinaryName(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

async function getSlskdDependencyStatus({ slskdConfigService, slskdService }) {
  const providerStatus = await slskdConfigService.buildSecretStatus();
  if (providerStatus.apiKeyConfigured !== true) {
    return {
      provider: 'slskd',
      status: 'disabled',
      code: 'slskd_not_configured',
      message: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
    };
  }

  return slskdService.getConnectionStatus();
}

export function createApp({
  appPort = parsePort(process.env.APP_PORT, 3000),
  clientDistDir,
  packageJsonPath,
  startedAt = new Date(),
  createArtworkModule: buildArtworkModule = createArtworkModule,
  createActivityModule: buildActivityModule = createActivityModule,
  createAppUserModule: buildAppUserModule = createAppUserModule,
  createAuthModule: buildAuthModule = createAuthModule,
  createDeploymentSecurityService: buildDeploymentSecurityService = createDeploymentSecurityService,
  createDownloaderModule: buildDownloaderModule = createDownloaderModule,
  createImportCandidateModule: buildImportCandidateModule = createImportCandidateModule,
  createLibraryModule: buildLibraryModule = createLibraryModule,
  createPushModule: buildPushModule = createPushModule,
  createFulfillmentModule: buildFulfillmentModule = createFulfillmentModule,
  createMediaToolingStatusService: buildMediaToolingStatusService = createMediaToolingStatusService,
  createMetadataModule: buildMetadataModule = createMetadataModule,
  createOperationsModule: buildOperationsModule = createOperationsModule,
  createProviderModule: buildProviderModule = createProviderModule,
  createSettingsService: buildSettingsService = createSettingsService,
  createSlskdConfigService: buildSlskdConfigService = createSlskdConfigService,
  createSlskdModule: buildSlskdModule = createSlskdModule,
  createSystemModule: buildSystemModule = createSystemModule,
  registerArtworkRoutes: mountArtworkRoutes = registerArtworkRoutes,
  registerActivityRoutes: mountActivityRoutes = registerActivityRoutes,
  registerAppUserRoutes: mountAppUserRoutes = registerAppUserRoutes,
  registerAuthRoutes: mountAuthRoutes = registerAuthRoutes,
  registerAdminRecoveryRoutes: mountAdminRecoveryRoutes = registerAdminRecoveryRoutes,
  registerDownloaderRoutes: mountDownloaderRoutes = registerDownloaderRoutes,
  registerImportCandidateRoutes: mountImportCandidateRoutes = registerImportCandidateRoutes,
  registerLibraryRoutes: mountLibraryRoutes = registerLibraryRoutes,
  registerMetadataRoutes: mountMetadataRoutes = registerMetadataRoutes,
  registerOperationsRoutes: mountOperationsRoutes = registerOperationsRoutes,
  registerProviderRoutes: mountProviderRoutes = registerProviderRoutes,
  registerPushRoutes: mountPushRoutes = registerPushRoutes,
  registerPlexWebhookRoutes: mountPlexWebhookRoutes = registerPlexWebhookRoutes,
  registerSlskdRoutes: mountSlskdRoutes = registerSlskdRoutes,
  registerSlskdWebhookRoutes: mountSlskdWebhookRoutes = registerSlskdWebhookRoutes,
  registerSystemRoutes: mountSystemRoutes = registerSystemRoutes,
} = {}) {
  const app = express();
  const serverDir = import.meta.dirname;
  const resolvedClientDistDir = clientDistDir ?? process.env.HARMONIARR_CLIENT_DIST ?? resolve(serverDir, '../client');
  const resolvedPackageJsonPath = packageJsonPath ?? process.env.HARMONIARR_PACKAGE_JSON ?? resolve(serverDir, '../package.json');
  const providerHealthRecorder = createProviderHealthRecorder();
  const runtimeResourceService = createRuntimeResourceService();
  const ffmpegBinary = resolveBinaryName(process.env.HARMONIARR_FFMPEG_BIN, 'ffmpeg');
  const ffprobeBinary = resolveBinaryName(process.env.HARMONIARR_FFPROBE_BIN, 'ffprobe');
  const mediaCommandService = createMediaCommandService({
    allowedBinaries: [ffmpegBinary, ffprobeBinary],
    ...runtimeResourceService.getMediaCommandDefaults(),
  });
  const mediaToolingStatusService = buildMediaToolingStatusService({
    ffmpegBinary,
    ffprobeBinary,
    mediaCommandService,
  });
  const spectralAnalyzer = createFfmpegSpectralAnalyzer({
    ffmpegBin: ffmpegBinary,
    mediaCommandService,
  });
  const requestRateLimiterService = createRequestRateLimiterService({
    onLimit: createSecurityEventLogger(),
  });
  const deploymentSecurityService = buildDeploymentSecurityService({ loadSettingsFn: loadSettings });
  const slskdConfigService = buildSlskdConfigService();
  const providerModule = buildProviderModule();
  const settingsService = buildSettingsService({
    deploymentSecurityService,
    plexOwnerLinkService: providerModule.plexOwnerLinkService,
    slskdConfigService,
    spotifyOAuthService: providerModule.spotifyOAuthService,
    youtubeOAuthService: providerModule.youtubeOAuthService,
  });
  const maintenanceLockService = createMaintenanceLockService();
  const maintenanceLockOperationPauseService = createMaintenanceLockOperationPauseService({
    listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
  });
  const baseAppUserModule = buildAppUserModule();
  const plexDirectoryImportService = createPlexDirectoryImportService({
    listAppUsers: baseAppUserModule.appUserService.listAppUsers,
    plexOwnerLinkService: providerModule.plexOwnerLinkService,
  });
  const plexLinkedAccountReconciliationService = createPlexLinkedAccountReconciliationService({
    buildPlexDirectoryImportPreview: plexDirectoryImportService.buildPreview,
    getAppUserById: baseAppUserModule.appUserService.getAppUserById,
  });
  const plexLinkedAccountManagementService = createPlexLinkedAccountManagementService({
    buildPlexDirectoryImportPreview: plexDirectoryImportService.buildPreview,
    buildPlexLinkStatus: providerModule.plexOwnerLinkService.buildStatus,
    listLatestStaleAcknowledgements: plexLinkedAccountReconciliationService.listLatestStaleAcknowledgements,
    listAppUsers: baseAppUserModule.appUserService.listAppUsers,
  });
  const appUserModule = buildAppUserModule({
    accountClaimService: baseAppUserModule.accountClaimService,
    appUserProvisioningService: baseAppUserModule.appUserProvisioningService,
    appUserService: baseAppUserModule.appUserService,
    permissionService: baseAppUserModule.permissionService,
    plexDirectoryImportService,
    plexLinkedAccountManagementService,
    plexLinkedAccountReconciliationService,
  });
  const artworkModule = buildArtworkModule({
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    settingsService,
  });
  const authModule = buildAuthModule({
    accountClaimService: appUserModule.accountClaimService,
    settingsService,
  });
  const operationsModule = buildOperationsModule();
  const slskdModule = buildSlskdModule({ providerHealthRecorder, slskdConfigService });
  const downloaderModule = buildDownloaderModule({
    slskdConfigService,
    slskdService: slskdModule.slskdService,
  });
  const restoreScopeRuntimeSnapshotStore = createRestoreScopeRuntimeSnapshotStore();
  const pushModule = buildPushModule();
  const fulfillmentModule = buildFulfillmentModule();
  const plexWebhookIngestionService = createPlexWebhookIngestionService({
    fulfillmentEvidenceService: fulfillmentModule.fulfillmentEvidenceService,
    plexOwnerLinkService: providerModule.plexOwnerLinkService,
  });
  const householdNotificationDispatchHistoryService = createNotificationDispatchHistoryService({
    pushNotificationQueueStore: pushModule.pushNotificationQueueStore,
  });
  const householdNotificationCooldownService = createNotificationDispatchCooldownService({
    dispatchHistoryService: householdNotificationDispatchHistoryService,
  });
  const notificationDispatchDeps = {
    dispatchCooldownService: householdNotificationCooldownService,
    getUserPreferences: appUserModule.appUserService.getUserPreferences,
    listAppUsers: appUserModule.appUserService.listAppUsers,
    sendNotificationToUser: pushModule.pushNotificationDispatchService.sendNotificationToUser,
  };
  const householdNotificationCooldowns = Object.freeze({
    artistMonitoredMs: 30 * 60 * 1000,
    downloadCompletedMs: 10 * 60 * 1000,
    releaseAddedMs: 10 * 60 * 1000,
    requestCreatedMs: 5 * 60 * 1000,
  });
  const activityModule = buildActivityModule({
    listTrustSnapshot: restoreScopeRuntimeSnapshotStore.listTrustSnapshot,
    replaceTrustSnapshot: restoreScopeRuntimeSnapshotStore.replaceTrustSnapshot,
    analyzeSpectralCutoffFn: spectralAnalyzer.analyzeSpectralCutoff,
    ...createFidelityThresholdLoaders({ loadSettingsFn: loadSettings }),
    onTrustOverrideFn: ({ _actorUserId, _reason, trustState, username }) => broadcastAdminNotification({
      category: 'trustOverride',
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: `Source user "${username}" trust level changed to ${trustState}`,
        title: 'Trust override',
        url: '/app/activity/source-users',
      },
    }),
    onBlockEventFn: ({ eventType, _reason, username }) => broadcastAdminNotification({
      category: 'blocklistEvent',
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: eventType === 'blocked'
          ? `Source user "${username}" has been blocked`
          : `Source user "${username}" has been unblocked`,
        title: eventType === 'blocked' ? 'Source user blocked' : 'Source user unblocked',
        url: '/app/activity/source-users',
      },
    }),
    onTrustThresholdCrossedFn: ({ failureCount, reason, reviewState, successCount, successRatePercent, username }) => broadcastAdminNotification({
      category: 'trustThresholdCrossed',
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: `Source user "${username}" moved to ${reviewState} (${successCount} success, ${failureCount} failure, ${successRatePercent ?? 0}% success). ${reason}`,
        title: 'Trust threshold crossed',
        url: '/app/activity/source-users',
      },
    }),
  });
  const plexDirectSignInService = createPlexDirectSignInService();
  let libraryModule = null;
  const importCandidateModule = buildImportCandidateModule({
    getAppUserById: appUserModule.appUserService.getAppUserById,
    getMediaToolingStatus: mediaToolingStatusService.getStatus,
    listIgnoredUsernamesFn: activityModule.sourceUserIgnoreService.listIgnoredUsernamesForFilter,
    listSourceUserReputationIndexFn: activityModule.sourceUserTrustEvidenceService.listSourceUserReputationIndex,
    onDownloadCompletedFn: ({ folderPath, username }) => broadcastHouseholdNotification({
      category: 'downloadCompleted',
      cooldownKey: `downloadCompleted:${username ?? ''}:${folderPath ?? ''}`,
      cooldownMs: householdNotificationCooldowns.downloadCompletedMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: `Download from "${username}" completed: ${folderPath}`,
        title: 'Download completed',
        url: '/app/activity/imports',
      },
    }),
    onReleaseAddedFn: ({ artistName, folderPath, releaseTitle, username }) => broadcastHouseholdNotification({
      category: 'releaseAdded',
      cooldownKey: buildReleaseAddedCooldownKey({
        artistName,
        fallbackKey: `${username ?? ''}:${folderPath ?? ''}`,
        releaseTitle,
      }),
      cooldownMs: householdNotificationCooldowns.releaseAddedMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: releaseTitle
          ? artistName
            ? `${releaseTitle} by ${artistName} was added to the library`
            : `${releaseTitle} was added to the library`
          : `Release from "${username}" added to library: ${folderPath}`,
        title: 'Release added',
        url: '/app/activity/imports',
      },
    }),
    sendFulfillmentNotificationFn: async ({ userId }) => {
      const allowed = await shouldSendNotification({
        category: 'requestFulfilled',
        getUserPreferences: appUserModule.appUserService.getUserPreferences,
        userId,
      });
      if (!allowed) return { sent: 0, failed: 0, removed: 0 };

      return pushModule.pushNotificationDispatchService.sendNotificationToUser({
        eventType: 'requestFulfilled',
        payload: {
          body: 'Your requested music has been added to your library.',
          title: 'Music request ready',
          url: '/app/my-requests',
        },
        userId,
      });
    },
    mediaInspectionService: createMediaInspectionService({
      ffprobeBin: ffprobeBinary,
      getMediaToolingStatus: mediaToolingStatusService.getStatus,
      mediaCommandService,
    }),
    mediaTranscodeExecutionService: createMediaTranscodeExecutionService({
      ffmpegBin: ffmpegBinary,
      ffmpegThreads: runtimeResourceService.getRuntimeConfiguration().mediaCommands.ffmpegThreads,
      getMediaToolingStatus: mediaToolingStatusService.getStatus,
      mediaCommandService,
    }),
    maintenanceLockService,
    maintenanceLockOperationPauseService,
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    recordSourceUserOutcomeEvidenceFn: activityModule.sourceUserTrustEvidenceService.recordSourceUserOutcomeEvidence,
    sourceUserSpectralSidecarService: activityModule.sourceUserSpectralSidecarService,
    scheduleLibraryScan: async ({
      releaseHints = [],
      triggeredByRunId = null,
      triggeredByUserId = null,
      triggerReason = null,
    } = {}) => {
      if (!libraryModule?.libraryScanService?.startLibraryScan) {
        throw new Error('Library scan service is not initialized');
      }

      return libraryModule.libraryScanService.startLibraryScan({
        releaseHints,
        triggeredByRunId,
        triggeredByUserId,
        triggerReason,
      });
    },
    queueDeferredLibraryScan: async ({
      deferredReason = null,
      releaseHints = [],
      triggeredByRunId = null,
      triggeredByUserId = null,
      triggerReason = null,
    } = {}) => {
      if (!libraryModule?.libraryScanService?.queueDeferredLibraryScan) {
        throw new Error('Library scan service is not initialized');
      }

      return libraryModule.libraryScanService.queueDeferredLibraryScan({
        deferredReason,
        releaseHints,
        triggeredByRunId,
        triggeredByUserId,
        triggerReason,
      });
    },
    scheduleDownloadRecoveryRediscovery: async (payload) => {
      if (!libraryModule?.libraryDiscoveryRediscoveryService?.scheduleDownloadRecoveryRediscovery) {
        throw new Error('Library discovery rediscovery service is not initialized');
      }

      return libraryModule.libraryDiscoveryRediscoveryService.scheduleDownloadRecoveryRediscovery(payload);
    },
    slskdTransferSnapshotService: slskdModule.slskdTransferSnapshotService,
    slskdService: slskdModule.slskdService,
  });
  libraryModule = buildLibraryModule({
    artworkAssignmentService: artworkModule.artworkAssignmentService,
    artworkIngestionService: artworkModule.artworkIngestionService,
    getAppUserById: appUserModule.appUserService.getAppUserById,
    getUserPreferencesFn: appUserModule.appUserService.getUserPreferences,
    importCandidateAutoSelectionService: importCandidateModule.importCandidateAutoSelectionService,
    importCandidateService: importCandidateModule.importCandidateService,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    onDiscoveryRequestExhaustedFn: ({ artistName, releaseTitle }) => broadcastAdminNotification({
      category: 'discoveryRequestExhausted',
      cooldownKey: `discoveryRequestExhausted:${artistName ?? ''}:${releaseTitle ?? ''}`,
      cooldownMs: householdNotificationCooldowns.requestCreatedMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: releaseTitle
          ? `${artistName ? `${artistName} - ` : ''}${releaseTitle} did not return usable Soulseek results after fallback searches`
          : 'A discovery request did not return usable Soulseek results after fallback searches',
        title: 'Discovery search exhausted',
        url: '/app/activity/wanted',
      },
    }),
    onDownloadRecoveryExhaustedFn: ({ artistName, maxResearchAttemptCount, releaseTitle, researchAttemptCount }) => broadcastAdminNotification({
      category: 'downloadRecoveryExhausted',
      cooldownKey: `downloadRecoveryExhausted:${artistName ?? ''}:${releaseTitle ?? ''}`,
      cooldownMs: householdNotificationCooldowns.requestCreatedMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: releaseTitle
          ? `${artistName ? `${artistName} - ` : ''}${releaseTitle} exhausted download recovery after ${researchAttemptCount ?? maxResearchAttemptCount ?? 0} rediscovery attempt${(researchAttemptCount ?? maxResearchAttemptCount) === 1 ? '' : 's'}`
          : 'A release exhausted download recovery and needs operator review',
        title: 'Download recovery exhausted',
        url: '/app/activity/wanted',
      },
    }),
    onOrganizeReleaseAddedFn: ({ artistName, movedCount, releaseCount, releaseTitle }) => broadcastHouseholdNotification({
      category: 'releaseAdded',
      cooldownKey: buildReleaseAddedCooldownKey({
        artistName,
        fallbackKey: `${releaseCount ?? 0}:${movedCount ?? 0}`,
        releaseTitle,
      }),
      cooldownMs: householdNotificationCooldowns.releaseAddedMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: releaseCount > 1
          ? `${releaseCount} releases were organized into the library (${movedCount} files moved)`
          : releaseTitle
            ? artistName
              ? `${releaseTitle} by ${artistName} was organized into the library`
              : `${releaseTitle} was organized into the library`
            : `${movedCount} library files were organized into the canonical layout`,
        title: 'Release added',
        url: '/app/library',
      },
    }),
    onRequestCreatedFn: ({ _actorUserId, artistName, releaseTitle }) => broadcastHouseholdNotification({
      category: 'requestCreated',
      cooldownKey: `requestCreated:${artistName ?? ''}:${releaseTitle ?? ''}`,
      cooldownMs: householdNotificationCooldowns.requestCreatedMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: releaseTitle
          ? `New request: ${artistName} - ${releaseTitle}`
          : artistName
            ? `New request: ${artistName}`
            : 'New music request submitted',
        title: 'Music request created',
        url: '/app/activity/wanted',
      },
      suppressUserIds: typeof _actorUserId === 'string' && _actorUserId.length > 0 ? [_actorUserId] : [],
    }),
    prefetchMonitoredArtistArtwork: artworkModule.artworkMonitoredArtistPrefetchService?.prefetchMonitoredArtistArtwork,
    providerClientResolverService: createProviderClientResolverService({
      spotifyOAuthService: providerModule.spotifyOAuthService,
      youtubeOAuthService: providerModule.youtubeOAuthService,
    }),
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    settingsService,
    slskdService: slskdModule.slskdService,
  });
  const metadataModule = buildMetadataModule({
    libraryMediaRequestStore: libraryModule.libraryMediaRequestStore,
    maintenanceLockOperationPauseService,
    onArtistMonitoredFn: ({ actorUserId, artistName }) => broadcastHouseholdNotification({
      category: 'artistMonitored',
      cooldownKey: `artistMonitored:${artistName ?? ''}`,
      cooldownMs: householdNotificationCooldowns.artistMonitoredMs,
      dispatchCooldownService: notificationDispatchDeps.dispatchCooldownService,
      listAppUsers: notificationDispatchDeps.listAppUsers,
      getUserPreferences: notificationDispatchDeps.getUserPreferences,
      sendNotificationToUser: notificationDispatchDeps.sendNotificationToUser,
      payload: {
        body: `"${artistName}" is now being monitored for new releases`,
        title: 'Artist monitored',
        url: '/app/activity/releases',
      },
      suppressUserIds: typeof actorUserId === 'string' && actorUserId.length > 0 ? [actorUserId] : [],
    }),
    providerHealthRecorder,
    reconcileDiscoveryRequests: libraryModule.libraryDiscoveryRequestService.reconcileDiscoveryRequests,
    reconcileWantedReleases: libraryModule.libraryWantedReleaseService.reconcileWantedReleases,
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
  });
  const dependencyHealthService = createDependencyHealthService({
    recorder: providerHealthRecorder,
    checks: [
      {
        provider: 'media_tooling',
        check: mediaToolingStatusService.getStatus,
      },
      {
        provider: 'musicbrainz',
        check: metadataModule.musicBrainzSearchService.checkProviderHealth,
      },
      {
        provider: 'slskd',
        check: () => getSlskdDependencyStatus({
          slskdConfigService,
          slskdService: slskdModule.slskdService,
        }),
      },
    ],
  });

  const systemModule = buildSystemModule({
    appleMusicStatusService: providerModule.appleMusicStatusService,
    appPort,
    artworkPolicyService: artworkModule.artworkPolicyService,
    artworkSummaryService: artworkModule.artworkSummaryService,
    dependencyHealthService,
    importCandidateExecutionHeartbeatConfig: importCandidateModule.importCandidateExecutionHeartbeatConfig,
    importCandidateExecutionHeartbeatState: importCandidateModule.importCandidateExecutionHeartbeatState,
    libraryDiscoveryHeartbeatState: libraryModule.libraryDiscoveryHeartbeatState,
    libraryWantedReleaseStore: libraryModule.libraryWantedReleaseStore,
    libraryScanSummaryService: libraryModule.libraryScanSummaryService,
    metadataRefreshHeartbeatConfig: metadataModule.metadataRefreshHeartbeatConfig,
    metadataRefreshHeartbeatState: metadataModule.metadataRefreshHeartbeatState,
    operatorArtistMonitoringStore: metadataModule.operatorArtistMonitoringStore,
    operatorReleaseGroupSelectionStore: metadataModule.operatorReleaseGroupSelectionStore,
    operatorTrackOverrideStore: metadataModule.operatorTrackOverrideStore,
    musicBrainzSearchService: metadataModule.musicBrainzSearchService,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    operationHistoryService: operationsModule.operationHistoryService,
    packageJsonPath: resolvedPackageJsonPath,
    plexOwnerLinkService: providerModule.plexOwnerLinkService,
    restoreScopeRuntimeSnapshotStore,
    runtimeResourceService,
    settingsService,
    slskdService: slskdModule.slskdService,
    spotifyOAuthService: providerModule.spotifyOAuthService,
    startedAt,
    youtubeOAuthService: providerModule.youtubeOAuthService,
  });

  app.disable('x-powered-by');
  app.use(async (request, response, next) => {
    const deploymentSecurityPolicy = await deploymentSecurityService.getPolicy();
    request.deploymentSecurityPolicy = deploymentSecurityPolicy;
    response.locals.deploymentSecurityPolicy = deploymentSecurityPolicy;
    next();
  });
  app.use(createHttpsEnforcementMiddleware({
    policyResolver(request) {
      return request.deploymentSecurityPolicy;
    },
  }));
  app.use(createBrowserSecurityHeadersMiddleware({
    policyResolver(request) {
      return request.deploymentSecurityPolicy;
    },
  }));
  app.use('/api', createApiJsonBodyParser());
  app.use('/api', createApiRequestContractMiddleware());
  app.use(express.static(resolvedClientDistDir, { index: false }));

  mountAuthRoutes(app, {
    ...authModule.routeDependencies,
    completePlexSignIn: plexDirectSignInService.completeSignIn,
    limitBootstrapAdmin: requestRateLimiterService.createMiddleware({
      bucketName: 'bootstrap-admin',
      limit: 5,
      windowMs: 10 * 60 * 1000,
    }),
    limitChangePassword: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-change-password',
      limit: 10,
      windowMs: 15 * 60 * 1000,
    }),
    limitClaimComplete: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-claim-complete',
      keyFn: buildLoginRateLimitKey,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    }),
    limitLogin: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-login',
      keyFn: buildLoginRateLimitKey,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    }),
    limitPlexSignInCallback: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-plex-callback',
      limit: 30,
      windowMs: 5 * 60 * 1000,
    }),
    limitPlexSignInStart: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-plex-start',
      limit: 15,
      windowMs: 10 * 60 * 1000,
    }),
    limitRefresh: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-refresh',
      limit: 30,
      windowMs: 5 * 60 * 1000,
    }),
    limitSessionRevoke: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-session-revoke',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    startPlexSignIn: plexDirectSignInService.startSignIn,
  });
  mountAdminRecoveryRoutes(app, {
    getBootstrapAdminRecoveryStatus: systemModule.adminRecoveryService.getBootstrapAdminRecoveryStatus,
    completeBootstrapAdminRecovery: systemModule.adminRecoveryService.completeBootstrapAdminRecovery,
    limitRecoveryStatus: requestRateLimiterService.createMiddleware({
      bucketName: 'recovery-status',
      limit: 30,
      windowMs: 5 * 60 * 1000,
    }),
    limitRecoveryComplete: requestRateLimiterService.createMiddleware({
      bucketName: 'recovery-complete',
      limit: 5,
      windowMs: 15 * 60 * 1000,
    }),
  });
  mountAppUserRoutes(app, {
    ...appUserModule.routeDependencies,
    limitAppUserAdminMutations: requestRateLimiterService.createMiddleware({
      bucketName: 'app-user-admin-mutations',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitAppUserPreferencesMutations: requestRateLimiterService.createMiddleware({
      bucketName: 'app-user-preferences-mutations',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitAppUserResetPassword: requestRateLimiterService.createMiddleware({
      bucketName: 'app-user-reset-password',
      limit: 5,
      windowMs: 15 * 60 * 1000,
    }),
  });
  mountActivityRoutes(app, {
    ...activityModule.routeDependencies,
    limitActivitySourceUserMutations: requestRateLimiterService.createMiddleware({
      bucketName: 'activity-source-user-mutations',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitActivityBlocklistMutations: requestRateLimiterService.createMiddleware({
      bucketName: 'activity-blocklist-mutations',
      limit: 30,
      windowMs: 60 * 1000,
    }),
  });
  mountPushRoutes(app, {
    ...pushModule.routeDependencies,
    limitPushSubscriptionMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'push-subscription-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
  });
  mountArtworkRoutes(app, {
    ...artworkModule.routeDependencies,
    limitArtworkCleanupRun: requestRateLimiterService.createMiddleware({
      bucketName: 'artwork-cleanup-run',
      limit: 10,
      windowMs: 60 * 1000,
    }),
    limitArtworkResolveBatch: requestRateLimiterService.createMiddleware({
      bucketName: 'artwork-resolve-batch',
      limit: 30,
      windowMs: 60 * 1000,
    }),
  });
  mountMetadataRoutes(app, {
    ...metadataModule.routeDependencies,
    limitMetadataArtistRefreshRun: requestRateLimiterService.createMiddleware({
      bucketName: 'metadata-artist-refresh-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitMetadataImport: requestRateLimiterService.createMiddleware({
      bucketName: 'metadata-import',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitMetadataMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'metadata-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
  });
  mountOperationsRoutes(app, {
    ...operationsModule.routeDependencies,
    limitOperationRunMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'operation-run-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
  });
  mountProviderRoutes(app, {
    ...providerModule.routeDependencies,
    limitProviderOAuthStart: requestRateLimiterService.createMiddleware({
      bucketName: 'provider-oauth-start',
      limit: 10,
      windowMs: 60 * 1000,
    }),
    limitProviderOAuthClear: requestRateLimiterService.createMiddleware({
      bucketName: 'provider-oauth-clear',
      limit: 10,
      windowMs: 60 * 1000,
    }),
  });
  mountPlexWebhookRoutes(app, {
    getWebhookStatus: plexWebhookIngestionService.getWebhookStatus,
    ingestWebhook: plexWebhookIngestionService.ingestWebhook,
    limitWebhook: requestRateLimiterService.createMiddleware({
      bucketName: 'plex-webhook',
      limit: 60,
      windowMs: 60 * 1000,
    }),
  });
  const slskdWebhookIdempotencyService = createControlPlaneIdempotencyService();
  const slskdWebhookIngestionService = createSlskdWebhookIngestionService({
    executeIdempotentMutation: slskdWebhookIdempotencyService.executeIdempotentMutation,
    getWebhookSecret: () => process.env.HARMONIARR_SLSKD_WEBHOOK_SECRET ?? null,
    nudgeReconciliationFn: async () => {
      const executionSummary = await importCandidateModule
        .importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary();
      await importCandidateModule
        .importCandidateExecutionReconciliationService
        .reconcileImportCandidateExecutionState({ executionSummary });
    },
  });
  mountSlskdWebhookRoutes(app, {
    ingestWebhookEvent: slskdWebhookIngestionService.ingestWebhookEvent,
    limitSlskdWebhook: requestRateLimiterService.createMiddleware({
      bucketName: 'slskd-webhook',
      limit: 120,
      windowMs: 60 * 1000,
    }),
  });
  mountSlskdRoutes(app, {
    ...slskdModule.routeDependencies,
    limitSlskdSearch: requestRateLimiterService.createMiddleware({
      bucketName: 'slskd-search',
      limit: 20,
      windowMs: 60 * 1000,
    }),
  });
  mountDownloaderRoutes(app, {
    ...downloaderModule.routeDependencies,
    limitDownloaderMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'downloader-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitDownloaderQueueRead: requestRateLimiterService.createMiddleware({
      bucketName: 'downloader-queue-read',
      limit: 120,
      windowMs: 60 * 1000,
    }),
  });
  mountImportCandidateRoutes(app, {
    ...importCandidateModule.routeDependencies,
    limitImportCandidateApplyRun: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-apply-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitImportCandidateMediaInspectionRun: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-media-inspection-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitImportCandidateTranscodeRun: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-transcode-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitImportCandidateExecutionReconcile: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-execution-reconcile',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitImportCandidateExecutionRun: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-execution-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitImportCandidateSlskdIngest: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-slskd-ingest',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitImportCandidateDecision: requestRateLimiterService.createMiddleware({
      bucketName: 'import-candidate-decision',
      limit: 60,
      windowMs: 60 * 1000,
    }),
  });
  mountLibraryRoutes(app, {
    ...libraryModule.routeDependencies,
    limitLibraryDiscoveryRun: requestRateLimiterService.createMiddleware({
      bucketName: 'library-discovery-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitLibraryOrganizeApplyRun: requestRateLimiterService.createMiddleware({
      bucketName: 'library-organize-apply-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitLibraryScanRun: requestRateLimiterService.createMiddleware({
      bucketName: 'library-scan-run',
      limit: 10,
      windowMs: 60 * 1000,
    }),
    limitMediaRequestMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'media-request-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitMediaRequestAdminMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'media-request-admin-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitMediaRequestBulkCancel: requestRateLimiterService.createMiddleware({
      bucketName: 'media-request-bulk-cancel',
      limit: 20,
      windowMs: 60 * 1000,
    }),
  });
  mountSystemRoutes(app, {
    ...systemModule.routeDependencies,
    limitBackupExport: requestRateLimiterService.createMiddleware({
      bucketName: 'backup-export',
      limit: 10,
      windowMs: 60 * 1000,
    }),
    limitBackupMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'backup-mutation',
      limit: 10,
      windowMs: 60 * 1000,
    }),
    limitDiagnosticsExport: requestRateLimiterService.createMiddleware({
      bucketName: 'system-diagnostics-export',
      limit: 20,
      windowMs: 5 * 60 * 1000,
    }),
    limitMaintenanceLockMutation: requestRateLimiterService.createMiddleware({
      bucketName: 'maintenance-lock-mutation',
      limit: 30,
      windowMs: 60 * 1000,
    }),
    limitOperatorNotificationFanoutRun: requestRateLimiterService.createMiddleware({
      bucketName: 'operator-notification-fanout-run',
      limit: 20,
      windowMs: 60 * 1000,
    }),
    limitSettingsUpdate: requestRateLimiterService.createMiddleware({
      bucketName: 'settings-update',
      limit: 20,
      windowMs: 60 * 1000,
    }),
  });


  app.use('/api', (_request, response) => {
    response.status(404).json({ ok: false, error: 'not_found' });
  });

  app.get(/.*/, async (_request, response) => {
    response.sendFile(resolve(resolvedClientDistDir, 'index.html'));
  });

  app.use((error, _request, response, _next) => {
    const normalizedError = normalizeDatabaseConnectionError(normalizeApiParsingError(error));
    const status = Number.isInteger(normalizedError?.status) ? normalizedError.status : 500;
    response.status(status).json({
      ok: false,
      error: {
        code: normalizedError?.code ?? 'internal_error',
        message: normalizedError?.message ?? 'Unexpected server error',
      },
    });
  });

  return {
    app,
    appPort,
    activityModule,
    artworkModule,
    downloaderModule,
    fulfillmentModule,
    importCandidateModule,
    libraryModule,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    metadataModule,
    operationsModule,
    providerModule,
    pushModule,
    runtimeResourceService,
    systemModule,
  };
}
