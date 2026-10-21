/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import { after, before, suite, test } from 'node:test';
import { armCommand } from '../../src/server/cli/recovery-commands.js';
import { writeAndExit } from '../../src/server/cli/cli-runtime.js';
import { createAdminRecoveryService, verifyRecoveryCode } from '../../src/server/recovery/admin-recovery-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const armedCount = async pool => (await pool.query("SELECT count(*)::int AS count FROM admin_recovery_runs WHERE status='armed'")).rows[0].count;
const auditCount = async pool => (await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='bootstrap_admin_recovery_armed'")).rows[0].count;

function parsePrivateResult(bytes) {
  try { return JSON.parse(bytes.toString()); }
  catch { throw new Error('Fixture CLI result was not complete JSON'); }
}

async function cli(t, args) {
  const child = spawn(process.execPath, ['src/server/cli/harmoniarrctl.js', 'recovery', ...args], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal: t.signal,
  });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  const closed = new Promise(resolve => { child.once('close', (code, signal) => resolve({ code, signal })); });
  const stdout = []; const stderr = [];
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  const completion = await closed;
  if (spawnError) throw spawnError;
  return { ...completion, json: parsePrivateResult(Buffer.concat(stdout)), stderr: Buffer.concat(stderr).toString() };
}

suite('Recovery CLI delivery against disposable PostgreSQL', () => {
  before(async () => { runtime = await createIntegrationAppRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('actual entrypoint arm/status/conflict/cancel processes close with complete JSON and durable state', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async ({ getPoolFn }) => {
      const arm = await cli(t, ['arm-bootstrap-admin', '--json']);
      assert.equal(arm.code, 0); assert.equal(arm.signal, null); assert.equal(arm.stderr, '');
      assert.equal(arm.json.status, 'armed'); assert.equal(typeof arm.json.recoveryCode, 'string');
      const rows = await getPoolFn().query("SELECT recovery_code_hash FROM admin_recovery_runs WHERE status='armed'");
      assert.equal(rows.rowCount, 1); assert.equal(verifyRecoveryCode(arm.json.recoveryCode, rows.rows[0].recovery_code_hash), true);
      const status = await cli(t, ['bootstrap-admin-status', '--json']);
      assert.equal(status.code, 0); assert.equal(status.json.recoveryAvailable, true);
      assert.equal(Object.hasOwn(status.json, 'recoveryCode'), false);
      const conflict = await cli(t, ['arm-bootstrap-admin', '--json']);
      assert.equal(conflict.code, 3); assert.equal(conflict.json.error.code, 'RECOVERY_ALREADY_ARMED');
      assert.equal(await armedCount(getPoolFn()), 1); assert.equal(await auditCount(getPoolFn()), 1);
      const cancel = await cli(t, ['cancel-bootstrap-admin', '--force', '--json']);
      assert.equal(cancel.code, 0); assert.equal(cancel.json.status, 'cancelled');
      assert.equal(await armedCount(getPoolFn()), 0);
    }, { scenarioName: 'recovery_cli_native_process' });
  });

  test('held native Writable callback follows the arm commit and precedes cleanup; failed cleanup keeps one usable result', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const ready = createFixtureGate({ signal: scope.signal }); let finish;
      let cleanupCalls = 0; const output = []; const codes = []; const diagnostics = [];
      const stream = new Writable({ highWaterMark: 1, write(chunk, _encoding, callback) { output.push(chunk); finish = callback; ready.release(); } });
      scope.onRelease(() => finish?.());
      const pending = scope.track(armCommand({ args: ['--json'],
        recoveryService: createAdminRecoveryService(),
        writeOutput: record => record.textError ? diagnostics.push(record) : writeAndExit({ ...record, stdout: stream, setExitCode: code => codes.push(code) }),
        cleanup: async () => { cleanupCalls++; throw null; },
      }));
      await waitForFixtureReady({ ready: ready.promise, operation: pending, signal: scope.signal });
      assert.equal(await armedCount(context.getPoolFn()), 1); assert.equal(await auditCount(context.getPoolFn()), 1);
      assert.equal(cleanupCalls, 0); assert.deepEqual(codes, []); assert.equal(stream.writableNeedDrain, true);
      finish(); finish = undefined; const result = await pending;
      assert.equal(result.exitCode, 1); assert.equal(result.operationSucceeded, true); assert.equal(result.outputDelivered, true);
      assert.equal(result.failures[0].error, null); assert.equal(cleanupCalls, 1); assert.equal(output.length, 1);
      const delivered = parsePrivateResult(Buffer.concat(output));
      const row = (await context.getPoolFn().query("SELECT recovery_code_hash FROM admin_recovery_runs WHERE status='armed'")).rows[0];
      assert.equal(verifyRecoveryCode(delivered.recoveryCode, row.recovery_code_hash), true);
      assert.equal(JSON.stringify(diagnostics).includes(delivered.recoveryCode), false);
      stream.destroy();
    }), { scenarioName: 'recovery_cli_held_delivery' });
  });

  test('output failure and a simulated lost service acknowledgement keep committed state and require explicit review', { timeout: config.scenarioTimeoutMs }, async () => {
    for (const fault of ['output', 'acknowledgement']) {
      await runtime.runScenario(async ({ getPoolFn }) => {
        const service = createAdminRecoveryService(); let executions = 0; let secret; let cleanupCalls = 0; const records = [];
        const primary = new Error('private failure');
        const outcome = await armCommand({ args: ['--json'],
          recoveryService: { async armBootstrapAdminRecovery() {
            executions++; const result = await service.armBootstrapAdminRecovery(); secret = result.recoveryCode;
            if (fault === 'acknowledgement') throw primary;
            return result;
          } },
          writeOutput: async record => { records.push(record); if (fault === 'output' && record.jsonOutput) throw primary; },
          cleanup: async () => { cleanupCalls++; },
        });
        assert.equal(outcome.exitCode, 1); assert.equal(outcome.failures[0].error, primary);
        assert.equal(executions, 1); assert.equal(cleanupCalls, 1);
        assert.equal(await armedCount(getPoolFn()), 1); assert.equal(await auditCount(getPoolFn()), 1);
        assert.equal(records.filter(record => record.jsonOutput).length, 1);
        const publicFailure = fault === 'output' ? records[1].textError : JSON.parse(records[0].jsonOutput).error.message;
        assert.match(publicFailure, /Do not automatically retry/u); assert.equal(publicFailure.includes(secret), false);
        const current = await service.getBootstrapAdminRecoveryStatus(); assert.equal(Object.hasOwn(current, 'recoveryCode'), false);
        await service.cancelBootstrapAdminRecovery({ force: true });
        assert.equal(await armedCount(getPoolFn()), 0);
      }, { scenarioName: `recovery_cli_committed_${fault}` });
    }
  });
});
