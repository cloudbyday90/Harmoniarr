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
      importCandidateModule: {
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
      },
      libraryModule: {
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
      },
    }),
    createImportCandidateExecutionHeartbeat: (options) => {
      assert.equal(options.intervalMs, 60000);
      assert.equal(typeof options.onError, 'function');
      return importExecutionHeartbeat;
    },
    createLibraryDiscoveryHeartbeat: (options) => {
      assert.equal(options.intervalMs, 900000);
      assert.equal(typeof options.onError, 'function');
      return libraryDiscoveryHeartbeat;
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
    getPool: () => ({
      async query(sql) {
        callOrder.push(`query:${sql}`);
      },
    }),
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
  assert.equal(runtime.libraryDiscoveryHeartbeat, libraryDiscoveryHeartbeat);
  assert.equal(runtime.importExecutionHeartbeat, importExecutionHeartbeat);
  assert.deepEqual(registeredServices, [libraryDiscoveryHeartbeat, importExecutionHeartbeat]);
  assert.deepEqual(callOrder, [
    'bootstrapSchema',
    'migrations',
    'query:SELECT 1',
    'listen:0.0.0.0:4123',
    'startAll',
    'start:library',
    'start:import',
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
    'query:SELECT 1',
    'listen:0.0.0.0:4123',
    'startAll',
    'start:library',
    'start:import',
    'shutdown',
    'stop:import',
    'stop:library',
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
      importCandidateModule: {
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
    getPool: () => ({
      async query() {},
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