import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { startServerRuntime } from '../../src/server/startup-runtime.js';

test('startServerRuntime composes startup services, starts them, and shuts them down on signal', async () => {
  const processEmitter = new EventEmitter();
  const stdoutWrites = [];
  const stderrWrites = [];
  const callOrder = [];
  const registeredServices = [];
  let resolveShutdownComplete;
  const shutdownComplete = new Promise((resolve) => {
    resolveShutdownComplete = resolve;
  });

  const libraryDiscoveryHeartbeat = {
    start() {
      callOrder.push('start:library');
    },
    async stop() {
      callOrder.push('stop:library');
    },
  };
  const importExecutionHeartbeat = {
    start() {
      callOrder.push('start:import');
    },
    async stop() {
      callOrder.push('stop:import');
    },
  };
  const metadataRefreshHeartbeat = {
    start() {
      callOrder.push('start:metadata');
    },
    async stop() {
      callOrder.push('stop:metadata');
    },
  };
  const operationQueueDispatcher = {
    start() {
      callOrder.push('start:queue');
    },
    async stop() {
      callOrder.push('stop:queue');
    },
  };
  const idempotencyRecordCleanupHeartbeat = {
    start() {
      callOrder.push('start:idempotency-cleanup');
    },
    async stop() {
      callOrder.push('stop:idempotency-cleanup');
    },
  };
  const operatorNotificationFanoutHeartbeat = {
    start() {
      callOrder.push('start:operator-fanout');
    },
    async stop() {
      callOrder.push('stop:operator-fanout');
    },
  };
  const pushNotificationHistoryCleanupHeartbeat = {
    start() {
      callOrder.push('start:push-history-cleanup');
    },
    async stop() {
      callOrder.push('stop:push-history-cleanup');
    },
  };
  const pushNotificationDeliveryHeartbeat = {
    start() {
      callOrder.push('start:push-delivery');
    },
    async stop() {
      callOrder.push('stop:push-delivery');
    },
  };
  const fulfillmentCorrelationHeartbeat = {
    start() {
      callOrder.push('start:fulfillment-correlation');
    },
    async stop() {
      callOrder.push('stop:fulfillment-correlation');
    },
  };
  const ledgerRetentionHeartbeat = {
    start() {
      callOrder.push('start:ledger-retention');
    },
    async stop() {
      callOrder.push('stop:ledger-retention');
    },
  };
  const operationStrandedRunRecoveryService = {
    recoverStrandedRuns: async () => ({
      activeLeaseCount: 0,
      failedCount: 0,
      retriedCount: 0,
      scannedCount: 0,
      skipped: true,
    }),
  };
  const runtimeResourceMonitor = {
    setLogHandlers({ onInfo, onWarning }) {
      callOrder.push('runtimeMonitor.setLogHandlers');
      assert.equal(typeof onInfo, 'function');
      assert.equal(typeof onWarning, 'function');
    },
    start() {
      callOrder.push('start:runtime-monitor');
    },
    async stop() {
      callOrder.push('stop:runtime-monitor');
    },
  };
  const runtimeResourceService = {
    applyProcessRuntimePreferences({ onInfo, onWarning }) {
      callOrder.push('runtimeResourceService.apply');
      assert.equal(typeof onInfo, 'function');
      assert.equal(typeof onWarning, 'function');
    },
  };

  const server = {
    close(callback) {
      callOrder.push('server.close');
      callback();
    },
  };

  const runtime = await startServerRuntime({
    bootstrapDatabaseSchemaFromSnapshot: async () => {
      callOrder.push('bootstrapSchema');
      return {
        bootstrapped: true,
        schemaSnapshotPath: 'schema.sql',
      };
    },
    createStartupValidationService: () => ({
      async assertStartupReady() {
        callOrder.push('startupValidation');
      },
    }),
    assertNoPendingMigrations: async () => {
      callOrder.push('migrations');
    },
    closePool: async () => {
      callOrder.push('closePool');
      resolveShutdownComplete();
    },
    createApp: () => ({
      app: {
        listen(port, host, callback) {
          callOrder.push(`listen:${host}:${port}`);
          callback();
          return server;
        },
      },
      appPort: 4123,
      activityModule: {
        sourceUserOutcomeLedgerStore: {
          countExpiredOutcomeEvents: async () => ({ prunableCount: 0 }),
          pruneOutcomeEvents: async () => ({ prunedCount: 0 }),
        },
      },
      artworkModule: {
        artworkCleanupWorker: {
          startWorkerRun: async () => {},
        },
      },
      importCandidateModule: {
        importCandidateApplyWorker: {
          startWorkerRun: async () => {},
        },
        importCandidateExecutionHeartbeatConfig: {
          intervalMs: 60000,
        },
        importCandidateExecutionHeartbeatState: { kind: 'import-state' },
        importCandidateExecutionReconciliationService: {
          reconcileImportCandidateExecutionState: async () => {},
        },
        importCandidateExecutionSummaryService: {
          buildImportCandidateExecutionSummary: async () => ({}),
        },
        importCandidateExecutionWorker: {
          startWorkerRun: async () => {},
        },
      },
      fulfillmentModule: {
        fulfillmentEvidenceService: {
          correlateUnmatchedEvidence: async () => ({ matched: 0, total: 0, unmatched: 0 }),
          deleteExpiredEvidence: async () => 0,
        },
      },
      maintenanceLockService: {
        listActiveMaintenanceLocks: async () => [],
      },
      maintenanceLockOperationPauseService: {
        resolveDispatchReadiness: () => ({ allowed: true }),
      },
      libraryModule: {
        libraryDiscoveryDispatchPolicyService: {
          resolveDispatchReadiness: () => ({ allowed: true }),
        },
        libraryDiscoveryHeartbeatState: { kind: 'library-state' },
        libraryDiscoveryRunService: {
          startLibraryDiscoveryRun: async () => {},
        },
        libraryDiscoveryRunStore: {
          getActiveRun: async () => null,
        },
        libraryDiscoverySummaryStore: {
          getLibraryDiscoverySnapshot: async () => null,
        },
        libraryDiscoveryWorker: {
          startWorkerRun: async () => {},
        },
        libraryScanWorker: {
          startWorkerRun: async () => {},
        },
      },
      metadataModule: {
        metadataArtistRefreshService: {
          startMetadataArtistRefresh: async () => ({ accepted: true }),
        },
        metadataRefreshDispatchPolicyService: {
          resolveDispatchReadiness: () => ({ allowed: true }),
        },
        metadataRefreshHeartbeatConfig: {
          intervalMs: 900000,
        },
        metadataRefreshHeartbeatState: { kind: 'metadata-refresh-state' },
        metadataRefreshSchedulerService: {
          getNextDueArtist: async () => null,
        },
        metadataArtistRefreshWorker: {
          startWorkerRun: async () => {},
        },
      },
      pushModule: {
        pushNotificationDeliveryHeartbeat,
        pushNotificationHistoryCleanupHeartbeat,
      },
      systemModule: {
        dependencyHealthService: {
          getDependencyHealth: async () => [],
        },
        idempotencyRecordCleanupHeartbeat,
        operatorNotificationFanoutHeartbeat,
        runtimeResourceMonitor,
        runtimeResourceService,
      },
    }),
    createImportCandidateExecutionHeartbeat: (options) => {
      assert.equal(typeof options.heartbeatPauseService.resolveHeartbeatReadiness, 'function');
      assert.equal(options.intervalMs, 60000);
      assert.equal(typeof options.onError, 'function');
      return importExecutionHeartbeat;
    },
    createLibraryDiscoveryHeartbeat: (options) => {
      assert.equal(typeof options.getDependencyHealth, 'function');
      assert.equal(typeof options.heartbeatPauseService.resolveHeartbeatReadiness, 'function');
      assert.equal(options.intervalMs, 900000);
      assert.equal(typeof options.libraryDiscoveryDispatchPolicyService.resolveDispatchReadiness, 'function');
      assert.equal(typeof options.onError, 'function');
      return libraryDiscoveryHeartbeat;
    },
    createMetadataRefreshHeartbeat: (options) => {
      assert.equal(typeof options.getDependencyHealth, 'function');
      assert.equal(typeof options.heartbeatPauseService.resolveHeartbeatReadiness, 'function');
      assert.equal(options.intervalMs, 900000);
      assert.equal(typeof options.onError, 'function');
      assert.equal(typeof options.metadataRefreshDispatchPolicyService.resolveDispatchReadiness, 'function');
      assert.equal(typeof options.metadataRefreshSchedulerService.getNextDueArtist, 'function');
      assert.equal(typeof options.startMetadataArtistRefresh, 'function');
      return metadataRefreshHeartbeat;
    },
    createOperationQueueDispatcher: ({
      dispatchPauseService,
      handlers,
      onError,
      operationQueueStore,
      operationStrandedRunRecoveryService: injectedRecoveryService,
    }) => {
      assert.equal(typeof dispatchPauseService.resolveDispatchReadiness, 'function');
      assert.equal(typeof onError, 'function');
      assert.equal(typeof handlers.artwork_cleanup, 'function');
      assert.equal(typeof handlers.library_scan, 'function');
      assert.equal(typeof operationQueueStore.claimNextRunnableRun, 'function');
      assert.equal(injectedRecoveryService, operationStrandedRunRecoveryService);
      return operationQueueDispatcher;
    },
    createOperationQueueHandlers: ({ artworkModule, importCandidateModule, libraryModule, metadataModule }) => {
      assert.equal(typeof artworkModule.artworkCleanupWorker.startWorkerRun, 'function');
      assert.equal(typeof importCandidateModule.importCandidateApplyWorker.startWorkerRun, 'function');
      assert.equal(typeof libraryModule.libraryScanWorker.startWorkerRun, 'function');
      assert.equal(typeof metadataModule.metadataArtistRefreshWorker.startWorkerRun, 'function');
      return {
        artwork_cleanup: async () => {},
        library_scan: async () => {},
        metadata_artist_refresh: async () => {},
      };
    },
    createOperationStrandedRunRecoveryService: ({ operationQueueStore }) => {
      assert.equal(typeof operationQueueStore.claimNextRunnableRun, 'function');
      return operationStrandedRunRecoveryService;
    },
    createFulfillmentCorrelationHeartbeat: (options) => {
      assert.equal(typeof options.correlateUnmatchedEvidence, 'function');
      assert.equal(typeof options.deleteExpiredEvidence, 'function');
      assert.equal(typeof options.onError, 'function');
      return fulfillmentCorrelationHeartbeat;
    },
    createLedgerRetentionService: (options) => {
      assert.equal(typeof options.outcomeLedgerStore.pruneOutcomeEvents, 'function');
      return { applyLedgerRetention: async () => ({ totalPruned: 0 }) };
    },
    createLedgerRetentionHeartbeat: (options) => {
      assert.equal(typeof options.applyLedgerRetention, 'function');
      return ledgerRetentionHeartbeat;
    },
    createStartupServiceSupervisor: ({ processEmitter: injectedProcessEmitter }) => {
      assert.equal(injectedProcessEmitter, processEmitter);

      return {
        registerService(service) {
          registeredServices.push(service);
        },
        startAll() {
          callOrder.push('startAll');
          for (const service of registeredServices) {
            service.start();
          }
        },
        installSignalHandlers(onSignal) {
          processEmitter.on('SIGTERM', () => {
            void onSignal('SIGTERM');
          });
        },
        async shutdown({ onShutdown }) {
          callOrder.push('shutdown');
          for (const service of [...registeredServices].reverse()) {
            await service.stop();
          }

          await onShutdown();
        },
      };
    },
    processEmitter,
    resolveLibraryDiscoveryHeartbeatConfig: () => ({
      intervalMs: 900000,
    }),
    stderr: {
      write(message) {
        stderrWrites.push(message);
      },
    },
    stdout: {
      write(message) {
        stdoutWrites.push(message);
      },
    },
  });

  assert.equal(runtime.server, server);
  assert.equal(runtime.operationQueueDispatcher, operationQueueDispatcher);
  assert.equal(runtime.libraryDiscoveryHeartbeat, libraryDiscoveryHeartbeat);
  assert.equal(runtime.importExecutionHeartbeat, importExecutionHeartbeat);
  assert.equal(runtime.metadataRefreshHeartbeat, metadataRefreshHeartbeat);
  assert.equal(runtime.runtimeResourceMonitor, runtimeResourceMonitor);
  assert.deepEqual(registeredServices, [
    operationQueueDispatcher,
    metadataRefreshHeartbeat,
    libraryDiscoveryHeartbeat,
    importExecutionHeartbeat,
    fulfillmentCorrelationHeartbeat,
    ledgerRetentionHeartbeat,
    operatorNotificationFanoutHeartbeat,
    pushNotificationDeliveryHeartbeat,
    pushNotificationHistoryCleanupHeartbeat,
    idempotencyRecordCleanupHeartbeat,
    runtimeResourceMonitor,
  ]);
  assert.deepEqual(callOrder, [
    'bootstrapSchema',
    'migrations',
    'startupValidation',
    'runtimeResourceService.apply',
    'runtimeMonitor.setLogHandlers',
    'listen:0.0.0.0:4123',
    'startAll',
    'start:queue',
    'start:metadata',
    'start:library',
    'start:import',
    'start:fulfillment-correlation',
    'start:ledger-retention',
    'start:operator-fanout',
    'start:push-delivery',
    'start:push-history-cleanup',
    'start:idempotency-cleanup',
    'start:runtime-monitor',
  ]);
  assert.deepEqual(stdoutWrites, [
    '[harmoniarr] loaded schema snapshot from schema.sql\n',
    '[harmoniarr] listening on 0.0.0.0:4123\n',
  ]);

  processEmitter.emit('SIGTERM');
  await shutdownComplete;

  assert.deepEqual(callOrder, [
    'bootstrapSchema',
    'migrations',
    'startupValidation',
    'runtimeResourceService.apply',
    'runtimeMonitor.setLogHandlers',
    'listen:0.0.0.0:4123',
    'startAll',
    'start:queue',
    'start:metadata',
    'start:library',
    'start:import',
    'start:fulfillment-correlation',
    'start:ledger-retention',
    'start:operator-fanout',
    'start:push-delivery',
    'start:push-history-cleanup',
    'start:idempotency-cleanup',
    'start:runtime-monitor',
    'shutdown',
    'stop:runtime-monitor',
    'stop:idempotency-cleanup',
    'stop:push-history-cleanup',
    'stop:push-delivery',
    'stop:operator-fanout',
    'stop:ledger-retention',
    'stop:fulfillment-correlation',
    'stop:import',
    'stop:library',
    'stop:metadata',
    'stop:queue',
    'server.close',
    'closePool',
  ]);
  assert.deepEqual(stderrWrites, []);
});

test('startServerRuntime reports shutdown errors through stderr and sets exitCode', async () => {
  const processEmitter = new EventEmitter();
  const stderrWrites = [];
  let resolveShutdownErrorLogged;
  const shutdownErrorLogged = new Promise((resolve) => {
    resolveShutdownErrorLogged = resolve;
  });

  await startServerRuntime({
    bootstrapDatabaseSchemaFromSnapshot: async () => ({
      bootstrapped: false,
      schemaSnapshotPath: 'schema.sql',
    }),
    createStartupValidationService: () => ({
      async assertStartupReady() {},
    }),
    assertNoPendingMigrations: async () => {},
    closePool: async () => {},
    createApp: () => ({
      app: {
        listen(_port, _host, callback) {
          callback();
          return {
            close(done) {
              done(new Error('server already closed'));
            },
          };
        },
      },
      appPort: 4123,
      activityModule: {
        sourceUserOutcomeLedgerStore: {
          countExpiredOutcomeEvents: async () => ({ prunableCount: 0 }),
          pruneOutcomeEvents: async () => ({ prunedCount: 0 }),
        },
      },
      artworkModule: {
        artworkCleanupWorker: {
          startWorkerRun: async () => {},
        },
      },
      importCandidateModule: {
        importCandidateApplyWorker: {
          startWorkerRun: async () => {},
        },
        importCandidateExecutionHeartbeatConfig: {
          intervalMs: 60000,
        },
        importCandidateExecutionHeartbeatState: {},
        importCandidateExecutionReconciliationService: {
          reconcileImportCandidateExecutionState: async () => {},
        },
        importCandidateExecutionSummaryService: {
          buildImportCandidateExecutionSummary: async () => ({}),
        },
        importCandidateExecutionWorker: {
          startWorkerRun: async () => {},
        },
      },
      fulfillmentModule: {
        fulfillmentEvidenceService: {
          correlateUnmatchedEvidence: async () => ({ matched: 0, total: 0, unmatched: 0 }),
          deleteExpiredEvidence: async () => 0,
        },
      },
      maintenanceLockService: {
        listActiveMaintenanceLocks: async () => [],
      },
      libraryModule: {
        libraryDiscoveryHeartbeatState: {},
        libraryDiscoveryRunService: {
          startLibraryDiscoveryRun: async () => {},
        },
        libraryDiscoveryRunStore: {
          getActiveRun: async () => null,
        },
        libraryDiscoverySummaryStore: {
          getLibraryDiscoverySnapshot: async () => null,
        },
        libraryDiscoveryWorker: {
          startWorkerRun: async () => {},
        },
        libraryScanWorker: {
          startWorkerRun: async () => {},
        },
      },
      metadataModule: {
        metadataArtistRefreshService: {
          startMetadataArtistRefresh: async () => ({ accepted: true }),
        },
        metadataRefreshDispatchPolicyService: {
          resolveDispatchReadiness: () => ({ allowed: true }),
        },
        metadataRefreshHeartbeatConfig: {
          intervalMs: 900000,
        },
        metadataRefreshHeartbeatState: {},
        metadataRefreshSchedulerService: {
          getNextDueArtist: async () => null,
        },
        metadataArtistRefreshWorker: {
          startWorkerRun: async () => {},
        },
      },
      pushModule: {
        pushNotificationDeliveryHeartbeat: {
          start() {},
          async stop() {},
        },
        pushNotificationHistoryCleanupHeartbeat: {
          start() {},
          async stop() {},
        },
      },
      systemModule: {
        dependencyHealthService: {
          getDependencyHealth: async () => [],
        },
        idempotencyRecordCleanupHeartbeat: {
          start() {},
          async stop() {},
        },
        operatorNotificationFanoutHeartbeat: {
          start() {},
          async stop() {},
        },
      },
    }),
    createImportCandidateExecutionHeartbeat: () => ({
      start() {},
      async stop() {},
    }),
    createLibraryDiscoveryHeartbeat: () => ({
      start() {},
      async stop() {},
    }),
    createMetadataRefreshHeartbeat: () => ({
      start() {},
      async stop() {},
    }),
    createOperationQueueDispatcher: () => ({
      start() {},
      async stop() {},
    }),
    createOperationQueueHandlers: () => ({
      artwork_cleanup: async () => {},
    }),
    createOperationStrandedRunRecoveryService: () => ({
      recoverStrandedRuns: async () => ({ skipped: true }),
    }),
    createStartupServiceSupervisor: ({ processEmitter: injectedProcessEmitter }) => ({
      registerService() {},
      startAll() {},
      installSignalHandlers(onSignal) {
        injectedProcessEmitter.on('SIGINT', () => {
          void onSignal('SIGINT');
        });
      },
      async shutdown({ onShutdown }) {
        await onShutdown();
      },
    }),
    processEmitter,
    resolveLibraryDiscoveryHeartbeatConfig: () => ({
      intervalMs: 900000,
    }),
    stderr: {
      write(message) {
        stderrWrites.push(message);
        resolveShutdownErrorLogged();
      },
    },
    stdout: {
      write() {},
    },
  });

  processEmitter.emit('SIGINT');
  await shutdownErrorLogged;

  assert.equal(processEmitter.exitCode, 1);
  assert.deepEqual(stderrWrites, [
    '[harmoniarr] shutdown error: server already closed\n',
  ]);
});

test('startServerRuntime fails before app composition when startup validation rejects', async () => {
  await assert.rejects(
    () => startServerRuntime({
      bootstrapDatabaseSchemaFromSnapshot: async () => ({
        bootstrapped: false,
        schemaSnapshotPath: 'schema.sql',
      }),
      createApp: () => {
        throw new Error('createApp should not run when startup validation fails');
      },
      createStartupValidationService: () => ({
        async assertStartupReady() {
          throw new Error('Startup validation failed: Staging root: Configured path is not reachable from Harmoniarr. (ENOENT)');
        },
      }),
      assertNoPendingMigrations: async () => {},
      closePool: async () => {},
    }),
    /Startup validation failed: Staging root: Configured path is not reachable from Harmoniarr\. \(ENOENT\)/,
  );
});
