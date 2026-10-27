/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerSchemaDiagnosticsRoutes } from '../../src/server/routes/schema-diagnostics-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

const path = '/api/v1/system/diagnostics/schema-state';
test('schema diagnostics refuse unauthenticated/non-admin requests before scan or limiter and never cache the refusal', async () => {
  for (const status of [401, 403]) {
    const app = createJsonTestApp(expressApp => registerSchemaDiagnosticsRoutes(expressApp, {
      requireAdminSession: async () => { throw createApiError(status, 'denied', 'Access denied'); },
      getSchemaDiagnostics: async () => assert.fail('scan ran'), limitSchemaDiagnostics: () => assert.fail('limit ran'),
    }));
    await withServer(app, async base => {
      const response = await fetch(base + path); assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store');
    });
  }
});

test('schema diagnostic GET rechecks authorization after the scan and suppresses results after revocation', async () => {
  let checks = 0, scans = 0;
  const app = createJsonTestApp(expressApp => registerSchemaDiagnosticsRoutes(expressApp, {
    requireAdminSession: async () => { if (++checks === 2) throw createApiError(403, 'admin_required', 'Administrator access is required'); },
    getSchemaDiagnostics: async () => { scans++; return { state: 'current', privateResult: 'must not be returned' }; },
    limitSchemaDiagnostics: (_request, _response, next) => next(),
  }));
  await withServer(app, async base => {
    const response = await fetch(base + path); assert.equal(response.status, 403); assert.equal(scans, 1);
    assert.doesNotMatch(await response.text(), /current|privateResult|must not/u); assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('schema diagnostic GET returns explicit no-store summary, no query-controlled scan options and bounded internal failures', async () => {
  let fail = false, scans = 0, checks = 0;
  const app = createJsonTestApp(expressApp => registerSchemaDiagnosticsRoutes(expressApp, {
    requireAdminSession: async () => { checks++; },
    getSchemaDiagnostics: async options => { scans++; assert.deepEqual(Object.keys(options), ['signal']); assert.ok(options.signal instanceof AbortSignal); if (fail) throw new Error('private SQL'); return { state: 'current' }; },
    limitSchemaDiagnostics: (_request, _response, next) => next(),
  }));
  await withServer(app, async base => {
    let response = await fetch(base + path + '?repair=true&limit=99999');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: true, schemaDiagnostics: { state: 'current' } });
    fail = true; response = await fetch(base + path); assert.equal(response.status, 200);
    const body = await response.text(); assert.match(body, /unavailable/u); assert.doesNotMatch(body, /private|SQL/u);
    assert.equal(checks, 4); assert.equal(scans, 2);
  });
});

test('disconnecting a held HTTP response cancels its scan and suppresses publication', async () => {
  const started = Promise.withResolvers(), cancelled = Promise.withResolvers(), release = Promise.withResolvers(); let checks = 0;
  const app = createJsonTestApp(expressApp => registerSchemaDiagnosticsRoutes(expressApp, {
    requireAdminSession: async () => { checks++; }, limitSchemaDiagnostics: (_request, _response, next) => next(),
    getSchemaDiagnostics: async ({ signal }) => {
      signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); started.resolve();
      await release.promise; return { state: 'current' };
    },
  }));
  await withServer(app, async base => {
    const controller = new AbortController(), response = fetch(base + path, { signal: controller.signal });
    const rejected = assert.rejects(response, { name: 'AbortError' });
    try { await started.promise; controller.abort(); await rejected; await cancelled.promise; assert.equal(checks, 1); }
    finally { release.resolve(); }
  });
});
