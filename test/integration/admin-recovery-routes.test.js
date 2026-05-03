import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { armBootstrapAdminRecovery } from '../../testing/integration/admin-recovery-helpers.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { enterMaintenanceLock } from '../../testing/integration/recovery-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const setCookie = response.headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

suite('integration admin recovery routes', () => {
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

  test('public recovery status and completion routes work end to end and revoke prior sessions without issuing a new cookie', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const publicClient = createSessionHttpClient(baseUrl, {
        requestTimeoutMs: integrationRuntimeConfig.httpRequestTimeoutMs,
      });

      const armed = await armBootstrapAdminRecovery({
        reason: 'integration lifecycle test',
      });

      const statusResponse = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/status');
      assert.equal(statusResponse.response.status, 200);
      assert.equal(statusResponse.payload.recoveryAvailable, true);
      assert.equal(statusResponse.payload.runId, armed.runId);
      assert.equal(statusResponse.payload.remainingAttempts, 5);
      assert.equal(statusResponse.payload.blockedByLock, false);
      assert.equal(JSON.stringify(statusResponse.payload).includes('recoveryCodeHash'), false);

      const completeResponse = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/complete', {
        csrf: false,
        json: {
          confirmPassword: 'RecoveredPass123!',
          password: 'RecoveredPass123!',
          recoveryCode: armed.recoveryCode,
          username: 'recoveredadmin',
        },
        method: 'POST',
      });
      assert.equal(completeResponse.response.status, 200);
      assert.equal(completeResponse.payload.success, true);
      assert.equal(completeResponse.payload.requiresLogin, true);
      assert.equal(completeResponse.payload.runId, armed.runId);
      assert.equal(completeResponse.payload.recoveryChecklist.length, 3);
      assert.deepEqual(getSetCookieHeaders(completeResponse.response), []);
      assert.equal(publicClient.getCookieHeader(), '');

      const statusAfterCompletion = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/status');
      assert.equal(statusAfterCompletion.response.status, 200);
      assert.deepEqual(statusAfterCompletion.payload, {
        recoveryAvailable: false,
      });

      const sessionAfterCompletion = await client.requestJson('/api/v1/auth/session');
      assert.equal(sessionAfterCompletion.response.status, 200);
      assert.equal(sessionAfterCompletion.payload.user, null);

      const recoveryRunRows = await getPoolFn().query(
        `
          SELECT status, created_admin_user_id, completed_from_ip, completed_user_agent
          FROM admin_recovery_runs
          WHERE id = $1
        `,
        [armed.runId],
      );
      assert.equal(recoveryRunRows.rows[0]?.status, 'completed');
      assert.ok(recoveryRunRows.rows[0]?.created_admin_user_id);
      assert.equal(recoveryRunRows.rows[0]?.completed_from_ip, '127.0.0.1');
      assert.match(String(recoveryRunRows.rows[0]?.completed_user_agent ?? ''), /node/i);

      const revokedTokenRows = await getPoolFn().query(
        `
          SELECT COUNT(*)::integer AS revoked_count
          FROM refresh_tokens
          WHERE revoked_reason = 'admin_recovery'
        `,
      );
      assert.equal(revokedTokenRows.rows[0]?.revoked_count, 1);

      const recoveredUserRows = await getPoolFn().query(
        `
          SELECT username, role, is_disabled
          FROM app_users
          WHERE username = $1
        `,
        ['recoveredadmin'],
      );
      assert.equal(recoveredUserRows.rows[0]?.username, 'recoveredadmin');
      assert.equal(recoveredUserRows.rows[0]?.role, 'admin');
      assert.equal(recoveredUserRows.rows[0]?.is_disabled, false);

      const auditRows = await getPoolFn().query(
        `
          SELECT event_type
          FROM audit_events
          WHERE entity_id = $1
          ORDER BY occurred_at ASC, created_at ASC
        `,
        [armed.runId],
      );
      assert.deepEqual(
        auditRows.rows.map((row) => row.event_type),
        [
          'bootstrap_admin_recovery_armed',
          'bootstrap_admin_recovery_completed',
          'sessions_revoked_after_recovery',
        ],
      );
    }, {
      scenarioName: 'admin_recovery_public_lifecycle',
    });
  });

  test('public recovery completion reports lock conflicts without consuming invalid attempts', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ baseUrl, client, getPoolFn }) => {
      await bootstrapAdminSession(client);
      const publicClient = createSessionHttpClient(baseUrl, {
        requestTimeoutMs: integrationRuntimeConfig.httpRequestTimeoutMs,
      });

      const armed = await armBootstrapAdminRecovery({
        reason: 'integration lock conflict test',
      });

      const lockResponse = await enterMaintenanceLock(client, {
        idempotencyKey: 'admin-recovery-restore-lock-1',
        lockType: 'restore',
        reason: 'Simulated restore in progress',
      });
      assert.equal(lockResponse.response.status, 202);

      const statusResponse = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/status');
      assert.equal(statusResponse.response.status, 200);
      assert.equal(statusResponse.payload.recoveryAvailable, true);
      assert.equal(statusResponse.payload.blockedByLock, true);

      const completeResponse = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/complete', {
        csrf: false,
        json: {
          confirmPassword: 'RecoveredPass123!',
          password: 'RecoveredPass123!',
          recoveryCode: armed.recoveryCode,
          username: 'blockedadmin',
        },
        method: 'POST',
      });
      assert.equal(completeResponse.response.status, 409);
      assert.equal(completeResponse.payload.error.code, 'RECOVERY_LOCK_CONFLICT');

      const persistedRunRows = await getPoolFn().query(
        `
          SELECT status, invalid_attempt_count
          FROM admin_recovery_runs
          WHERE id = $1
        `,
        [armed.runId],
      );
      assert.equal(persistedRunRows.rows[0]?.status, 'armed');
      assert.equal(persistedRunRows.rows[0]?.invalid_attempt_count, 0);
    }, {
      scenarioName: 'admin_recovery_lock_conflict',
    });
  });

  test('public recovery completion invalidates the run after the configured invalid-attempt threshold', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ baseUrl, getPoolFn }) => {
      const publicClient = createSessionHttpClient(baseUrl, {
        requestTimeoutMs: integrationRuntimeConfig.httpRequestTimeoutMs,
      });
      const armed = await armBootstrapAdminRecovery({
        reason: 'integration invalidation test',
      });

      for (let attemptIndex = 1; attemptIndex <= 5; attemptIndex++) {
        const completeResponse = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/complete', {
          csrf: false,
          json: {
            confirmPassword: 'RecoveredPass123!',
            password: 'RecoveredPass123!',
            recoveryCode: 'HARM-WRONG-CODE-1234',
            username: 'recoveredadmin',
          },
          method: 'POST',
        });

        if (attemptIndex < 5) {
          assert.equal(completeResponse.response.status, 401);
          assert.equal(completeResponse.payload.error.code, 'RECOVERY_CODE_INVALID_OR_EXPIRED');
        } else {
          assert.equal(completeResponse.response.status, 429);
          assert.equal(completeResponse.payload.error.code, 'RECOVERY_ATTEMPT_THRESHOLD_REACHED');
        }
      }

      const statusAfterInvalidation = await publicClient.requestJson('/api/v1/recovery/bootstrap-admin/status');
      assert.equal(statusAfterInvalidation.response.status, 200);
      assert.deepEqual(statusAfterInvalidation.payload, {
        recoveryAvailable: false,
      });

      const persistedRunRows = await getPoolFn().query(
        `
          SELECT status, invalid_attempt_count
          FROM admin_recovery_runs
          WHERE id = $1
        `,
        [armed.runId],
      );
      assert.equal(persistedRunRows.rows[0]?.status, 'invalidated');
      assert.equal(persistedRunRows.rows[0]?.invalid_attempt_count, 5);

      const auditRows = await getPoolFn().query(
        `
          SELECT event_type
          FROM audit_events
          WHERE entity_id = $1
          ORDER BY occurred_at ASC, created_at ASC
        `,
        [armed.runId],
      );
      assert.deepEqual(
        auditRows.rows.map((row) => row.event_type),
        [
          'bootstrap_admin_recovery_armed',
          'bootstrap_admin_recovery_invalidated',
        ],
      );
    }, {
      scenarioName: 'admin_recovery_attempt_invalidation',
    });
  });
});
