/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { before, after, suite, test } from 'node:test';
import { getPool } from '../../src/server/database.js';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateMediaInspectionRunStore } from '../../src/server/import-candidates/import-candidate-media-inspection-run-store.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('Media inspection native finalization and app fixture ownership', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const entrypoint of ['functional', 'reusable']) {
    for (const fails of [false, true]) {
      test(`${entrypoint} keeps database/environment/workspace through inspection release${fails ? ' and retains scenario null' : ''}`, {
        timeout: config.scenarioTimeoutMs,
      }, async t => {
        const gate = createFixtureGate({ signal: t.signal }); const releasing = createFixtureGate({ signal: t.signal });
        const closing = createFixtureGate({ signal: t.signal }); const cleanupError = new Error('controlled native inspection release');
        const priorDatabase = process.env.PGDATABASE;
        let worker; let store; let workspace; let database; let released = false; let settled = false;
        const createAppFn = () => {
          store = createImportCandidateMediaInspectionRunStore();
          worker = createImportCandidateMediaInspectionWorker({ acquireLease: store.acquireLease, markRunStarted: store.markRunStarted,
            markRunCompleted: store.markRunCompleted, markRunFailed: store.markRunFailed,
            releaseLease: async input => {
              releasing.release(); await gate.promise;
              assert.equal((await getPool().query('SELECT current_database() AS name')).rows[0].name, database);
              await access(workspace); await store.releaseLease(input); released = true;
              if (fails) throw cleanupError;
            } });
          const close = worker.close;
          worker.close = () => { const pending = close(); closing.release(); return pending; };
          return { app: createServer((_request, response) => response.end('ready')), importCandidateModule: { importCandidateMediaInspectionWorker: worker } };
        };
        const run = async context => {
          workspace = context.workspaceDir; database = context.databaseConfig.database;
          assert.equal(await (await fetch(context.baseUrl)).text(), 'ready');
          const queued = await store.createOperationRun({ requestedCandidateCount: 0 });
          const claimed = await createOperationQueueStore().claimNextRunnableRun({ operationTypes: ['import_candidate_media_inspection'] });
          assert.equal(claimed.id, queued.id);
          const { completion } = await worker.startWorkerRun({ runId: queued.id, requestedCandidateCount: 0 });
          await waitForFixtureReady({ ready: releasing.promise, operation: completion, signal: t.signal });
          assert.equal((await store.getRunById(queued.id)).status, 'completed');
          if (fails) throw null;
          return 'inspection-result';
        };
        let runtime;
        if (entrypoint === 'reusable') runtime = await createIntegrationAppRuntime({ config, createAppFn,
          postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {} }) });
        const pending = entrypoint === 'reusable' ? runtime.runScenario(run)
          : withIntegrationApp({ config, createAppFn, run,
              withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) => postgres.runIsolatedDatabase(execute, { phaseObserver }) });
        void pending.then(() => { settled = true; }, () => { settled = true; });
        try {
          await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
          assert.equal(settled, false); assert.equal(released, false);
          assert.equal(process.env.PGDATABASE, database); assert.equal(getPool().ending, false); await access(workspace);
          await assert.rejects(worker.startWorkerRun({ runId: 'late', requestedCandidateCount: 0 }), { code: 'worker_closing' });
          gate.release();
          if (fails) await assert.rejects(pending, error => error === null);
          else assert.equal(await pending, 'inspection-result');
          assert.equal(released, true); assert.equal(process.env.PGDATABASE, priorDatabase);
          await assert.rejects(access(workspace), { code: 'ENOENT' });
          if (fails) await assert.rejects(worker.close(), error => error === cleanupError);
          else await worker.close();
        } finally { gate.release(); await pending.catch(() => {}); await runtime?.cleanup(); }
      });
    }
  }
  test('a native controlled probe remains owned until normal process/stdout close and durable finalization', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    await postgres.runIsolatedDatabase(async ({ getPoolFn }) => {
      await applyPendingMigrations({ getPoolFn });
      const store = createImportCandidateMediaInspectionRunStore({ getPoolFn });
      const queued = await store.createOperationRun({ requestedCandidateCount: 1 });
      const claimed = await createOperationQueueStore({ getPoolFn }).claimNextRunnableRun({ operationTypes: ['import_candidate_media_inspection'] });
      assert.equal(claimed.id, queued.id);
      const ready = createFixtureGate({ signal: t.signal }); const closed = Promise.withResolvers();
      let child; let closeSettled = false;
      const command = createMediaCommandService({ allowedBinaries: [process.execPath], spawnFn: (binary, args, options) => {
        assert.equal(binary, process.execPath); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
        assert.equal(args.at(-1), '/controlled/source.flac');
        // Native Node emits ffprobe-shaped JSON and waits on its private IPC channel.
        // This establishes a process lifetime, not validation of the ffprobe binary.
        child = spawn(binary, ['--input-type=module', '-e',
          "process.stdout.write(JSON.stringify({ streams: [{ codec_type: 'audio', codec_name: 'flac' }], format: {} })); process.send('ready'); process.on('message', () => { process.stdout.end(); process.disconnect(); });"],
        { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
        child.once('message', message => { if (message === 'ready') ready.release(); });
        child.once('close', (code, signal) => { closed.resolve({ code, signal }); });
        return child;
      } });
      const inspection = createMediaInspectionService({ ffprobeBin: process.execPath, mediaCommandService: command });
      const worker = createImportCandidateMediaInspectionWorker({ ...store,
        buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'controlled', executionStatus: { code: 'ready' } }] }),
        previewImportCandidateApply: async () => ({ files: [{ inspection: await inspection.inspectSourceFile({ sourcePath: '/controlled/source.flac' }) }] }),
      });
      const { completion } = await worker.startWorkerRun({ runId: queued.id, requestedCandidateCount: 1 });
      const closing = worker.close(); void closing.then(() => { closeSettled = true; }, () => { closeSettled = true; });
      try {
        await waitForFixtureReady({ ready: ready.promise, operation: completion, signal: t.signal });
        assert.equal(closeSettled, false); assert.equal(child.exitCode, null);
        assert.equal((await store.getRunById(queued.id)).status, 'running');
        await getPoolFn().query('SELECT 1'); child.send('finish');
        await completion; await closing;
        assert.deepEqual(await closed.promise, { code: 0, signal: null });
        const final = await store.getRunById(queued.id);
        assert.equal(final.status, 'completed'); assert.equal(final.inspectedFileCount, 1);
        assert.equal(final.inspectionUnavailableCount, 0);
      } finally {
        if (child?.exitCode === null && child.signalCode === null) child.kill();
        if (child) await closed.promise;
        await completion.catch(() => {}); await closing.catch(() => {});
      }
    });
  });
});
