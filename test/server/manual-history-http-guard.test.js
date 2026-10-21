/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createManualHistoryHttpGuard } from '../../testing/manual/metadata-history-http-guard.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

async function request(baseUrl, path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(new URL(path, baseUrl), { method, headers }, response => {
      response.resume(); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers }));
      response.on('error', reject);
    });
    outgoing.on('error', reject); outgoing.end();
  });
}

test('manual HTTP guard refuses unknown commands, provider GETs and foreign origins before dispatch', async () => {
  const guard = createManualHistoryHttpGuard({ artistId: 'artist', onboarding: { synthetic: 'onboarding' }, overview: { synthetic: 'overview' } });
  const app = express(); const dispatched = [];
  app.use(guard.middleware); app.use((req, res) => { dispatched.push([req.method, req.path]); res.sendStatus(204); });
  await withServer(app, async baseUrl => {
    assert.equal((await request(baseUrl, '/api/v1/auth/session')).status, 403);
    guard.bind(baseUrl);
    for (const options of [
      { path: '/api/v1/metadata/artists/artist/refresh', method: 'POST' },
      { path: '/api/v1/metadata/artists/search?q=test' },
      { path: '/api/v1/metadata/artists/another' },
      { path: '/api/v1/auth/plex/callback' },
      { path: '/fixture/release', method: 'POST' },
      { path: '/api/v1/auth/session', headers: { Host: 'attacker.invalid' } },
      { path: '/api/v1/bootstrap/admin', method: 'POST', headers: { Origin: 'https://attacker.invalid' } },
      { path: '/api/v1/auth/session', headers: { 'Sec-Fetch-Site': 'cross-site' } },
      { path: '/api/v1/auth/session', headers: { 'Sec-Fetch-Site': 'same-site' } },
      { path: '/api/v1/auth/session', method: 'HEAD' },
    ]) {
      const response = await request(baseUrl, options.path, options);
      assert.equal(response.status, 403, options.path); assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.deepEqual(dispatched, []);
    for (const path of ['/api/v1/auth/session', '/api/v1/metadata/artists/artist/detection-events?before=initial-cursor', '/bootstrap', '/app/settings/library-browser', '/assets/fixture.js']) {
      assert.equal((await request(baseUrl, path, { headers: { Origin: baseUrl, 'Sec-Fetch-Site': 'same-origin' } })).status, 204);
    }
    assert.equal((await request(baseUrl, '/api/v1/auth/login', { method: 'POST', headers: { Origin: baseUrl } })).status, 204);
    assert.equal(dispatched.length, 6);
    for (const path of ['/api/v1/system/onboarding', '/api/v1/system/overview']) assert.equal((await request(baseUrl, path)).status, 200);
    assert.equal(dispatched.length, 6);
  });
});

test('manual guard binds only once to an exact loopback HTTP origin', () => {
  for (const url of ['https://127.0.0.1:4000', 'http://localhost:4000', 'http://0.0.0.0:4000', 'http://user@127.0.0.1:4000', 'http://127.0.0.1:4000/app', 'http://127.0.0.1:4000/?test=1']) {
    const guard = createManualHistoryHttpGuard({ artistId: 'artist' }); assert.throws(() => guard.bind(url), TypeError);
  }
  const guard = createManualHistoryHttpGuard({ artistId: 'artist' }); guard.bind('http://127.0.0.1:4000');
  assert.throws(() => guard.bind('http://127.0.0.1:4001'), TypeError);
});
