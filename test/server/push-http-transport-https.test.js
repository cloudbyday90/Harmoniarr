/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { once } from 'node:events';
import { createPushHttpTransport } from '../../src/server/push/push-http-transport.js';

const cert = await readFile(new URL('../../testing/fixtures/push-https/localhost-cert.pem', import.meta.url));
const key = await readFile(new URL('../../testing/fixtures/push-https/localhost-key.pem', import.meta.url));

async function fixture(t, listener) {
  const sockets = new Set();
  const server = createServer({ cert, key }, listener);
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('tlsClientError', () => {});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => { server.close(resolve); });
  });
  return `https://127.0.0.1:${server.address().port}`;
}
function transport(options = {}) {
  return createPushHttpTransport({ requestFn: (url, input, callback) => request(url, { ...input, ca: cert }, callback), ...options });
}
function details(endpoint) { return { endpoint, method: 'POST', headers: {}, body: Buffer.from('synthetic encrypted payload') }; }

test('real HTTPS deadline closes stalled and continuously active response sockets', { timeout: 12_000 }, async (t) => {
  for (const trickle of [false, true]) {
    await t.test(trickle ? 'trickling response body' : 'stalled before headers', async (caseTest) => {
      let closed;
      let received;
      let chunks = 0;
      const socketClosed = new Promise((resolve) => { closed = resolve; });
      const requestReceived = new Promise((resolve) => { received = resolve; });
      const endpoint = await fixture(caseTest, (req, res) => {
        req.resume();
        req.socket.once('close', closed);
        received();
        if (trickle) {
          res.writeHead(200);
          res.write('start');
          const timer = setInterval(() => { chunks++; res.write('x'); }, 25);
          req.socket.once('close', () => clearInterval(timer));
          caseTest.after(() => clearInterval(timer));
        }
      });
      const sending = transport().sendRequest({ requestDetails: details(endpoint), deadlineAt: performance.now() + 2000 });
      const rejected = assert.rejects(sending, { code: 'push_transport_timeout' });
      await requestReceived;
      await rejected;
      await socketClosed;
      if (trickle) assert.ok(chunks > 1, 'Ongoing socket activity must not reset the absolute deadline');
    });
  }
});

test('real HTTPS transport verifies TLS and bounds response bytes and headers without following redirects', { timeout: 10_000 }, async (t) => {
  let requests = 0;
  const endpoint = await fixture(t, (req, res) => {
    requests++; req.resume();
    if (req.url === '/large-body') { res.write(Buffer.alloc(20)); res.end(Buffer.alloc(20)); return; }
    if (req.url === '/large-headers') { res.setHeader('x-large', 'x'.repeat(20_000)); res.end(); return; }
    if (req.url === '/redirect') { res.writeHead(302, { location: 'https://never-contact.example.invalid/' }); res.end(); return; }
    res.writeHead(201, { 'retry-after': '17', 'x-private': 'provider-private-header' });
    res.end('provider-private-body');
  });
  const send = (client, path) => client.sendRequest({ requestDetails: details(endpoint + path), deadlineAt: performance.now() + 2000 });
  await assert.rejects(send(createPushHttpTransport(), '/untrusted'), { code: 'push_transport_request_failed' });
  assert.equal(requests, 0, 'The production default cannot trust a synthetic self-signed certificate');
  await assert.rejects(send(transport({ maxResponseBytes: 32 }), '/large-body'), { code: 'push_transport_response_too_large' });
  await assert.rejects(send(transport(), '/large-headers'), { code: 'push_transport_response_too_large' });
  assert.deepEqual(await send(transport(), '/redirect'), { statusCode: 302, headers: {} });
  assert.deepEqual(await send(transport(), '/ok'), { statusCode: 201, headers: { 'retry-after': '17' } });
  assert.equal(requests, 4);
});
