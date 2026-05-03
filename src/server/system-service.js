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

import { readFile } from 'node:fs/promises';
import { buildHeartbeatOverviewList, resolveHeartbeatOverviewState } from './heartbeat/heartbeat-overview.js';
import { getPool } from './database.js';
import { createDependencyHealthService } from './dependency-health-service.js';
import { getMigrationStatus } from './migrations.js';
import { createPathValidationSummary } from './paths/path-validation-summary.js';
import { createSettingsService } from './settings-service.js';
import { resolveLibraryDiscoveryHeartbeatConfig } from './library/library-discovery-heartbeat-config.js';

function buildArtworkMaintenanceOverview(summary) {
  if (!summary) {
    return null;
  }

  return {
    checkedAt: summary.checkedAt ?? null,
    eligibleAssetCount: summary.inventory?.eligibleAssetCount ?? 0,
    latestRunId: summary.latestRun?.id ?? null,
    latestRunStatus: summary.latestRun?.status ?? null,
    message: summary.summary?.message ?? 'Artwork maintenance status is unavailable.',
    status: summary.summary?.status ?? 'unknown',
    unassignedAssetCount: summary.inventory?.unassignedAssetCount ?? 0,
  };
}

function buildRawHeartbeatOverview(config, heartbeatState) {
  const state = resolveHeartbeatOverviewState(heartbeatState);
  if (!config && !state) {
    return null;
  }

  return {
    intervalLabel: config?.intervalLabel ?? null,
    intervalMs: config?.intervalMs ?? null,
    mode: config?.mode ?? null,
    source: config?.source ?? null,
    state,
  };
}

function buildRuntimeOverview({
  runtimeResourceMonitor = null,
  runtimeResourceService = null,
} = {}) {
  if (!runtimeResourceMonitor && !runtimeResourceService) {
    return null;
  }

  const runtimeState = runtimeResourceMonitor?.getRuntimeState
    ? runtimeResourceMonitor.getRuntimeState()
    : null;

  return {
    configuration: runtimeResourceService?.getRuntimeConfiguration
      ? runtimeResourceService.getRuntimeConfiguration()
      : null,
    latestSample: runtimeState?.latestSample ?? null,
    message: runtimeState?.message ?? 'Runtime monitoring is unavailable.',
    status: runtimeState?.status ?? 'unknown',
    warnings: runtimeState?.warnings ?? [],
  };
}

export function createSystemService({
  activityFeedService = null,
  appleMusicStatusService = null,
  artworkPolicyService = null,
  artworkSummaryService = null,
  libraryDiscoveryHeartbeatConfig = resolveLibraryDiscoveryHeartbeatConfig(),
  libraryDiscoveryHeartbeatState = null,
  importCandidateExecutionHeartbeatConfig = null,
  importCandidateExecutionHeartbeatState = null,
  metadataRefreshHeartbeatConfig = null,
  metadataRefreshHeartbeatState = null,
  operatorNotificationService = null,
  operationHistoryService = null,
  spotifyOAuthService = null,
  startedAt,
  packageJsonPath,
  runtimeResourceMonitor = null,
  runtimeResourceService = null,
  youtubeOAuthService = null,
  dependencyHealthService = createDependencyHealthService(),
  getMigrationStatusFn = getMigrationStatus,
  getPoolFn = getPool,
  readPackageMetadataFn = async (path) => JSON.parse(await readFile(path, 'utf8')),
  settingsService = createSettingsService(),
}) {
  let packageMetadata;

  async function getPackageMetadata() {
    if (!packageMetadata) {
      packageMetadata = await readPackageMetadataFn(packageJsonPath);
    }

    return packageMetadata;
  }

  function buildSystemHeartbeats() {
    return buildHeartbeatOverviewList([
      {
        config: libraryDiscoveryHeartbeatConfig,
        heartbeatState: libraryDiscoveryHeartbeatState,
        key: 'libraryDiscovery',
        label: 'Discovery dispatch',
        messages: {
          inProgress: 'Discovery dispatch is already evaluating wanted releases.',
          notDue: 'No discovery requests are currently due for automatic dispatch.',
          started: 'Discovery dispatch most recently queued a library discovery run.',
          waiting: 'Discovery dispatch has not recorded a heartbeat outcome yet.',
        },
      },
      {
        config: importCandidateExecutionHeartbeatConfig,
        heartbeatState: importCandidateExecutionHeartbeatState,
        key: 'importExecution',
        label: 'Import reconciliation',
        messages: {
          inProgress: 'Import reconciliation is already processing transfer state.',
          notDue: 'No import transfer reconciliation changes were needed on the latest tick.',
          started: 'Import reconciliation most recently persisted import transfer state.',
          waiting: 'Import reconciliation has not recorded a heartbeat outcome yet.',
        },
      },
      {
        config: metadataRefreshHeartbeatConfig,
        heartbeatState: metadataRefreshHeartbeatState,
        key: 'metadataRefresh',
        label: 'Metadata refresh',
        messages: {
          inProgress: 'Metadata refresh work is already queued or the previous heartbeat tick is still running.',
          notDue: 'No monitored artists are currently due for refresh.',
          paused: 'Metadata refresh dispatch is paused.',
          started: 'Metadata refresh most recently queued a monitored artist refresh.',
          waiting: 'Metadata refresh scheduling has not recorded a heartbeat outcome yet.',
        },
      },
    ]);
  }

  async function getActivityFeed({ before = null, limit = 10 } = {}) {
    const heartbeats = buildSystemHeartbeats();

    return activityFeedService?.buildRecentActivityFeed
      ? activityFeedService.buildRecentActivityFeed({ before, heartbeats, limit })
      : {
        checkedAt: new Date().toISOString(),
        entries: [],
        pageInfo: {
          hasMore: false,
          nextCursor: null,
        },
      };
  }

  async function getOperatorNotifications({ limit = 20 } = {}) {
    const heartbeats = buildSystemHeartbeats();
    const operationRuns = operationHistoryService?.listRecentOperationRuns
      ? await operationHistoryService.listRecentOperationRuns({ limit: Number(limit) * 2 })
      : [];

    if (!operatorNotificationService?.buildOperatorNotifications) {
      return {
        checkedAt: new Date().toISOString(),
        counts: {
          actionable: 0,
          byCategory: {
            failure: 0,
            manual_intervention: 0,
            queued_work: 0,
            recovery: 0,
          },
          total: 0,
        },
        notifications: [],
      };
    }

    return operatorNotificationService.buildOperatorNotifications({
      heartbeats,
      limit,
      operationRuns,
    });
  }

  async function getOverview(options = {}) {
    const includeDependencies = options.includeDependencies ?? true;
    const includeArtworkMaintenance = options.includeArtworkMaintenance ?? includeDependencies;
    const packageJson = await getPackageMetadata();
    const settingsPayload = await settingsService.buildSettingsPayload();
    const configuredPaths = settingsPayload.settings?.paths ?? {};
    const pool = getPoolFn();
    const migrationStatus = await getMigrationStatusFn();
    const dbCheck = await pool.query('SELECT current_database() AS name');
    const dependencies = includeDependencies
      ? await dependencyHealthService.getDependencyHealth()
      : [];
    const heartbeats = buildSystemHeartbeats();

    const [spotifyStatus, youtubeStatus, appleMusicStatus] = includeDependencies
      ? await Promise.all([
          spotifyOAuthService?.buildStatus(pool) ?? null,
          youtubeOAuthService?.buildStatus(pool) ?? null,
          appleMusicStatusService?.buildStatus(pool) ?? null,
        ])
      : [null, null, null];

    return {
      artwork: artworkPolicyService?.buildArtworkOverviewFromSettingsPayload
        ? artworkPolicyService.buildArtworkOverviewFromSettingsPayload(settingsPayload)
        : null,
      artworkMaintenance: includeArtworkMaintenance && artworkSummaryService?.buildArtworkSummary
        ? buildArtworkMaintenanceOverview(await artworkSummaryService.buildArtworkSummary())
        : null,
      service: {
        name: 'harmoniarr',
        version: packageJson.version,
        startedAt: startedAt.toISOString(),
      },
      discoveryHeartbeat: libraryDiscoveryHeartbeatConfig,
      importExecutionHeartbeat: buildRawHeartbeatOverview(
        importCandidateExecutionHeartbeatConfig,
        importCandidateExecutionHeartbeatState,
      ),
      metadataRefreshHeartbeat: buildRawHeartbeatOverview(
        metadataRefreshHeartbeatConfig,
        metadataRefreshHeartbeatState,
      ),
      heartbeats,
      activityFeed: await getActivityFeed({ limit: options.activityFeedLimit }),
      database: {
        name: dbCheck.rows[0]?.name ?? process.env.PGDATABASE ?? 'harmoniarr',
        appliedMigrations: migrationStatus.applied,
        pendingMigrations: migrationStatus.pending.length,
        pendingMigrationNames: migrationStatus.pending,
      },
      dependencies,
      pathValidation: createPathValidationSummary(settingsPayload),
      providers: {
        appleMusic: appleMusicStatus,
        spotify: spotifyStatus,
        youtube: youtubeStatus,
      },
      runtime: buildRuntimeOverview({
        runtimeResourceMonitor,
        runtimeResourceService,
      }),
      paths: [
        {
          label: 'App data',
          value: process.env.HARMONIARR_APPDATA ?? '/app/data',
          description: 'Persistent state, generated runtime files, and embedded PostgreSQL.',
        },
        {
          label: 'Downloads',
          value: configuredPaths.downloads ?? process.env.HARMONIARR_DOWNLOADS ?? '/data/downloads',
          description: 'Shared slskd download tree used as the import source.',
        },
        {
          label: 'Music library',
          value: configuredPaths.music ?? process.env.HARMONIARR_MUSIC ?? '/data/music',
          description: 'Final managed library root for imported releases.',
        },
        {
          label: 'Staging',
          value: configuredPaths.staging ?? process.env.HARMONIARR_STAGING ?? '/data/staging',
          description: 'Review and quarantine workspace before import.',
        },
        {
          label: 'Transcode temp',
          value: configuredPaths.transcodeTemp ?? process.env.HARMONIARR_TRANSCODE_TEMP ?? '/data/transcode-temp',
          description: 'Scratch space reserved for future media processing jobs.',
        },
      ],
    };
  }
  return {
    getActivityFeed,
    getOperatorNotifications,
    getOverview,
  };
}
