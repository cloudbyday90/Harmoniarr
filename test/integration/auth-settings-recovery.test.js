import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { operationRunRegistry } from '../../src/shared/operation-run-descriptors.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import {
  createBackupExport,
  enterMaintenanceLock,
  getBackupExportById,
  getBackupRestorePreview,
  listBackupExports,
  releaseMaintenanceLock,
  startBackupRestoreApply,
} from '../../testing/integration/recovery-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import {
  isSkippableIntegrationRuntimeError,
  toIntegrationRuntimeUnavailableReason,
} from '../../testing/integration/runtime-availability.js';

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

      const bootstrapResponse = await bootstrapAdminSession(client);
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

      await bootstrapAdminSession(client);

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

  test('admin-issued claim codes complete through the public auth route and require a fresh login afterward', {
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

      const createUserResponse = await client.requestJson('/api/v1/users', {
        csrf: true,
        json: {
          password: 'TempClaimPass123!',
          role: 'requester',
          username: 'claimuser',
        },
        method: 'POST',
      });
      assert.equal(createUserResponse.response.status, 201);
      const claimUserId = createUserResponse.payload.user.id;

      const claimCodeResponse = await client.requestJson(`/api/v1/users/${claimUserId}/claim-code`, {
        csrf: true,
        json: {
          ttlMinutes: 30,
        },
        method: 'POST',
      });
      assert.equal(claimCodeResponse.response.status, 201);
      assert.equal(claimCodeResponse.payload.ok, true);
      assert.equal(claimCodeResponse.payload.user.username, 'claimuser');
      assert.match(claimCodeResponse.payload.claimCode, /^HCLM-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

      const claimCompleteResponse = await publicClient.requestJson('/api/v1/auth/claim', {
        csrf: false,
        json: {
          claimCode: claimCodeResponse.payload.claimCode,
          password: 'ClaimedPass123!',
          username: 'claimuser',
        },
        method: 'POST',
      });
      assert.equal(claimCompleteResponse.response.status, 201);
      assert.equal(claimCompleteResponse.payload.ok, true);
      assert.equal(claimCompleteResponse.payload.requiresLogin, true);
      assert.equal(claimCompleteResponse.payload.username, 'claimuser');
      assert.deepEqual(getSetCookieHeaders(claimCompleteResponse.response), []);
      assert.equal(publicClient.getCookieHeader(), '');

      const publicSessionAfterClaim = await publicClient.requestJson('/api/v1/auth/session');
      assert.equal(publicSessionAfterClaim.response.status, 200);
      assert.equal(publicSessionAfterClaim.payload.user, null);

      const oldPasswordLoginResponse = await publicClient.requestJson('/api/v1/auth/login', {
        json: {
          password: 'TempClaimPass123!',
          username: 'claimuser',
        },
        method: 'POST',
      });
      assert.equal(oldPasswordLoginResponse.response.status, 401);
      assert.equal(oldPasswordLoginResponse.payload.error.code, 'invalid_credentials');

      const claimedLoginResponse = await publicClient.requestJson('/api/v1/auth/login', {
        json: {
          password: 'ClaimedPass123!',
          username: 'claimuser',
        },
        method: 'POST',
      });
      assert.equal(claimedLoginResponse.response.status, 200);
      assert.equal(claimedLoginResponse.payload.user.username, 'claimuser');
      assert.equal(claimedLoginResponse.payload.user.mustChangePassword, false);

      const claimedSessionResponse = await publicClient.requestJson('/api/v1/auth/session');
      assert.equal(claimedSessionResponse.response.status, 200);
      assert.equal(claimedSessionResponse.payload.user.username, 'claimuser');
      assert.equal(claimedSessionResponse.payload.user.mustChangePassword, false);

      const claimedUserRows = await getPoolFn().query(
        `
          SELECT must_change_password, password_changed_at
          FROM app_users
          WHERE id = $1
        `,
        [claimUserId],
      );
      assert.equal(claimedUserRows.rows[0]?.must_change_password, false);
      assert.ok(claimedUserRows.rows[0]?.password_changed_at);

      const claimRows = await getPoolFn().query(
        `
          SELECT consumed_at, revoked_at
          FROM app_user_claim_codes
          WHERE app_user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [claimUserId],
      );
      assert.ok(claimRows.rows[0]?.consumed_at);
      assert.equal(claimRows.rows[0]?.revoked_at, null);

      const auditRows = await getPoolFn().query(
        `
          SELECT event_type
          FROM audit_events
          WHERE entity_id = $1
            AND event_type IN ('app_user_claim_code_issued', 'app_user_claim_completed')
          ORDER BY occurred_at ASC, created_at ASC
        `,
        [claimUserId],
      );
      assert.deepEqual(
        auditRows.rows.map((row) => row.event_type),
        ['app_user_claim_code_issued', 'app_user_claim_completed'],
      );
    }, {
      scenarioName: 'auth_claim_lifecycle',
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
      await bootstrapAdminSession(client);

      const firstEnter = await enterMaintenanceLock(client, {
        idempotencyKey: 'integration-lock-enter-1',
      });

      assert.equal(firstEnter.response.status, 202);
      assert.equal(firstEnter.payload.ok, true);
      assert.equal(firstEnter.payload.lock.lockType, 'maintenance');
      assert.equal(firstEnter.payload.lock.status, 'active');
      const lockId = firstEnter.payload.lock.id;

      const replayedEnter = await enterMaintenanceLock(client, {
        idempotencyKey: 'integration-lock-enter-1',
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

      const releaseResponse = await releaseMaintenanceLock(client, lockId, {
        idempotencyKey: 'integration-lock-release-1',
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

  test('backup export, restore preview, and restore apply honor maintenance-lock readiness through the real recovery routes', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await integrationRuntime.runScenario(async ({ client, getPoolFn }) => {
      await bootstrapAdminSession(client);

      const backedUpSettings = {
        providers: {
          requestTimeoutMs: 21000,
        },
        system: {
          logLevel: 'debug',
        },
      };
      const mutatedSettings = {
        providers: {
          requestTimeoutMs: 12000,
        },
        system: {
          logLevel: 'warn',
        },
      };

      const seedSettingsResponse = await client.requestJson('/api/v1/settings', {
        csrf: true,
        json: backedUpSettings,
        method: 'PUT',
      });
      assert.equal(seedSettingsResponse.response.status, 200);
      assert.equal(seedSettingsResponse.payload.settings.system.logLevel, 'debug');
      assert.equal(seedSettingsResponse.payload.settings.providers.requestTimeoutMs, 21000);

      const backupCreateResponse = await createBackupExport(client, {
        idempotencyKey: 'integration-backup-export-create-1',
      });
      assert.equal(backupCreateResponse.response.status, 202);
      assert.equal(backupCreateResponse.payload.ok, true);
      assert.equal(backupCreateResponse.payload.accepted, true);

      const backupArtifactId = backupCreateResponse.payload.backupArtifact.id;
      const expectedPayloadSha256 = backupCreateResponse.payload.backupArtifact.payloadSha256;

      assert.ok(backupArtifactId);
      assert.ok(expectedPayloadSha256);

      const backupListResponse = await listBackupExports(client, { limit: 5 });
      assert.equal(backupListResponse.response.status, 200);
      assert.equal(backupListResponse.payload.ok, true);
      assert.equal(backupListResponse.payload.backupArtifacts.length, 1);
      assert.equal(backupListResponse.payload.backupArtifacts[0].id, backupArtifactId);

      const backupDetailResponse = await getBackupExportById(client, backupArtifactId);
      assert.equal(backupDetailResponse.response.status, 200);
      assert.equal(backupDetailResponse.payload.ok, true);
      assert.equal(backupDetailResponse.payload.backupArtifact.id, backupArtifactId);
      assert.equal(backupDetailResponse.payload.backupArtifact.payloadSha256, expectedPayloadSha256);

      const mutateSettingsResponse = await client.requestJson('/api/v1/settings', {
        csrf: true,
        json: mutatedSettings,
        method: 'PUT',
      });
      assert.equal(mutateSettingsResponse.response.status, 200);
      assert.equal(mutateSettingsResponse.payload.settings.system.logLevel, 'warn');
      assert.equal(mutateSettingsResponse.payload.settings.providers.requestTimeoutMs, 12000);

      const initialPreviewResponse = await getBackupRestorePreview(client, backupArtifactId);
      assert.equal(initialPreviewResponse.response.status, 200);
      assert.equal(initialPreviewResponse.payload.ok, true);
      assert.equal(initialPreviewResponse.payload.backupArtifact.id, backupArtifactId);
      assert.equal(initialPreviewResponse.payload.canApplyRestore, true);
      assert.equal(initialPreviewResponse.payload.restoreReadiness.blockedByLock, false);
      assert.equal(initialPreviewResponse.payload.integrity.expectedPayloadSha256, expectedPayloadSha256);
      assert.equal(initialPreviewResponse.payload.integrity.actualPayloadSha256, expectedPayloadSha256);
      assert.equal(initialPreviewResponse.payload.compatibility.compatible, true);

      const lockResponse = await enterMaintenanceLock(client, {
        idempotencyKey: 'integration-backup-restore-lock-1',
        reason: 'Block restore apply during integration preview',
      });
      assert.equal(lockResponse.response.status, 202);
      const lockId = lockResponse.payload.lock.id;

      const blockedPreviewResponse = await getBackupRestorePreview(client, backupArtifactId);
      assert.equal(blockedPreviewResponse.response.status, 200);
      assert.equal(blockedPreviewResponse.payload.canApplyRestore, false);
      assert.equal(blockedPreviewResponse.payload.restoreReadiness.blockedByLock, true);
      assert.equal(blockedPreviewResponse.payload.restoreReadiness.blockingLocks.length, 1);
      assert.equal(blockedPreviewResponse.payload.restoreReadiness.blockingLocks[0].id, lockId);

      const blockedApplyResponse = await startBackupRestoreApply(client, backupArtifactId, {
        expectedPayloadSha256,
        idempotencyKey: 'integration-backup-restore-apply-blocked',
      });
      assert.equal(blockedApplyResponse.response.status, 409);
      assert.equal(blockedApplyResponse.payload.error.code, 'recovery_lock_conflict');

      const lockReleaseResponse = await releaseMaintenanceLock(client, lockId, {
        idempotencyKey: 'integration-backup-restore-lock-release-1',
      });
      assert.equal(lockReleaseResponse.response.status, 200);

      const restoreApplyResponse = await startBackupRestoreApply(client, backupArtifactId, {
        expectedPayloadSha256,
        idempotencyKey: 'integration-backup-restore-apply-success',
      });
      assert.equal(restoreApplyResponse.response.status, 202);
      assert.equal(restoreApplyResponse.payload.ok, true);
      assert.equal(restoreApplyResponse.payload.accepted, true);
      assert.equal(restoreApplyResponse.payload.backupArtifact.id, backupArtifactId);
      assert.equal(restoreApplyResponse.payload.restoreResult.settingsUpdated, true);
      assert.equal(restoreApplyResponse.payload.run.operationType, operationRunRegistry.backupRestoreApply.operationType);
      assert.equal(restoreApplyResponse.payload.run.status, 'completed');
      assert.equal(restoreApplyResponse.payload.run.summary.settingsUpdated, true);
      assert.equal(restoreApplyResponse.payload.run.summary.currentStep, 'Restore apply completed');
      assert.equal(
        restoreApplyResponse.payload.restoreResult.appliedScopes.includes('settings'),
        true,
      );

      const restoredSettingsResponse = await client.requestJson('/api/v1/settings');
      assert.equal(restoredSettingsResponse.response.status, 200);
      assert.equal(restoredSettingsResponse.payload.settings.system.logLevel, 'debug');
      assert.equal(restoredSettingsResponse.payload.settings.providers.requestTimeoutMs, 21000);

      const persistedRows = await getPoolFn().query(
        `
          SELECT operation_type, status
          FROM operation_runs
          WHERE operation_type = $1
        `,
        [operationRunRegistry.backupRestoreApply.operationType],
      );
      assert.equal(persistedRows.rows.length, 1);
      assert.equal(persistedRows.rows[0].status, 'completed');

      const activeRestoreLocks = await getPoolFn().query(
        `
          SELECT COUNT(*)::integer AS active_count
          FROM maintenance_locks
          WHERE status = 'active'
        `,
      );
      assert.equal(activeRestoreLocks.rows[0].active_count, 0);

      const auditEvents = await getPoolFn().query(
        `
          SELECT event_type
          FROM audit_events
          WHERE event_type IN ('backup_export_created', 'backup_restore_completed')
          ORDER BY created_at ASC
        `,
      );
      assert.deepEqual(
        auditEvents.rows.map((row) => row.event_type),
        ['backup_export_created', 'backup_restore_completed'],
      );
    }, {
      scenarioName: 'recovery_backup_restore_apply',
    });
  });
});
