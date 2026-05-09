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
import {
  createApiJsonBodyParser,
  createApiRequestContractMiddleware,
  createBrowserSecurityHeadersMiddleware,
  createHttpsEnforcementMiddleware,
  normalizeApiParsingError,
} from './http-hardening.js';
import { createImportCandidateModule } from './import-candidates/import-candidate-module.js';
import { createLibraryModule } from './library/library-module.js';
import { createPushModule } from './push/push-module.js';
import { createMediaCommandService } from './media/media-command-service.js';
import { createMediaInspectionService } from './media/media-inspection-service.js';
import { createMetadataModule } from './metadata/metadata-module.js';
import { createMediaToolingStatusService } from './media/media-tooling-status-service.js';
import { createMediaTranscodeExecutionService } from './media/media-transcode-execution-service.js';
import { createOperationsModule } from './operations-module.js';
import { createProviderModule } from './provider-module.js';
import { createPlexDirectoryImportService } from './integrations/plex/plex-directory-import-service.js';
import { createProviderClientResolverService } from './integrations/providers/provider-client-resolver-service.js';
import { createRequestRateLimiterService } from './request-rate-limiter.js';
import { createControlPlaneRedactionService } from './control-plane-redaction-service.js';
import { createMaintenanceLockOperationPauseService } from './recovery/maintenance-lock-operation-pause-service.js';
import { createMaintenanceLockService } from './recovery/maintenance-lock-service.js';
import { registerArtworkRoutes } from './routes/artwork-routes.js';
import { registerActivityRoutes } from './routes/activity-routes.js';
import { registerAppUserRoutes } from './routes/app-user-routes.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerAdminRecoveryRoutes } from './routes/admin-recovery-routes.js';
import { registerImportCandidateRoutes } from './routes/import-candidate-routes.js';
import { registerLibraryRoutes } from './routes/library-routes.js';
import { registerMetadataRoutes } from './routes/metadata-routes.js';
import { registerOperationsRoutes } from './routes/operations-routes.js';
import { registerProviderRoutes } from './routes/provider-routes.js';
import { registerPushRoutes } from './routes/push-routes.js';
import { registerSlskdRoutes } from './routes/slskd-routes.js';
import { registerSystemRoutes } from './routes/system-routes.js';
import { createRuntimeResourceService } from './runtime-resource-service.js';
import { loadSettings } from './settings.js';
import { createSettingsService } from './settings-service.js';
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
  createImportCandidateModule: buildImportCandidateModule = createImportCandidateModule,
  createLibraryModule: buildLibraryModule = createLibraryModule,
  createPushModule: buildPushModule = createPushModule,
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
  registerImportCandidateRoutes: mountImportCandidateRoutes = registerImportCandidateRoutes,
  registerLibraryRoutes: mountLibraryRoutes = registerLibraryRoutes,
  registerMetadataRoutes: mountMetadataRoutes = registerMetadataRoutes,
  registerOperationsRoutes: mountOperationsRoutes = registerOperationsRoutes,
  registerProviderRoutes: mountProviderRoutes = registerProviderRoutes,
  registerPushRoutes: mountPushRoutes = registerPushRoutes,
  registerSlskdRoutes: mountSlskdRoutes = registerSlskdRoutes,
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
  const appUserModule = buildAppUserModule({
    accountClaimService: baseAppUserModule.accountClaimService,
    appUserProvisioningService: baseAppUserModule.appUserProvisioningService,
    appUserService: baseAppUserModule.appUserService,
    permissionService: baseAppUserModule.permissionService,
    plexDirectoryImportService,
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
  const activityModule = buildActivityModule();
  const pushModule = buildPushModule();
  const importCandidateModule = buildImportCandidateModule({
    getAppUserById: appUserModule.appUserService.getAppUserById,
    getMediaToolingStatus: mediaToolingStatusService.getStatus,
    sendFulfillmentNotificationFn: ({ userId }) => pushModule.pushNotificationService.sendNotificationToUser({
      payload: {
        body: 'Your requested music has been added to your library.',
        title: 'Music request ready',
        url: '/app/my-requests',
      },
      userId,
    }),
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
    slskdTransferSnapshotService: slskdModule.slskdTransferSnapshotService,
    slskdService: slskdModule.slskdService,
  });
  const libraryModule = buildLibraryModule({
    artworkAssignmentService: artworkModule.artworkAssignmentService,
    artworkIngestionService: artworkModule.artworkIngestionService,
    getAppUserById: appUserModule.appUserService.getAppUserById,
    getUserPreferencesFn: appUserModule.appUserService.getUserPreferences,
    importCandidateService: importCandidateModule.importCandidateService,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    providerClientResolverService: createProviderClientResolverService({
      spotifyOAuthService: providerModule.spotifyOAuthService,
      youtubeOAuthService: providerModule.youtubeOAuthService,
    }),
    recordActivityEventFn: activityModule.activityEventService.recordActivityEvent,
    settingsService,
    slskdService: slskdModule.slskdService,
  });
  const metadataModule = buildMetadataModule({
    maintenanceLockOperationPauseService,
    providerHealthRecorder,
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
        provider: 'slskd',
        check: slskdModule.slskdService.getConnectionStatus,
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
    metadataMonitoringStore: metadataModule.metadataMonitoringStore,
    musicBrainzSearchService: metadataModule.musicBrainzSearchService,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    operationHistoryService: operationsModule.operationHistoryService,
    packageJsonPath: resolvedPackageJsonPath,
    plexOwnerLinkService: providerModule.plexOwnerLinkService,
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
    limitBootstrapAdmin: requestRateLimiterService.createMiddleware({
      bucketName: 'bootstrap-admin',
      limit: 5,
      windowMs: 10 * 60 * 1000,
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
    limitRefresh: requestRateLimiterService.createMiddleware({
      bucketName: 'auth-refresh',
      limit: 30,
      windowMs: 5 * 60 * 1000,
    }),
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
  });
  mountActivityRoutes(app, {
    ...activityModule.routeDependencies,
  });
  mountPushRoutes(app, {
    ...pushModule.routeDependencies,
  });
  mountArtworkRoutes(app, {
    ...artworkModule.routeDependencies,
    limitArtworkCleanupRun: requestRateLimiterService.createMiddleware({
      bucketName: 'artwork-cleanup-run',
      limit: 10,
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
  });
  mountOperationsRoutes(app, operationsModule.routeDependencies);
  mountProviderRoutes(app, providerModule.routeDependencies);
  mountSlskdRoutes(app, slskdModule.routeDependencies);
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
  });
  mountSystemRoutes(app, {
    ...systemModule.routeDependencies,
    limitBackupExport: requestRateLimiterService.createMiddleware({
      bucketName: 'backup-export',
      limit: 10,
      windowMs: 60 * 1000,
    }),
    limitDiagnosticsExport: requestRateLimiterService.createMiddleware({
      bucketName: 'system-diagnostics-export',
      limit: 20,
      windowMs: 5 * 60 * 1000,
    }),
    limitOperatorNotificationFanoutRun: requestRateLimiterService.createMiddleware({
      bucketName: 'operator-notification-fanout-run',
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
    const normalizedError = normalizeApiParsingError(error);
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
    artworkModule,
    importCandidateModule,
    libraryModule,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    metadataModule,
    operationsModule,
    providerModule,
    runtimeResourceService,
    systemModule,
  };
}
