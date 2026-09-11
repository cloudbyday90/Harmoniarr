/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerProviderCollectionAccessRoutes } from '../../src/server/routes/provider-collection-access-routes.js';
import { skipRateLimitMiddleware } from '../../src/server/request-rate-limiter.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

test('provider diagnostic route reconstructs safe service failures without exposing upstream fields', async () => {
  for (const [error, status, code] of [
    [createApiError(409, 'provider_diagnostic_busy', 'credential-marker'), 409, 'provider_diagnostic_busy'],
    [createApiError(400, 'validation_error', 'credential-marker'), 400, 'validation_error'],
    [Object.assign(new Error('credential-marker'), { details: { token: 'credential-marker' } }), 500, 'provider_check_failed'],
  ]) {
    const app = createJsonTestApp((testApp) => registerProviderCollectionAccessRoutes(testApp, {
      checkProviderCollectionAccess: async () => { throw error; },
      limitProviderAccessCheck: skipRateLimitMiddleware,
      requireFreshAdminSession: async () => ({ user: { role: 'admin' } }), requireCsrf: () => {},
    }));
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/providers/collection-access-check`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceUrl: 'fixture' }),
      });
      const payload = await response.json();
      assert.equal(response.status, status);
      assert.equal(payload.error.code, code);
      assert.equal(JSON.stringify(payload).includes('credential-marker'), false);
    });
  }
});
