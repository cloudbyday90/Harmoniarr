import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { access } from 'node:fs/promises';
import { buildIntegrationBackupEnvironment, createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
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
