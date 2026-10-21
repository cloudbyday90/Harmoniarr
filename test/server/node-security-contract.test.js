/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { brotliCompressSync } from 'node:zlib';
import test from 'node:test';

test('runtime rejects a NUL-containing DNS name before dispatch to an owned loopback resolver', { timeout: 5000 }, async t => {
  const server = createSocket('udp4');
  let received = 0;
  server.on('message', () => { received++; });
  server.bind(0, '127.0.0.1');
  await once(server, 'listening');
  const resolver = new Resolver({ timeout: 100, tries: 1 });
  const cancel = () => resolver.cancel();
  t.signal.addEventListener('abort', cancel, { once: true });
  try {
    resolver.setServers([`127.0.0.1:${server.address().port}`]);
    await assert.rejects(async () => resolver.resolve4('localhost\0.invalid'), { code: 'ERR_INVALID_ARG_VALUE' });
    await new Promise(resolve => { setImmediate(resolve); });
    assert.equal(received, 0);
  } finally {
    t.signal.removeEventListener('abort', cancel);
    resolver.cancel();
    await new Promise((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(); }); });
  }
});

test('bundled fetch consumes complete Brotli responses across repeated loopback HTTP requests', { timeout: 5000 }, async t => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    const body = brotliCompressSync(JSON.stringify({ sequence: requests, value: 'fixture music metadata' }));
    response.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'br', 'content-length': body.length });
    response.end(body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const sequence of [1, 2, 3]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/metadata`, { signal: t.signal });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { sequence, value: 'fixture music metadata' });
    }
    assert.equal(requests, 3);
  } finally {
    const closed = new Promise((resolve, reject) => { server.close(error => { if (error) reject(error); else resolve(); }); });
    server.closeAllConnections();
    await closed;
  }
});
