/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createApiError } from '../../src/server/auth.js';
import { registerSlskdWebhookRoutes } from '../../src/server/routes/slskd-webhook-routes.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

// The webhook route reads the raw request stream, so the app must NOT install a
// global JSON body parser.
function createWebhookApp(ingestWebhookEvent) {
  const app = express();
  registerSlskdWebhookRoutes(app, { ingestWebhookEvent });
  app.use((error, _request, response, _next) => {
    response.status(Number.isInteger(error?.status) ? error.status : 500).json({
      ok: false,
      error: { code: error?.code ?? 'internal_error', message: error?.message ?? 'error' },
    });
  });
  return app;
}

test('slskd webhook route accepts a valid JSON event and returns 202', async (t) => {
  const ingestWebhookEvent = t.mock.fn(async () => ({
    accepted: true,
    actionable: true,
    deduplicated: false,
    eventType: 'download_file_complete',
  }));
  const app = createWebhookApp(ingestWebhookEvent);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/webhooks/slskd`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-harmoniarr-webhook-secret': 'secret',
      },
      body: JSON.stringify({ id: 'evt-1', type: 'DownloadFileComplete' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(payload.ok, true);
    assert.equal(payload.provider, 'slskd');
    assert.equal(payload.eventType, 'download_file_complete');
    assert.equal(ingestWebhookEvent.mock.callCount(), 1);
    assert.equal(ingestWebhookEvent.mock.calls[0].arguments[0].providedSecret, 'secret');
  });
});

test('slskd webhook route reads the secret from an Authorization bearer header', async (t) => {
  const ingestWebhookEvent = t.mock.fn(async () => ({ accepted: true, actionable: true }));
  const app = createWebhookApp(ingestWebhookEvent);

  await withServer(app, async (baseUrl) => {
    await fetch(`${baseUrl}/webhooks/slskd`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer bearer-secret',
      },
      body: JSON.stringify({ id: 'evt-2', type: 'DownloadFileComplete' }),
    });
    assert.equal(ingestWebhookEvent.mock.calls[0].arguments[0].providedSecret, 'bearer-secret');
  });
});

test('slskd webhook route rejects non-JSON content types with 415', async (t) => {
  const ingestWebhookEvent = t.mock.fn(async () => ({ accepted: true }));
  const app = createWebhookApp(ingestWebhookEvent);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/webhooks/slskd`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'id=1',
    });
    assert.equal(response.status, 415);
    assert.equal(ingestWebhookEvent.mock.callCount(), 0);
  });
});

test('slskd webhook route rejects malformed JSON with 400', async (t) => {
  const ingestWebhookEvent = t.mock.fn(async () => ({ accepted: true }));
  const app = createWebhookApp(ingestWebhookEvent);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/webhooks/slskd`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ not json',
    });
    assert.equal(response.status, 400);
    assert.equal(ingestWebhookEvent.mock.callCount(), 0);
  });
});

test('slskd webhook route surfaces unauthorized errors thrown by the service', async (t) => {
  const ingestWebhookEvent = t.mock.fn(async () => {
    throw createApiError(401, 'slskd_webhook_unauthorized', 'Invalid slskd webhook credentials');
  });
  const app = createWebhookApp(ingestWebhookEvent);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/webhooks/slskd`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'evt-3', type: 'DownloadFileComplete' }),
    });
    const payload = await response.json();
    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'slskd_webhook_unauthorized');
  });
});
