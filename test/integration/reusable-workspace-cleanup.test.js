/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createOwnedMediaInspectionExecutor } from '../../testing/integration/owned-media-inspection-executor.js';
import { createOwnedMediaDockerTransport } from '../../testing/integration/owned-media-docker-transport.js';
import { captureMediaInspectionPolicy, mediaInspectionPrefix } from '../../testing/integration/owned-media-inspection-policy.js';
import { createLibraryAddMediaFixture } from '../../testing/integration/library-add-media-fixtures.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig(); const executeFile = promisify(execFile); const active = new Set(); let postgres;
function registered(operation) { active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation; }
const runtimeOptions = () => ({ config, createAppFn: () => ({ app: createServer((_req, res) => res.end('ready')) }),
  postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => postgres.runIsolatedDatabase(...args), cleanup: async () => {} }) });

suite('reusable workspace native ownership', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('held guard retains a real media mount until executor and database completion', {
    timeout: config.scenarioTimeoutMs, skip: !process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE && 'Requires an existing local media image',
  }, t => registered((async () => {
    const runtime = await createIntegrationAppRuntime(runtimeOptions()); const entered = createFixtureGate({ signal: t.signal });
    const closeHold = createFixtureGate({ signal: t.signal }); let executor; let child; let container; let closing;
    const pending = runtime.runScenario(async input => {
      child = input.workspaceDir;
      assert.equal((await input.getPoolFn().query('SELECT 42 AS answer')).rows[0].answer, 42);
      const media = createLibraryAddMediaFixture({ getFixtureRoot: () => child }); const source = join(child, 'controlled.wav');
      await media.generateAudio(source);
      executor = createOwnedMediaInspectionExecutor({ workspaceDir: child, signal: t.signal, inspectionReadMode: 'api',
        createTransport: options => createOwnedMediaDockerTransport({ ...options, executeFileFn: async (binary, args, commandOptions) => {
          const result = await executeFile(binary, args, commandOptions); if (args[0] === 'create') container = result.stdout.trim(); return result;
        } }),
      });
      assert.equal(JSON.parse((await executor.run('ffprobe', [...mediaInspectionPrefix, source])).stdout).format.tags.title, 'Controlled song');
      return 'canonical-complete';
    }, { scenarioName: 'media_owner', workspaceCleanupGuard: async () => {
      entered.release(); await closeHold.promise; await executor?.close(); return !executor || executor.canRemoveWorkspace();
    } });
    pending.catch(() => {});
    await withWorkerTaskCleanup(async () => {
      await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
      closing = runtime.cleanup(); assert.equal(runtime.cleanup(), closing); closing.catch(() => {});
      await assert.rejects(runtime.runScenario(() => assert.fail()), { code: 'fixture_runtime_closed' });
      await access(child); assert.equal(executor.canRemoveWorkspace(), false);
      const [state] = JSON.parse((await executeFile('docker', ['inspect', container], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })).stdout);
      assert.equal(state.State.Running, true); assert.equal(state.HostConfig.Mounts[0].Source, child);
      closeHold.release(); assert.equal(await pending, 'canonical-complete'); await closing;
      assert.equal(executor.canRemoveWorkspace(), true);
      await assert.rejects(access(child), { code: 'ENOENT' }); await assert.rejects(access(dirname(child)), { code: 'ENOENT' });
      await assert.rejects(executeFile('docker', ['inspect', container], { timeout: 30_000, windowsHide: true }));
    }, async () => { closeHold.release(); await pending.catch(() => {}); await runtime.cleanup(); });
  })()));

  test('a refused native child survives a successful sibling and outer teardown with original null', {
    timeout: config.scenarioTimeoutMs,
  }, () => registered((async () => {
    const runtime = await createIntegrationAppRuntime(runtimeOptions()); let first; let rootPolicy;
    try {
      await assert.rejects(runtime.runScenario(async input => {
        first = input.workspaceDir; rootPolicy = await captureMediaInspectionPolicy(dirname(first));
        assert.equal((await input.getPoolFn().query('SELECT 1 AS answer')).rows[0].answer, 1);
        await writeFile(join(first, 'retained'), 'controlled-evidence'); throw null;
      }, { scenarioName: 'same_name', workspaceCleanupGuard: () => false }), error => error === null);
      let second;
      await runtime.runScenario(async input => {
        second = input.workspaceDir; assert.notEqual(second, first);
        assert.equal((await input.getPoolFn().query('SELECT 2 AS answer')).rows[0].answer, 2);
      }, { scenarioName: 'same_name' });
      await assert.rejects(access(second), { code: 'ENOENT' }); await access(join(first, 'retained'));
      await assert.rejects(runtime.cleanup(), error => error === null); await access(join(first, 'retained'));
    } finally {
      await runtime.cleanup().catch(() => {});
      // This controlled refusal owns no external work; only the test reaps its retained evidence.
      if (rootPolicy) { await rootPolicy.assertRoot(); await rm(rootPolicy.root, { recursive: true, force: true }); }
    }
  })()));
});
