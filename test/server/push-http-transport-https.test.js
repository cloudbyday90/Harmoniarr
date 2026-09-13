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
import { createPushDestinationResolver } from '../../src/server/push/push-destination-resolver.js';
import { createPushHttpTransport } from '../../src/server/push/push-http-transport.js';

const cert = await readFile(new URL('../../testing/fixtures/push-https/localhost-cert.pem', import.meta.url));
const key = await readFile(new URL('../../testing/fixtures/push-https/localhost-key.pem', import.meta.url));

async function fixture(t, listener, onConnection = () => {}) {
  const sockets = new Set();
  const server = createServer({ cert, key }, listener);
  server.on('connection', (socket) => { onConnection(); sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('tlsClientError', () => {});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => { server.close(resolve); });
  });
  return `https://127.0.0.1:${server.address().port}`;
}
const providerHostname = 'push-fixture.example.com';
const vettedAddress = '93.184.216.34';
function transport(localEndpoint, { trustFixture = true, ...options } = {}) {
  const local = new URL(localEndpoint);
  return createPushHttpTransport({
    destinationResolver: { resolveDestination: async ({ hostname }) => {
      assert.equal(hostname, providerHostname);
      return { address: vettedAddress, family: 4 };
    } },
    requestFn: (url, input, callback) => {
      assert.equal(url.hostname, providerHostname);
      assert.equal(url.port, '');
      assert.equal(input.servername, providerHostname);
      assert.equal(input.headers.Host, providerHostname);
      assert.equal(input.family, 4);
      assert.equal(input.autoSelectFamily, false);
      assert.equal(input.rejectUnauthorized, true);
      assert.equal(input.agent, false);
      assert.equal(typeof input.lookup, 'function');
      // Inspect the production pin before the test-only socket reroute.
      input.lookup(providerHostname, {}, (error, address, family) => {
        assert.equal(error, null);
        assert.equal(address, vettedAddress);
        assert.equal(family, 4);
      });
      return request(url, { ...input, hostname: '127.0.0.1', port: local.port,
        headers: { ...input.headers, host: providerHostname },
        ...(trustFixture ? { ca: cert } : {}),
      }, callback);
    },
    ...options,
  });
}
function details(endpoint) {
  const local = new URL(endpoint);
  return { endpoint: `https://${providerHostname}${local.pathname}${local.search}`,
    method: 'POST', headers: {}, body: Buffer.from('synthetic encrypted payload') };
}

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
      const sending = transport(endpoint).sendRequest({ requestDetails: details(endpoint), deadlineAt: performance.now() + 2000 });
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
    assert.equal(req.headers.host, providerHostname);
    assert.equal(req.socket.servername, providerHostname);
    if (req.url === '/large-body') { res.write(Buffer.alloc(20)); res.end(Buffer.alloc(20)); return; }
    if (req.url === '/large-headers') { res.setHeader('x-large', 'x'.repeat(20_000)); res.end(); return; }
    if (req.url === '/redirect') { res.writeHead(302, { location: 'https://never-contact.example.invalid/' }); res.end(); return; }
    res.writeHead(201, { 'retry-after': '17', 'x-private': 'provider-private-header' });
    res.end('provider-private-body');
  });
  const send = (client, path) => client.sendRequest({ requestDetails: details(endpoint + path), deadlineAt: performance.now() + 2000 });
  await assert.rejects(send(transport(endpoint, { trustFixture: false }), '/untrusted'), { code: 'push_transport_request_failed' });
  assert.equal(requests, 0, 'Default certificate verification must reject an untrusted fixture certificate');
  await assert.rejects(send(transport(endpoint, { maxResponseBytes: 32 }), '/large-body'), { code: 'push_transport_response_too_large' });
  await assert.rejects(send(transport(endpoint), '/large-headers'), { code: 'push_transport_response_too_large' });
  assert.deepEqual(await send(transport(endpoint), '/redirect'), { statusCode: 302, headers: {} });
  assert.deepEqual(await send(transport(endpoint), '/ok'), { statusCode: 201, headers: { 'retry-after': '17' } });
  assert.equal(requests, 4);
});


test('private DNS answers prevent any HTTPS request or local server connection', async (t) => {
  let connections = 0;
  let requests = 0;
  const endpoint = await fixture(t, (_req, res) => { requests++; res.end(); }, () => { connections++; });
  const destinationResolver = createPushDestinationResolver({ createResolverFn: () => ({
    resolve4: async () => ['127.0.0.1'],
    resolve6: async () => [],
    cancel() {},
  }) });
  let nativeCalls = 0;
  const client = transport(endpoint, { destinationResolver,
    requestFn: () => { nativeCalls++; assert.fail('A private destination must not reach native HTTPS'); },
  });
  await assert.rejects(client.sendRequest({ requestDetails: details(endpoint), deadlineAt: performance.now() + 2000 }),
    { code: 'push_transport_destination_blocked' });
  assert.equal(nativeCalls, 0);
  assert.equal(connections, 0);
  assert.equal(requests, 0);
});
