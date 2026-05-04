import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import {
  runArmBootstrapAdminRecoveryCli,
  runBootstrapAdminStatusCli,
  runCancelBootstrapAdminRecoveryCli,
} from '../../testing/integration/admin-recovery-helpers.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

suite('integration admin recovery cli', () => {
  before(async () => {
    try {
      integrationRuntime = await createIntegrationAppRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('harmoniarrctl recovery commands manage active recovery state against the real database', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      const initialStatus = await runBootstrapAdminStatusCli(['--json']);
      assert.equal(initialStatus.exitCode, 0);
      assert.deepEqual(initialStatus.parsedJson, {
        command: 'bootstrap-admin-status',
        recoveryAvailable: false,
        success: true,
        warnings: [],
      });

      const armedResult = await runArmBootstrapAdminRecoveryCli([
        '--json',
        '--reason', 'integration runbook validation',
        '--ttl-minutes', '10',
      ]);
      assert.equal(armedResult.exitCode, 0);
      assert.equal(armedResult.parsedJson.success, true);
      assert.equal(armedResult.parsedJson.command, 'arm-bootstrap-admin');
      assert.equal(armedResult.parsedJson.status, 'armed');
      assert.equal(armedResult.parsedJson.recoveryPath, '/recover/bootstrap-admin');
      assert.equal(armedResult.parsedJson.replacedExistingRun, false);
      assert.match(armedResult.parsedJson.recoveryCode, /^HARM-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

      const activeRunRows = await getPoolFn().query(
        `
          SELECT armed_via, reason, status
          FROM admin_recovery_runs
          WHERE status = 'armed'
        `,
      );
      assert.equal(activeRunRows.rows.length, 1);
      assert.equal(activeRunRows.rows[0].armed_via, 'harmoniarrctl');
      assert.equal(activeRunRows.rows[0].reason, 'integration runbook validation');

      const statusAfterArm = await runBootstrapAdminStatusCli(['--json']);
      assert.equal(statusAfterArm.exitCode, 0);
      assert.equal(statusAfterArm.parsedJson.success, true);
      assert.equal(statusAfterArm.parsedJson.command, 'bootstrap-admin-status');
      assert.equal(statusAfterArm.parsedJson.recoveryAvailable, true);
      assert.equal(statusAfterArm.parsedJson.armedVia, 'harmoniarrctl');
      assert.equal(statusAfterArm.parsedJson.remainingAttempts, 5);
      assert.equal(statusAfterArm.parsedJson.blockedByLock, false);
      assert.equal(Object.hasOwn(statusAfterArm.parsedJson, 'recoveryCode'), false);

      const cancelWithoutForce = await runCancelBootstrapAdminRecoveryCli(['--json']);
      assert.equal(cancelWithoutForce.exitCode, 2);
      assert.equal(cancelWithoutForce.parsedJson.success, false);
      assert.equal(cancelWithoutForce.parsedJson.command, 'cancel-bootstrap-admin');
      assert.equal(cancelWithoutForce.parsedJson.error.code, 'RECOVERY_FORCE_REQUIRED');

      const replacedArm = await runArmBootstrapAdminRecoveryCli([
        '--json',
        '--force',
        '--reason', 'integration replacement validation',
      ]);
      assert.equal(replacedArm.exitCode, 0);
      assert.equal(replacedArm.parsedJson.success, true);
      assert.equal(replacedArm.parsedJson.replacedExistingRun, true);

      const cancellationAuditRows = await getPoolFn().query(
        `
          SELECT event_type
          FROM audit_events
          WHERE event_type = 'bootstrap_admin_recovery_cancelled'
        `,
      );
      assert.equal(cancellationAuditRows.rows.length, 1);

      const cancelWithForce = await runCancelBootstrapAdminRecoveryCli([
        '--json',
        '--force',
        '--reason', 'integration stale run cancel',
      ]);
      assert.equal(cancelWithForce.exitCode, 0);
      assert.equal(cancelWithForce.parsedJson.success, true);
      assert.equal(cancelWithForce.parsedJson.command, 'cancel-bootstrap-admin');
      assert.equal(cancelWithForce.parsedJson.status, 'cancelled');

      const finalStatus = await runBootstrapAdminStatusCli(['--json']);
      assert.equal(finalStatus.exitCode, 0);
      assert.deepEqual(finalStatus.parsedJson, {
        command: 'bootstrap-admin-status',
        recoveryAvailable: false,
        success: true,
        warnings: [],
      });
    }, {
      scenarioName: 'admin_recovery_cli_runbook',
    });
  });
});
