import assert from 'node:assert/strict';
import test from 'node:test';
import { registerSystemRoutes } from '../../src/server/routes/system-routes.js';
import { createSettingsService } from '../../src/server/settings-service.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

test('system settings update route returns a shared validation error for malformed settings patches', async () => {
  const settingsService = createSettingsService();
  const app = createJsonTestApp((expressApp) => {
    registerSystemRoutes(expressApp, {
      appPort: 4312,
      buildSettingsPayload: async () => ({ settings: {} }),
      getOverview: async () => ({
        service: { name: 'harmoniarr', version: '0.1.0-beta', startedAt: '2026-04-28T12:00:00.000Z' },
        database: { name: 'postgresql', pendingMigrations: 0 },
      }),
      requireAdminSession: async () => ({ appUserId: 'user-55', csrfToken: 'csrf-55', user: { role: 'admin' } }),
      requireFreshAdminSession: async () => ({ appUserId: 'user-55', csrfToken: 'csrf-55', user: { role: 'admin' } }),
      requireCsrf: () => {},
      getRequestMetadata: () => ({ ipAddress: '127.0.0.1', userAgent: 'HarmoniarrValidationTest/1.0' }),
      updateSettings: settingsService.updateSettings,
    });
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/settings`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-55',
      },
      body: JSON.stringify({ invalidNamespace: { any: 'value' } }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'validation_error',
        message: 'Unknown settings namespace: invalidNamespace',
      },
    });
  });
});