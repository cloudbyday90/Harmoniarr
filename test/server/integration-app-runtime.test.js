import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { access, rm } from 'node:fs/promises';
import { buildIntegrationBackupEnvironment, createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';

test('integration runtime assigns backups to its scenario workspace', () => {
  const workspaceDir = join('temporary', 'harmoniarr-scenario');

  assert.deepEqual(buildIntegrationBackupEnvironment(workspaceDir), {
    HARMONIARR_BACKUPS: join(workspaceDir, 'backups'),
  });
});

function runtimeFixture({ prepareError = null, cleanupError = null } = {}) {
  const records = []; const calls = []; let workspace;
  return { records, calls, workspace: () => workspace,
    options: {
      phaseObserver: createFixturePhaseObserver({ onRecord: (record) => records.push(record) }),
      config: { poolConnectionTimeoutMs: 1000, suiteTeardownTimeoutMs: 1000, httpRequestTimeoutMs: 1000,
        keepArtifactsOnFailure: false },
      prepareDatabaseFn: async () => { calls.push('prepare'); if (prepareError) throw prepareError; },
      createAppFn: ({ clientDistDir }) => { workspace = join(clientDistDir, '..'); calls.push('app');
        return { app: createServer((_request, response) => { response.end('controlled'); }) }; },
      postgresRuntimeFactory: async () => ({
        cleanup: async () => { calls.push('postgres:cleanup'); if (cleanupError) throw cleanupError; },
        runIsolatedDatabase: async (run) => run({ databaseConfig: { database: 'private-db', host: 'hidden', port: 1,
          password: 'private-password', user: 'private-user' }, databaseName: 'private-db', source: 'fake' }),
      }),
    },
  };
}

test('app fixture emits separate setup, HTTP, work and teardown phases without its private configuration', async () => {
  const f = runtimeFixture(); const runtime = await createIntegrationAppRuntime(f.options);
  try {
    assert.equal(await runtime.runScenario(async ({ baseUrl, phaseObserver }) => {
      assert.equal(typeof phaseObserver.measure, 'function');
      return (await fetch(baseUrl)).text();
    }), 'controlled');
  } finally { await runtime.cleanup(); }
  for (const phase of ['schema_prepare', 'application_create', 'server_start', 'scenario_work', 'server_close', 'pool_close', 'workspace_remove']) {
    assert.ok(f.records.some((record) => record.phase === phase), phase);
  }
  assert.equal(JSON.stringify(f.records).includes('private'), false);
  assert.equal(JSON.stringify(f.records).includes(f.workspace()), false);
  await assert.rejects(access(f.workspace()), { code: 'ENOENT' });
});

test('schema preparation failure still reaches app fixture cleanup and preserves its original error', async () => {
  const primary = new Error('Controlled schema failure'); const f = runtimeFixture({ prepareError: primary });
  const originalDatabase = process.env.PGDATABASE; const runtime = await createIntegrationAppRuntime(f.options);
  try {
    await assert.rejects(runtime.runScenario(() => assert.fail('Scenario must not start')), (error) => error === primary);
    assert.equal(f.calls.includes('app'), false);
    assert.equal(process.env.PGDATABASE, originalDatabase);
    assert.ok(f.records.some((record) => record.phase === 'schema_prepare' && record.outcome === 'failed'));
    assert.ok(f.records.some((record) => record.phase === 'workspace_remove'));
  } finally { await runtime.cleanup(); }
});

test('runtime workspace cleanup still runs when PostgreSQL runtime teardown rejects', async () => {
  const secondary = new Error('Controlled PostgreSQL teardown failure'); const f = runtimeFixture({ cleanupError: secondary });
  const runtime = await createIntegrationAppRuntime(f.options);
  await runtime.runScenario(async () => 'complete');
  await assert.rejects(runtime.cleanup(), (error) => error === secondary);
  await assert.rejects(access(f.workspace()), { code: 'ENOENT' });
});

for (const primary of [new Error('controlled-primary'), null, undefined]) {
  test(`functional app retains an uncertain workspace and original ${primary === undefined ? 'cleanup refusal' : primary === null ? 'null' : 'Error'}`, async () => {
    const f = runtimeFixture(); let workspace;
    try {
      await assert.rejects(withIntegrationApp({ ...f.options, workspaceCleanupGuard: () => false,
        withPostgresIntegrationRuntimeFn: ({ run }) => run({ databaseConfig: { database: 'fixture', host: '127.0.0.1', port: 1, user: 'fixture' }, source: 'fake' }),
        run: input => { workspace = input.workspaceDir; if (primary !== undefined) throw primary; return 'complete'; },
      }), error => primary === undefined ? error.code === 'fixture_workspace_not_quiescent' : error === primary);
      await access(workspace);
    } finally { if (workspace) await rm(workspace, { recursive: true, force: true }); }
  });
}

const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

test('reusable cleanup drains held guards and database teardown, then refuses late scenarios', async () => {
  const f = runtimeFixture(); const entered = gate(); const guardHold = gate(); const dropping = gate(); const databaseHold = gate();
  const factory = f.options.postgresRuntimeFactory;
  f.options.postgresRuntimeFactory = async (...args) => {
    const pg = await factory(...args);
    return { ...pg, runIsolatedDatabase: async (...input) => { const result = await pg.runIsolatedDatabase(...input);
      dropping.release(); await databaseHold.promise; return result; } };
  };
  const runtime = await createIntegrationAppRuntime(f.options); let child;
  const pending = runtime.runScenario(input => { child = input.workspaceDir; return 'complete'; }, {
    workspaceCleanupGuard: async () => { entered.release(); return guardHold.promise; },
  });
  try {
    await entered.promise; const closing = runtime.cleanup(); assert.equal(runtime.cleanup(), closing);
    await assert.rejects(runtime.runScenario(() => assert.fail()), { code: 'fixture_runtime_closed' });
    await access(child); assert.equal(f.calls.includes('postgres:cleanup'), false);
    guardHold.release(true); await dropping.promise;
    await assert.rejects(access(child), { code: 'ENOENT' }); await access(f.workspace());
    assert.equal(f.calls.includes('postgres:cleanup'), false);
    databaseHold.release(); assert.equal(await pending, 'complete'); await closing;
    await assert.rejects(access(f.workspace()), { code: 'ENOENT' });
  } finally { guardHold.release(true); databaseHold.release(); await pending.catch(() => {}); await runtime.cleanup(); }
});

for (const primary of [new Error('original-reusable'), null]) {
  test(`reusable child and root retention preserve original ${primary === null ? 'null' : 'Error'} through a later teardown failure`, async () => {
    const f = runtimeFixture({ cleanupError: new Error('secondary-teardown') }); const runtime = await createIntegrationAppRuntime(f.options); let child;
    try {
      await assert.rejects(runtime.runScenario(input => { child = input.workspaceDir; throw primary; }, {
        workspaceCleanupGuard: () => false,
      }), error => error === primary);
      await assert.rejects(runtime.cleanup(), error => error === primary); await access(child); await access(f.workspace());
      assert.equal(f.calls.filter(call => call === 'postgres:cleanup').length, 1);
    } finally { await rm(f.workspace(), { force: true, recursive: true }); }
  });
}

test('a runtime-wide guard protects child deletion as well as the outer workspace', async () => {
  const f = runtimeFixture(); const runtime = await createIntegrationAppRuntime({ ...f.options, workspaceCleanupGuard: () => false }); let child;
  try {
    await assert.rejects(runtime.runScenario(input => { child = input.workspaceDir; }), { code: 'fixture_workspace_not_quiescent' });
    await assert.rejects(runtime.cleanup(), { code: 'fixture_workspace_not_quiescent' }); await access(child); await access(f.workspace());
  } finally { await rm(f.workspace(), { recursive: true, force: true }); }
});

test('reusable intentional failure artifacts survive outer cleanup', async () => {
  const f = runtimeFixture(); f.options.config.keepArtifactsOnFailure = true;
  const runtime = await createIntegrationAppRuntime(f.options); let child;
  try {
    await assert.rejects(runtime.runScenario(input => { child = input.workspaceDir; throw null; }), error => error === null);
    await runtime.cleanup(); await access(child); await access(f.workspace());
  } finally { await rm(f.workspace(), { recursive: true, force: true }); }
});

test('invalid cleanup guards and scenario path names refuse before native scenario work', async () => {
  const f = runtimeFixture();
  await assert.rejects(createIntegrationAppRuntime({ ...f.options, workspaceCleanupGuard: false,
    postgresRuntimeFactory: () => assert.fail() }), TypeError);
  const runtime = await createIntegrationAppRuntime(f.options);
  try {
    for (const scenarioName of ['../escape', '.', '/absolute', 'nested/path', 'C:\\outside', 'bad:name', '']) {
      await assert.rejects(runtime.runScenario(() => assert.fail(), { scenarioName }), TypeError);
    }
    await assert.rejects(runtime.runScenario(() => assert.fail(), { workspaceCleanupGuard: null }), TypeError);
    assert.equal(f.calls.includes('prepare'), false);
  } finally { await runtime.cleanup(); }
});

test('startup failure keeps original null and applies the outer guard to its captured workspace', async () => {
  for (const allowed of [true, false]) {
    const f = runtimeFixture(); let root;
    const observer = f.options.phaseObserver;
    try {
      await assert.rejects(createIntegrationAppRuntime({ ...f.options, workspaceCleanupGuard: () => allowed,
        phaseObserver: { ...observer, measure: async (phase, work) => {
          const result = await observer.measure(phase, work); if (phase === 'workspace_create') root = result.workspaceDir; return result;
        } }, postgresRuntimeFactory: async () => { throw null; },
      }), error => error === null);
      if (allowed) await assert.rejects(access(root), { code: 'ENOENT' }); else await access(root);
    } finally { if (root) await rm(root, { recursive: true, force: true }); }
  }
});
