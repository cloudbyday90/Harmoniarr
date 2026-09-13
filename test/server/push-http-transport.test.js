/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import webPush from 'web-push';
import { createPushHttpTransport } from '../../src/server/push/push-http-transport.js';
import { createPushNotificationService } from '../../src/server/push/push-notification-service.js';

// Public synthetic fixture credentials, trusted only by this loopback test adapter.
const cert = await readFile(new URL('../../testing/fixtures/push-https/localhost-cert.pem', import.meta.url));
const key = await readFile(new URL('../../testing/fixtures/push-https/localhost-key.pem', import.meta.url));
const trustedRequest = (url, options, callback) => request(url, { ...options, ca: cert }, callback);
const requestDetails = (endpoint) => ({ endpoint, method: 'POST', headers: { TTL: '60' }, body: Buffer.from('encrypted fixture') });
const errorCode = (code) => (error) => {
  assert.equal(error.code, `push_transport_${code}`);
  assert.equal(error.cause, undefined);
  assert.equal(error.endpoint, undefined);
  assert.doesNotMatch(error.message, /private|https:|127\.0\.0\.1/);
  return true;
};
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function fixture(t, handler) {
  const server = createServer({ cert, key }, handler);
  const sockets = new Set();
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('tlsClientError', () => {});
  t.after(async () => {
    const closed = new Promise((resolve, reject) => { server.close((error) => error ? reject(error) : resolve()); });
    for (const socket of sockets) socket.destroy();
    await closed;
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { endpoint: `https://127.0.0.1:${server.address().port}/private-capability`, server };
}

test('absolute deadline destroys the native request while DNS lookup remains unresolved', { timeout: 5_000 }, async () => {
  let outgoing;
  let lookupStarted = false;
  const closed = deferred();
  const transport = createPushHttpTransport({ requestFn: (url, options, callback) => {
    outgoing = request(url, { ...options, lookup: () => { lookupStarted = true; } }, callback);
    outgoing.once('close', closed.resolve);
    return outgoing;
  } });
  await assert.rejects(transport.sendRequest({ requestDetails: requestDetails('https://dns-fixture.invalid/private-capability'),
    deadlineAt: performance.now() + 100 }), errorCode('timeout'));
  await closed.promise;
  assert.equal(lookupStarted, true);
  assert.equal(outgoing.destroyed, true);
});

test('invalid endpoint shapes and expired deadlines never construct a request', async () => {
  let calls = 0;
  const transport = createPushHttpTransport({ nowFn: () => 100, requestFn: () => { calls++; } });
  for (const endpoint of ['http://fixture.invalid', 'https://user:password@fixture.invalid', 'https://fixture.invalid/#fragment', 'not-a-url']) {
    await assert.rejects(transport.sendRequest({ requestDetails: requestDetails(endpoint), deadlineAt: 200 }), errorCode('invalid_request'));
  }
  await assert.rejects(transport.sendRequest({ requestDetails: { ...requestDetails('https://fixture.invalid'), body: 'plaintext' }, deadlineAt: 200 }), errorCode('invalid_request'));
  await assert.rejects(transport.sendRequest({ requestDetails: requestDetails('https://fixture.invalid'), deadlineAt: 100 }), errorCode('timeout'));
  await assert.rejects(transport.sendRequest({ requestDetails: requestDetails('https://fixture.invalid'), deadlineAt: Infinity }), errorCode('invalid_request'));
  assert.equal(calls, 0);
});

test('deadline cleanup settles once, caps the timer, and handles late request and response errors safely', async () => {
  let responseCallback;
  let timerCallback;
  let cleared = 0;
  let destroyed = 0;
  const outgoing = new EventEmitter();
  outgoing.end = () => {};
  outgoing.destroy = () => { destroyed++; outgoing.emit('error', new Error('private request')); };
  const transport = createPushHttpTransport({ nowFn: () => 0,
    setTimeoutFn: (callback, milliseconds) => { timerCallback = callback; assert.equal(milliseconds, 15_000); return 'timer'; },
    clearTimeoutFn: (timer) => { assert.equal(timer, 'timer'); cleared++; },
    requestFn: (url, options, callback) => {
      assert.equal(url.protocol, 'https:');
      assert.deepEqual(options, { method: 'POST', headers: { TTL: '60' }, agent: false, rejectUnauthorized: true, maxHeaderSize: 16_384 });
      responseCallback = callback; return outgoing;
    },
  });
  const delivery = transport.sendRequest({ requestDetails: { ...requestDetails('https://fixture.invalid'),
    proxy: 'http://private.invalid', rejectUnauthorized: false, agent: {} }, deadlineAt: 50_000 });
  const rejected = assert.rejects(delivery, errorCode('timeout'));
  timerCallback();
  await rejected;
  const incoming = new EventEmitter();
  incoming.destroy = () => { destroyed++; incoming.emit('error', new Error('private late response')); };
  assert.doesNotThrow(() => responseCallback(incoming));
  outgoing.emit('error', new Error('private late request'));
  assert.equal(cleared, 1);
  assert.equal(destroyed, 2);
});

test('successful completion removes the deadline timer and ignores its late callback', async () => {
  let timerCallback;
  let responseCallback;
  let destroyed = 0;
  let cleared = 0;
  const outgoing = new EventEmitter();
  outgoing.destroy = () => { destroyed++; };
  outgoing.end = () => {
    const incoming = new EventEmitter();
    incoming.destroy = () => { destroyed++; };
    incoming.statusCode = 201; incoming.complete = true; incoming.headers = {};
    responseCallback(incoming); incoming.emit('end'); incoming.emit('close');
  };
  const transport = createPushHttpTransport({ nowFn: () => 0,
    setTimeoutFn: (callback) => { timerCallback = callback; return 'timer'; }, clearTimeoutFn: () => { cleared++; },
    requestFn: (url, options, callback) => { responseCallback = callback; return outgoing; },
  });
  assert.deepEqual(await transport.sendRequest({ requestDetails: requestDetails('https://fixture.invalid'), deadlineAt: 100 }), { statusCode: 201, headers: {} });
  timerCallback();
  assert.equal(cleared, 1);
  assert.equal(destroyed, 0);
});

test('request construction failures are fixed and release their timer', async () => {
  let cleared = 0;
  const transport = createPushHttpTransport({ requestFn: () => { throw new Error('private credentials'); },
    setTimeoutFn: () => 'timer', clearTimeoutFn: () => { cleared++; } });
  await assert.rejects(transport.sendRequest({ requestDetails: requestDetails('https://fixture.invalid'), deadlineAt: performance.now() + 100 }), errorCode('request_failed'));
  assert.equal(cleared, 1);
});

test('real web-push generation preserves encrypted bytes and VAPID headers through the native HTTPS adapter', { timeout: 5_000 }, async (t) => {
  let received;
  let generated;
  const { endpoint } = await fixture(t, (incoming, response) => {
    const chunks = [];
    incoming.on('data', (chunk) => chunks.push(chunk));
    incoming.on('end', () => { received = { headers: incoming.headers, body: Buffer.concat(chunks) }; response.writeHead(201); response.end(); });
  });
  const subscriber = createECDH('prime256v1'); subscriber.generateKeys();
  const vapidKeys = webPush.generateVAPIDKeys();
  const payload = { title: 'Synthetic local delivery', body: 'No external push service is contacted.' };
  const service = createPushNotificationService({ vapidKeys, vapidContact: 'mailto:fixture@example.invalid', pushSubscriptionStore: {},
    pushHttpTransport: createPushHttpTransport({ requestFn: trustedRequest }),
    webPushLib: { setVapidDetails: (...args) => webPush.setVapidDetails(...args),
      generateRequestDetails: (...args) => { generated = webPush.generateRequestDetails(...args); return generated; } },
    stderr: { write: () => assert.fail('local encrypted delivery should succeed') },
  });
  assert.deepEqual(await service.sendNotificationToSubscription({ subscription: { endpoint,
    p256dh: subscriber.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }, payload, ttl: 120, timeoutMs: 2_000 }), { status: 'sent' });
  assert.deepEqual(received.body, generated.body);
  assert.notDeepEqual(received.body, Buffer.from(JSON.stringify(payload)));
  assert.equal(received.headers['content-encoding'], 'aes128gcm');
  assert.equal(received.headers.ttl, '120');
  assert.match(received.headers.authorization, /^vapid t=/);
  assert.equal(received.headers.authorization, generated.headers.Authorization);
});
