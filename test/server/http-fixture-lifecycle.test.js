/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { withServer } from '../../testing/server/http-test-helpers.js';

function failingCloseApp(error) {
  const server = { address: () => ({ port: 1 }), close: (done) => { queueMicrotask(() => done(error)); } };
  return { listen: (_port, _host, ready) => { queueMicrotask(ready); return server; } };
}

test('HTTP fixture teardown preserves the original scenario error when close also fails', async () => {
  const primary = new Error('Controlled scenario failure'); const secondary = new Error('Controlled close failure');
  await assert.rejects(withServer(failingCloseApp(secondary), async () => { throw primary; }), (error) => error === primary);
});

test('HTTP fixture teardown still reports close failure when the scenario passed', async () => {
  const secondary = new Error('Controlled close failure');
  await assert.rejects(withServer(failingCloseApp(secondary), async () => 'passed'), (error) => error === secondary);
});

test('HTTP fixture closes its own active connection after the callback finishes', async (t) => {
  let received; const ready = new Promise((resolve) => { received = resolve; });
  const server = createServer(() => { received(); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  let request;
  const result = await withServer(server, async (url) => {
    request = fetch(url).catch((error) => error);
    await ready;
    return 'scenario complete';
  }, { closeTimeoutMs: 200 });
  assert.equal(result, 'scenario complete');
  assert.ok(await request instanceof Error);
});
