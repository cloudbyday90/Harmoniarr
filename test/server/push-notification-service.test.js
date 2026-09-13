/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createPushNotificationService } from '../../src/server/push/push-notification-service.js';

const keys = { publicKey: 'test-public', privateKey: 'test-private' };
const contact = 'mailto:fixture@example.invalid';
const subscription = { id: 'sub-1', endpoint: 'https://push.example.invalid/private-capability', p256dh: 'test-p256dh', auth: 'test-auth' };
function harness({ store = {}, webPushLib = {}, transport = {}, stderr, nowFn } = {}) {
  const generated = [], sent = [], logs = [], vapidCalls = [];
  const service = createPushNotificationService({ nowFn, vapidKeys: keys, vapidContact: contact,
    pushSubscriptionStore: { upsertSubscription: async (input) => ({ id: 'new-id', ...input }),
      deleteSubscription: async () => {}, deleteSubscriptionByEndpoint: async () => {},
      listSubscriptionsForUser: async () => [subscription], ...store },
    webPushLib: { setVapidDetails: (...args) => vapidCalls.push(args),
      generateRequestDetails: (...args) => { generated.push(args); return { endpoint: args[0].endpoint,
        method: 'POST', body: Buffer.from('encrypted fixture'), headers: { TTL: args[2].TTL } }; }, ...webPushLib },
    pushHttpTransport: { sendRequest: async (input) => { sent.push(input); return { statusCode: 201, headers: {} }; }, ...transport },
    stderr: stderr ?? { write: (line) => logs.push(line) },
  });
  return { service, generated, sent, logs, vapidCalls };
}

test('push service registers VAPID details and returns its public key', () => {
  const context = harness();
  assert.deepEqual(context.vapidCalls, [[contact, keys.publicKey, keys.privateKey]]);
  assert.equal(context.service.getVapidPublicKey(), keys.publicKey);
});

test('subscription registration and removal preserve user ownership and user-agent fields', async () => {
  const removed = [];
  const { service } = harness({ store: { deleteSubscription: async (...args) => removed.push(args) } });
  const input = { userId: 'user-1', endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth };
  assert.deepEqual(await service.subscribe(input), { id: 'new-id', ...input, userAgent: null });
  assert.deepEqual(await service.subscribe({ ...input, userAgent: 'fixture-browser' }), { id: 'new-id', ...input, userAgent: 'fixture-browser' });
  await service.unsubscribe(input.userId, input.endpoint);
  assert.deepEqual(removed, [[input.userId, input.endpoint]]);
});

test('push generation receives explicit VAPID and TTL and shares the original preparation deadline', async () => {
  let now = 100;
  let generatedArgs;
  const requestDetails = { endpoint: subscription.endpoint, method: 'POST', headers: {}, body: Buffer.from('encrypted') };
  const context = harness({ nowFn: () => now, webPushLib: { generateRequestDetails: (...args) => {
    generatedArgs = args; now += 25; return requestDetails;
  } } });
  assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription, payload: { title: 'Ready' }, ttl: 300, timeoutMs: 100 }), { status: 'sent' });
  assert.deepEqual(generatedArgs, [{ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    '{"title":"Ready"}', { TTL: 300, vapidDetails: { subject: contact, ...keys } }]);
  assert.equal(context.sent[0].requestDetails, requestDetails);
  assert.equal(context.sent[0].deadlineAt, 200);
});

test('preparation that consumes the delivery budget never starts transport', async () => {
  let now = 0;
  const context = harness({ nowFn: () => now, webPushLib: { generateRequestDetails: () => { now = 15_001; return {}; } } });
  assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription, payload: {} }),
    { status: 'failed', statusCode: null, retryable: true, retryAt: null });
  assert.equal(context.sent.length, 0);
  assert.deepEqual(context.logs, ['[harmoniarr-push] Push delivery failed.\n']);
});

test('invalid or excessive delivery budgets fail before generation or transport', async () => {
  const context = harness();
  for (const timeoutMs of [0, -1, Infinity, NaN, '15000', 15_001]) {
    await assert.rejects(context.service.sendNotificationToSubscription({ subscription, payload: {}, timeoutMs }), RangeError);
  }
  assert.equal(context.generated.length, 0);
  assert.equal(context.sent.length, 0);
});

test('user delivery aggregates empty and multiple subscription sets', async () => {
  const empty = harness({ store: { listSubscriptionsForUser: async () => [] } });
  assert.deepEqual(await empty.service.sendNotificationToUser({ userId: 'user-1', payload: {} }), { sent: 0, failed: 0, removed: 0 });
  const multiple = harness({ store: { listSubscriptionsForUser: async () => [subscription, { ...subscription, id: 'sub-2' }] } });
  assert.deepEqual(await multiple.service.sendNotificationToUser({ userId: 'user-1', payload: {} }), { sent: 2, failed: 0, removed: 0 });
  assert.equal(multiple.sent.length, 2);
});

for (const statusCode of [404, 410, 412]) {
  test(`HTTP ${statusCode} permanently expires delivery and removes the invalid subscription`, async () => {
    const removed = [];
    const context = harness({ store: { deleteSubscriptionByEndpoint: async (endpoint) => removed.push(endpoint) },
      transport: { sendRequest: async () => ({ statusCode, headers: {} }) } });
    assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription, payload: {} }),
      { status: 'expired', statusCode, retryable: false, retryAt: null });
    await nextTurn();
    assert.deepEqual(removed, [subscription.endpoint]);
    assert.deepEqual(context.logs, []);
  });
}

for (const statusCode of [408, 425, 429, 500, 502, 503, 504, 301, 400, 401, 403]) {
  test(`HTTP ${statusCode} keeps the existing retry classification without provider diagnostics`, async () => {
    const context = harness({ transport: { sendRequest: async () => ({ statusCode,
      headers: { location: subscription.endpoint, 'private-provider-message': 'secret' } }) } });
    assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription, payload: {} }),
      { status: 'failed', statusCode, retryable: [408, 425, 429, 500, 502, 503, 504].includes(statusCode), retryAt: null });
    assert.deepEqual(context.logs, ['[harmoniarr-push] Push delivery failed.\n']);
  });
}

test('network and generation errors are redacted and do not prevent another subscription delivery', async () => {
  let calls = 0;
  const context = harness({ store: { listSubscriptionsForUser: async () => [subscription, { ...subscription, id: 'sub-2' }] },
    transport: { sendRequest: async () => { if (calls++ === 0) throw new Error(`private ${subscription.endpoint}`); return { statusCode: 201 }; } } });
  assert.deepEqual(await context.service.sendNotificationToUser({ userId: 'user-1', payload: {} }), { sent: 1, failed: 1, removed: 0 });
  assert.deepEqual(context.logs, ['[harmoniarr-push] Push delivery failed.\n']);
  const generation = harness({ webPushLib: { generateRequestDetails: () => { throw new Error(keys.privateKey); } } });
  assert.equal((await generation.service.sendNotificationToSubscription({ subscription, payload: {} })).retryable, true);
  assert.equal(generation.sent.length, 0);
  assert.deepEqual(generation.logs, ['[harmoniarr-push] Push delivery failed.\n']);
});

test('failed invalidation and throwing or rejecting diagnostics cannot alter delivery results', async () => {
  for (const write of [() => { throw new Error('sink'); }, () => Promise.reject(new Error('sink'))]) {
    const { service } = harness({ stderr: { write }, store: { deleteSubscriptionByEndpoint: async () => { throw new Error('private storage error'); } },
      transport: { sendRequest: async () => ({ statusCode: 410 }) } });
    assert.equal((await service.sendNotificationToSubscription({ subscription, payload: {} })).status, 'expired');
    await nextTurn();
  }
});

test('Retry-After accepts bounded delta seconds and future HTTP dates while rejecting malformed or overflowing values', async () => {
  for (const value of ['120junk', '-1', '1.5', '1e2', '9999999999999999999', '1'.repeat(300), 'not a date', 'Wed, 01 Jan 2020 00:00:00 GMT']) {
    const { service } = harness({ transport: { sendRequest: async () => ({ statusCode: 429, headers: { 'Retry-After': value } }) } });
    assert.equal((await service.sendNotificationToSubscription({ subscription, payload: {} })).retryAt, null, value);
  }
  const future = harness({ transport: { sendRequest: async () => ({ statusCode: 429, headers: { 'retry-after': 'Sun, 01 Jan 2040 00:00:00 GMT' } }) } });
  assert.equal((await future.service.sendNotificationToSubscription({ subscription, payload: {} })).retryAt, '2040-01-01T00:00:00.000Z');
  const delta = harness({ transport: { sendRequest: async () => ({ statusCode: 503, headers: { 'retry-after': '120' } }) } });
  const before = Date.now();
  const retryAt = Date.parse((await delta.service.sendNotificationToSubscription({ subscription, payload: {} })).retryAt);
  assert.ok(retryAt >= before + 120_000 && retryAt <= Date.now() + 120_000);
});
