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

import { closePool, getPool } from './database.js';
import { createApp } from './app.js';
import { createImportCandidateExecutionHeartbeat } from './import-candidates/import-candidate-execution-heartbeat.js';
import { createFulfillmentCorrelationHeartbeat } from './fulfillment/fulfillment-correlation-heartbeat.js';
import { createLibraryDiscoveryHeartbeat } from './library/library-discovery-heartbeat.js';
import { createLibraryDiscoveryDispatchPolicyService } from './library/library-discovery-dispatch-policy-service.js';
import { resolveLibraryDiscoveryHeartbeatConfig } from './library/library-discovery-heartbeat-config.js';
import { createLedgerRetentionHeartbeat } from './ledger-retention-heartbeat.js';
import { createLedgerRetentionService } from './ledger-retention-service.js';
import { createMetadataRefreshHeartbeat } from './metadata/metadata-refresh-heartbeat.js';
import { assertNoPendingMigrations } from './migrations.js';
import { createOperationQueueDispatcher } from './operation-queue-dispatcher.js';
import { createOperationQueueHandlers } from './operation-queue-handlers.js';
import { createOperationQueueStore } from './operation-queue-store.js';
import { createOperationStrandedRunRecoveryService } from './operation-stranded-run-recovery-service.js';
import { createMaintenanceLockHeartbeatPauseService } from './recovery/maintenance-lock-heartbeat-pause-service.js';
import { createRuntimeReporter } from './runtime-reporter.js';
import { bootstrapDatabaseSchemaFromSnapshot } from './schema-bootstrap.js';
import { createStartupServiceSupervisor } from './startup-service-supervisor.js';
import { createStartupValidationService } from './startup-validation-service.js';

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function startServerRuntime({
  assertNoPendingMigrations: verifyNoPendingMigrations = assertNoPendingMigrations,
  closePool: closeDatabasePool = closePool,
  createApp: buildApp = createApp,
  createImportCandidateExecutionHeartbeat: buildImportCandidateExecutionHeartbeat = createImportCandidateExecutionHeartbeat,
  createFulfillmentCorrelationHeartbeat: buildFulfillmentCorrelationHeartbeat = createFulfillmentCorrelationHeartbeat,
  createLedgerRetentionHeartbeat: buildLedgerRetentionHeartbeat = createLedgerRetentionHeartbeat,
  createLedgerRetentionService: buildLedgerRetentionService = createLedgerRetentionService,
  createLibraryDiscoveryDispatchPolicyService: buildLibraryDiscoveryDispatchPolicyService = createLibraryDiscoveryDispatchPolicyService,
  createLibraryDiscoveryHeartbeat: buildLibraryDiscoveryHeartbeat = createLibraryDiscoveryHeartbeat,
  createMetadataRefreshHeartbeat: buildMetadataRefreshHeartbeat = createMetadataRefreshHeartbeat,
  createOperationQueueDispatcher: buildOperationQueueDispatcher = createOperationQueueDispatcher,
  createOperationQueueHandlers: buildOperationQueueHandlers = createOperationQueueHandlers,
  createOperationQueueStore: buildOperationQueueStore = createOperationQueueStore,
  createOperationStrandedRunRecoveryService: buildOperationStrandedRunRecoveryService = createOperationStrandedRunRecoveryService,
  createStartupServiceSupervisor: buildStartupServiceSupervisor = createStartupServiceSupervisor,
  createStartupValidationService: buildStartupValidationService = createStartupValidationService,
  bootstrapDatabaseSchemaFromSnapshot: bootstrapSchemaFromSnapshot = bootstrapDatabaseSchemaFromSnapshot,
  getPool: resolvePool = getPool,
  host = '0.0.0.0',
  processEmitter = process,
  resolveLibraryDiscoveryHeartbeatConfig: buildLibraryDiscoveryHeartbeatConfig = resolveLibraryDiscoveryHeartbeatConfig,
  stderr = process.stderr,
  stdout = process.stdout,
} = {}) {
  const runtimeReporter = createRuntimeReporter({
    prefix: 'harmoniarr',
    stderr,
    stdout,
  });

  const schemaBootstrap = await bootstrapSchemaFromSnapshot({
    getPoolFn: resolvePool,
  });
  if (schemaBootstrap.bootstrapped) {
    runtimeReporter.writeInfo(`loaded schema snapshot from ${schemaBootstrap.schemaSnapshotPath}`);
  }

  await verifyNoPendingMigrations();
  await buildStartupValidationService({
    getPoolFn: resolvePool,
  }).assertStartupReady();

  const {
    app,
    appPort,
    activityModule,
    artworkModule,
    fulfillmentModule,
    importCandidateModule,
    libraryModule,
    maintenanceLockOperationPauseService,
    maintenanceLockService,
    metadataModule,
    pushModule,
    systemModule,
  } = buildApp();
  const maintenanceLockHeartbeatPauseService = createMaintenanceLockHeartbeatPauseService({
    listActiveMaintenanceLocks: maintenanceLockService.listActiveMaintenanceLocks,
  });
  systemModule?.runtimeResourceService?.applyProcessRuntimePreferences?.({
    onInfo: runtimeReporter.writeInfo,
    onWarning: runtimeReporter.writeWarning,
  });
  systemModule?.runtimeResourceMonitor?.setLogHandlers?.({
    onInfo: runtimeReporter.writeInfo,
    onWarning: (message) => {
      runtimeReporter.writeWarning(message);
    },
  });
  const getDependencyHealth = systemModule?.dependencyHealthService?.getDependencyHealth
    ?? (async () => []);
  const libraryDiscoveryHeartbeatConfig = buildLibraryDiscoveryHeartbeatConfig();
  const libraryDiscoveryDispatchPolicyService = buildLibraryDiscoveryDispatchPolicyService();
  const libraryDiscoveryHeartbeat = buildLibraryDiscoveryHeartbeat({
    getActiveRun: libraryModule.libraryDiscoveryRunStore.getActiveRun,
    getDependencyHealth,
    getDiscoverySnapshot: libraryModule.libraryDiscoverySummaryStore.getLibraryDiscoverySnapshot,
    heartbeatPauseService: maintenanceLockHeartbeatPauseService,
    intervalMs: libraryDiscoveryHeartbeatConfig.intervalMs,
    libraryDiscoveryDispatchPolicyService,
    libraryDiscoveryHeartbeatState: libraryModule.libraryDiscoveryHeartbeatState,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'discovery heartbeat failed' });
    },
    startLibraryDiscoveryRun: libraryModule.libraryDiscoveryRunService.startLibraryDiscoveryRun,
  });
  const importExecutionHeartbeat = buildImportCandidateExecutionHeartbeat({
    buildImportCandidateExecutionSummary: importCandidateModule.importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
    heartbeatPauseService: maintenanceLockHeartbeatPauseService,
    importCandidateExecutionHeartbeatState: importCandidateModule.importCandidateExecutionHeartbeatState,
    intervalMs: importCandidateModule.importCandidateExecutionHeartbeatConfig.intervalMs,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'import execution heartbeat failed' });
    },
    reconcileImportCandidateExecutionState: importCandidateModule.importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionState,
  });
  const metadataRefreshHeartbeat = buildMetadataRefreshHeartbeat({
    getDependencyHealth,
    heartbeatPauseService: maintenanceLockHeartbeatPauseService,
    intervalMs: metadataModule.metadataRefreshHeartbeatConfig.intervalMs,
    metadataRefreshDispatchPolicyService: metadataModule.metadataRefreshDispatchPolicyService,
    metadataRefreshHeartbeatState: metadataModule.metadataRefreshHeartbeatState,
    metadataRefreshSchedulerService: metadataModule.metadataRefreshSchedulerService,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'metadata refresh heartbeat failed' });
    },
    startMetadataArtistRefresh: metadataModule.metadataArtistRefreshService.startMetadataArtistRefresh,
  });
  const operationQueueStore = buildOperationQueueStore();
  const fulfillmentCorrelationHeartbeat = buildFulfillmentCorrelationHeartbeat({
    correlateUnmatchedEvidence: fulfillmentModule.fulfillmentEvidenceService.correlateUnmatchedEvidence,
    deleteExpiredEvidence: fulfillmentModule.fulfillmentEvidenceService.deleteExpiredEvidence,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'fulfillment correlation heartbeat failed' });
    },
  });
  const ledgerRetentionService = buildLedgerRetentionService({
    outcomeLedgerStore: activityModule.sourceUserOutcomeLedgerStore,
  });
  const ledgerRetentionHeartbeat = buildLedgerRetentionHeartbeat({
    applyLedgerRetention: ledgerRetentionService.applyLedgerRetention,
    heartbeatPauseService: maintenanceLockHeartbeatPauseService,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'ledger retention heartbeat failed' });
    },
  });
  const operationStrandedRunRecoveryService = buildOperationStrandedRunRecoveryService({
    operationQueueStore,
  });
  const operationQueueDispatcher = buildOperationQueueDispatcher({
    dispatchPauseService: maintenanceLockOperationPauseService,
    handlers: buildOperationQueueHandlers({
      artworkModule,
      importCandidateModule,
      libraryModule,
      metadataModule,
      systemModule,
    }),
    onError: (error, { run } = {}) => {
      runtimeReporter.writeError(error, {
        label: run?.id ? `operation queue dispatch failed for ${run.id}` : 'operation queue dispatch failed',
      });
    },
    operationQueueStore,
    operationStrandedRunRecoveryService,
  });

  const server = app.listen(appPort, host, () => {
    runtimeReporter.writeInfo(`listening on ${host}:${appPort}`);
  });
  const startupServiceSupervisor = buildStartupServiceSupervisor({ processEmitter });

  startupServiceSupervisor.registerService(operationQueueDispatcher);
  startupServiceSupervisor.registerService(metadataRefreshHeartbeat);
  startupServiceSupervisor.registerService(libraryDiscoveryHeartbeat);
  startupServiceSupervisor.registerService(importExecutionHeartbeat);
  startupServiceSupervisor.registerService(fulfillmentCorrelationHeartbeat);
  startupServiceSupervisor.registerService(ledgerRetentionHeartbeat);
  startupServiceSupervisor.registerService(systemModule.operatorNotificationFanoutHeartbeat);
  if (pushModule?.pushNotificationDeliveryHeartbeat) {
    startupServiceSupervisor.registerService(pushModule.pushNotificationDeliveryHeartbeat);
  }
  if (pushModule?.pushNotificationHistoryCleanupHeartbeat) {
    startupServiceSupervisor.registerService(pushModule.pushNotificationHistoryCleanupHeartbeat);
  }
  startupServiceSupervisor.registerService(systemModule.idempotencyRecordCleanupHeartbeat);
  if (systemModule?.runtimeResourceMonitor) {
    startupServiceSupervisor.registerService(systemModule.runtimeResourceMonitor);
  }
  startupServiceSupervisor.startAll();

  startupServiceSupervisor.installSignalHandlers(async () => {
    try {
      await startupServiceSupervisor.shutdown({
        onShutdown: async () => {
          await closeServer(server);
          await closeDatabasePool();
        },
      });
    } catch (error) {
      runtimeReporter.writeError(error, { label: 'shutdown error' });
      processEmitter.exitCode = 1;
    }
  });

  return {
    importExecutionHeartbeat,
    libraryDiscoveryHeartbeat,
    metadataRefreshHeartbeat,
    operationQueueDispatcher,
    pushModule: pushModule ?? null,
    runtimeResourceMonitor: systemModule?.runtimeResourceMonitor ?? null,
    server,
    startupServiceSupervisor,
  };
}
