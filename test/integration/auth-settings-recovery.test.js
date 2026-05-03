import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let integrationRuntime;
let runtimeUnavailableReason = null;

function isSkippableIntegrationRuntimeError(error) {
  const message = String(error?.message ?? '');
  return message.includes('Could not find a working container runtime strategy');
}

async function bootstrapAdmin(client, overrides = {}) {
  return client.requestJson('/api/v1/bootstrap/admin', {
    json: {
      password: 'IntegrationPass123!',
      username: 'admin',
      ...overrides,
    },
    method: 'POST',
  });
}

suite('integration auth, settings, and recovery routes', () => {
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

      runtimeUnavailableReason = `${error.message}. Configure external PostgreSQL env vars or start a supported container runtime for integration tests.`;
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await integrationRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('bootstrap, login, refresh, and logout work against a real temporary PostgreSQL database', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn, postgresSource }) => {
      assert.match(postgresSource, /^(external_postgres|testcontainer_postgres)$/);

      const bootstrapStatus = await client.requestJson('/api/v1/bootstrap/status');
      assert.equal(bootstrapStatus.response.status, 200);
      assert.equal(bootstrapStatus.payload.bootstrapRequired, true);

      const bootstrapResponse = await bootstrapAdmin(client);
      assert.equal(bootstrapResponse.response.status, 201);
      assert.equal(bootstrapResponse.payload.ok, true);
      assert.equal(bootstrapResponse.payload.user.username, 'admin');
      assert.equal(client.getCsrfToken(), bootstrapResponse.payload.csrfToken);

      const logoutAfterBootstrap = await client.requestJson('/api/v1/auth/logout', {
        csrf: true,
        method: 'POST',
      });
      assert.equal(logoutAfterBootstrap.response.status, 200);
      assert.equal(logoutAfterBootstrap.payload.ok, true);

      const loginResponse = await client.requestJson('/api/v1/auth/login', {
        json: {
          password: 'IntegrationPass123!',
          username: 'admin',
        },
        method: 'POST',
      });
      assert.equal(loginResponse.response.status, 200);
      assert.equal(loginResponse.payload.user.username, 'admin');
      const loginCsrfToken = loginResponse.payload.csrfToken;

      const refreshResponse = await client.requestJson('/api/v1/auth/refresh', {
        method: 'POST',
      });
      assert.equal(refreshResponse.response.status, 200);
      assert.equal(refreshResponse.payload.user.username, 'admin');
      assert.notEqual(refreshResponse.payload.csrfToken, loginCsrfToken);

      const activeSession = await client.requestJson('/api/v1/auth/session');
      assert.equal(activeSession.response.status, 200);
      assert.equal(activeSession.payload.bootstrapRequired, false);
      assert.equal(activeSession.payload.user.username, 'admin');

      const finalLogout = await client.requestJson('/api/v1/auth/logout', {
        csrf: true,
        method: 'POST',
      });
      assert.equal(finalLogout.response.status, 200);

      const sessionAfterLogout = await client.requestJson('/api/v1/auth/session');
      assert.equal(sessionAfterLogout.response.status, 200);
      assert.equal(sessionAfterLogout.payload.user, null);

      const refreshTokenRows = await getPoolFn().query(`
        SELECT revoked_reason, replaced_by_refresh_token_id IS NOT NULL AS was_rotated
        FROM refresh_tokens
        ORDER BY issued_at ASC
      `);

      assert.equal(refreshTokenRows.rows.length, 3);
      assert.deepEqual(
        refreshTokenRows.rows.map((row) => ({
          revokedReason: row.revoked_reason,
          wasRotated: row.was_rotated,
        })),
        [
          { revokedReason: 'logout', wasRotated: false },
          { revokedReason: 'rotated', wasRotated: true },
          { revokedReason: 'logout', wasRotated: false },
        ],
      );
    }, {
      scenarioName: 'auth_lifecycle',
    });
  });

  test('authenticated settings reads and writes persist through the shared settings service', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      const unauthenticatedRead = await client.requestJson('/api/v1/settings');
      assert.equal(unauthenticatedRead.response.status, 401);
      assert.equal(unauthenticatedRead.payload.error.code, 'auth_required');

      await bootstrapAdmin(client);

      const settingsRead = await client.requestJson('/api/v1/settings');
      assert.equal(settingsRead.response.status, 200);
      assert.equal(settingsRead.payload.ok, true);
      assert.equal(settingsRead.payload.settings.system.logLevel, 'info');

      const settingsUpdate = await client.requestJson('/api/v1/settings', {
        csrf: true,
        json: {
          providers: {
            requestTimeoutMs: 20000,
          },
          system: {
            logLevel: 'debug',
          },
        },
        method: 'PUT',
      });

      assert.equal(settingsUpdate.response.status, 200);
      assert.equal(settingsUpdate.payload.ok, true);
      assert.equal(settingsUpdate.payload.settings.system.logLevel, 'debug');
      assert.equal(settingsUpdate.payload.settings.providers.requestTimeoutMs, 20000);
      assert.deepEqual(
        settingsUpdate.payload.updates.map((update) => `${update.namespace}.${update.settingKey}`),
        ['providers.requestTimeoutMs', 'system.logLevel'],
      );

      const persistedRead = await client.requestJson('/api/v1/settings');
      assert.equal(persistedRead.response.status, 200);
      assert.equal(persistedRead.payload.settings.system.logLevel, 'debug');
      assert.equal(persistedRead.payload.settings.providers.requestTimeoutMs, 20000);

      const persistedRows = await getPoolFn().query(`
        SELECT namespace, setting_key
        FROM app_settings
        ORDER BY namespace ASC, setting_key ASC
      `);

      assert.deepEqual(
        persistedRows.rows.map((row) => `${row.namespace}.${row.setting_key}`),
        ['providers.requestTimeoutMs', 'system.logLevel'],
      );
    }, {
      scenarioName: 'settings_read_write',
    });
  });

  test('maintenance locks replay idempotently and surface through recovery diagnostics', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdmin(client);

      const firstEnter = await client.requestJson('/api/v1/recovery/maintenance-locks', {
        csrf: true,
        headers: {
          'idempotency-key': 'integration-lock-enter-1',
        },
        json: {
          lockType: 'maintenance',
          reason: 'Integration test maintenance window',
        },
        method: 'POST',
      });

      assert.equal(firstEnter.response.status, 202);
      assert.equal(firstEnter.payload.ok, true);
      assert.equal(firstEnter.payload.lock.lockType, 'maintenance');
      assert.equal(firstEnter.payload.lock.status, 'active');
      const lockId = firstEnter.payload.lock.id;

      const replayedEnter = await client.requestJson('/api/v1/recovery/maintenance-locks', {
        csrf: true,
        headers: {
          'idempotency-key': 'integration-lock-enter-1',
        },
        json: {
          lockType: 'maintenance',
          reason: 'Integration test maintenance window',
        },
        method: 'POST',
      });

      assert.equal(replayedEnter.response.status, 202);
      assert.equal(replayedEnter.payload.lock.id, lockId);

      const activeLockRows = await getPoolFn().query(`
        SELECT COUNT(*)::integer AS active_count
        FROM maintenance_locks
        WHERE status = 'active'
      `);
      assert.equal(activeLockRows.rows[0].active_count, 1);

      const maintenanceStatus = await client.requestJson('/api/v1/recovery/maintenance-locks');
      assert.equal(maintenanceStatus.response.status, 200);
      assert.equal(maintenanceStatus.payload.lockCount, 1);
      assert.equal(maintenanceStatus.payload.activeLocks[0].id, lockId);

      const diagnostics = await client.requestJson('/api/v1/system/diagnostics/recovery-state');
      assert.equal(diagnostics.response.status, 200);
      assert.equal(diagnostics.payload.maintenance.lockCount, 1);
      assert.equal(diagnostics.payload.maintenance.activeLocks[0].id, lockId);
      assert.equal(
        diagnostics.payload.recentPrivilegedActions.some((entry) => entry.eventType === 'maintenance_lock_entered'),
        true,
      );

      const releaseResponse = await client.requestJson(`/api/v1/recovery/maintenance-locks/${lockId}/release`, {
        csrf: true,
        headers: {
          'idempotency-key': 'integration-lock-release-1',
        },
        method: 'POST',
      });

      assert.equal(releaseResponse.response.status, 200);
      assert.equal(releaseResponse.payload.ok, true);
      assert.equal(releaseResponse.payload.lock.id, lockId);
      assert.equal(releaseResponse.payload.lock.status, 'released');

      const releasedLockRows = await getPoolFn().query(`
        SELECT COUNT(*)::integer AS released_count
        FROM maintenance_locks
        WHERE status = 'released'
      `);
      assert.equal(releasedLockRows.rows[0].released_count, 1);
    }, {
      scenarioName: 'maintenance_lock_diagnostics',
    });
  });
});
