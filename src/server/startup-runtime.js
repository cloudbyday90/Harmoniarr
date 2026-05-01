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
import { createLibraryDiscoveryHeartbeat } from './library/library-discovery-heartbeat.js';
import { resolveLibraryDiscoveryHeartbeatConfig } from './library/library-discovery-heartbeat-config.js';
import { assertNoPendingMigrations } from './migrations.js';
import { createRuntimeReporter } from './runtime-reporter.js';
import { bootstrapDatabaseSchemaFromSnapshot } from './schema-bootstrap.js';
import { createStartupServiceSupervisor } from './startup-service-supervisor.js';

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
  createLibraryDiscoveryHeartbeat: buildLibraryDiscoveryHeartbeat = createLibraryDiscoveryHeartbeat,
  createStartupServiceSupervisor: buildStartupServiceSupervisor = createStartupServiceSupervisor,
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
  await resolvePool().query('SELECT 1');

  const { app, appPort, importCandidateModule, libraryModule } = buildApp();
  const libraryDiscoveryHeartbeatConfig = buildLibraryDiscoveryHeartbeatConfig();
  const libraryDiscoveryHeartbeat = buildLibraryDiscoveryHeartbeat({
    getActiveRun: libraryModule.libraryDiscoveryRunStore.getActiveRun,
    getDiscoverySnapshot: libraryModule.libraryDiscoverySummaryStore.getLibraryDiscoverySnapshot,
    intervalMs: libraryDiscoveryHeartbeatConfig.intervalMs,
    libraryDiscoveryHeartbeatState: libraryModule.libraryDiscoveryHeartbeatState,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'discovery heartbeat failed' });
    },
    startLibraryDiscoveryRun: libraryModule.libraryDiscoveryRunService.startLibraryDiscoveryRun,
  });
  const importExecutionHeartbeat = buildImportCandidateExecutionHeartbeat({
    buildImportCandidateExecutionSummary: importCandidateModule.importCandidateExecutionSummaryService.buildImportCandidateExecutionSummary,
    importCandidateExecutionHeartbeatState: importCandidateModule.importCandidateExecutionHeartbeatState,
    intervalMs: importCandidateModule.importCandidateExecutionHeartbeatConfig.intervalMs,
    onError: (error) => {
      runtimeReporter.writeError(error, { label: 'import execution heartbeat failed' });
    },
    reconcileImportCandidateExecutionState: importCandidateModule.importCandidateExecutionReconciliationService.reconcileImportCandidateExecutionState,
  });

  const server = app.listen(appPort, host, () => {
    runtimeReporter.writeInfo(`listening on ${host}:${appPort}`);
  });
  const startupServiceSupervisor = buildStartupServiceSupervisor({ processEmitter });

  startupServiceSupervisor.registerService(libraryDiscoveryHeartbeat);
  startupServiceSupervisor.registerService(importExecutionHeartbeat);
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
    server,
    startupServiceSupervisor,
  };
}