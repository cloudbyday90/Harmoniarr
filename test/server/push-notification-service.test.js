/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushSubscriptionKeys } from '../../testing/push-subscription-fixtures.js';

const subscriptionKeys = createPushSubscriptionKeys();
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createPushNotificationService } from '../../src/server/push/push-notification-service.js';

const keys = { publicKey: 'test-public', privateKey: 'test-private' };
const contact = 'mailto:fixture@example.invalid';
const subscription = { id: 'sub-1', userId: 'user-1', registrationToken: 'e4e7be1c-1fb1-454c-ae3c-bfbf0e7bca10',
  endpoint: 'https://push.example.com/private-capability', ...subscriptionKeys };
const registrationIdentity = ({ id, userId, endpoint, registrationToken }) => ({ id, userId, endpoint, registrationToken });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function harness({ store = {}, webPushLib = {}, transport = {}, stderr, nowFn } = {}) {
  const generated = [], sent = [], logs = [], vapidCalls = [], invalidated = [];
  const service = createPushNotificationService({ nowFn, vapidKeys: keys, vapidContact: contact,
    pushSubscriptionStore: { upsertSubscription: async (input) => ({ id: 'new-id', ...input }),
      deleteSubscription: async () => {},
      invalidateSubscriptionRegistration: async (identity) => { invalidated.push(identity); return true; },
      listSubscriptionsForUser: async () => [subscription], ...store },
    webPushLib: { setVapidDetails: (...args) => vapidCalls.push(args),
      generateRequestDetails: (...args) => { generated.push(args); return { endpoint: args[0].endpoint,
        method: 'POST', body: Buffer.from('encrypted fixture'), headers: { TTL: args[2].TTL } }; }, ...webPushLib },
    pushHttpTransport: { sendRequest: async (input) => { sent.push(input); return { statusCode: 201, headers: {} }; }, ...transport },
    stderr: stderr ?? { write: (line) => logs.push(line) },
  });
  return { service, generated, sent, logs, vapidCalls, invalidated };
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

for (const statusCode of [404, 410]) {
  test(`HTTP ${statusCode} expires the original attempt and conditionally invalidates its registration`, async () => {
    const context = harness({ transport: { sendRequest: async () => ({ statusCode, headers: {} }) } });
    assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription, payload: {} }),
      { status: 'expired', statusCode, retryable: false, retryAt: null });
    await nextTurn();
    assert.deepEqual(context.invalidated, [registrationIdentity(subscription)]);
    assert.equal(Object.isFrozen(context.invalidated[0]), true);
    assert.deepEqual(context.logs, []);
  });
}

for (const statusCode of [408, 425, 429, 500, 502, 503, 504, 301, 400, 401, 403, 412]) {
  test(`HTTP ${statusCode} classifies delivery failure without invalidating the registration or exposing provider diagnostics`, async () => {
    const context = harness({ transport: { sendRequest: async () => ({ statusCode,
      headers: { location: subscription.endpoint, 'private-provider-message': 'secret' } }) } });
    assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription, payload: {} }),
      { status: 'failed', statusCode, retryable: [408, 425, 429, 500, 502, 503, 504].includes(statusCode), retryAt: null });
    assert.deepEqual(context.logs, ['[harmoniarr-push] Push delivery failed.\n']);
    assert.deepEqual(context.invalidated, [], 'only HTTP 404/410 authorizes registration cleanup');
  });
}

test('expired cleanup retains the frozen original identity when the caller changes its row during transport', async () => {
  const pending = deferred();
  const mutableSubscription = { ...subscription };
  const originalIdentity = registrationIdentity(mutableSubscription);
  let sentEndpoint;
  const context = harness({ transport: { sendRequest: (input) => {
    sentEndpoint = input.requestDetails.endpoint;
    return pending.promise;
  } } });
  const delivery = context.service.sendNotificationToSubscription({ subscription: mutableSubscription, payload: {} });
  Object.assign(mutableSubscription, { id: 'replacement-id', userId: 'replacement-owner',
    endpoint: 'https://push.example.com/replacement-endpoint', registrationToken: 'cd55cb14-3dda-405f-bf2f-56efef9581f8',
    p256dh: 'replacement-key', auth: 'replacement-auth' });
  pending.resolve({ statusCode: 410 });
  assert.equal((await delivery).status, 'expired');
  await nextTurn();
  assert.equal(sentEndpoint, originalIdentity.endpoint);
  assert.deepEqual(context.invalidated, [originalIdentity]);
  assert.equal(Object.isFrozen(context.invalidated[0]), true);
  assert.equal(Object.hasOwn(context.invalidated[0], 'p256dh'), false);
  assert.equal(Object.hasOwn(context.invalidated[0], 'auth'), false);
});

test('registration identity and endpoint are captured before request generation can change the caller row', async () => {
  const mutableSubscription = { ...subscription };
  const originalIdentity = registrationIdentity(mutableSubscription);
  const context = harness({ webPushLib: { generateRequestDetails: (input) => {
    mutableSubscription.endpoint = 'https://push.example.com/replacement-endpoint';
    mutableSubscription.registrationToken = 'cd55cb14-3dda-405f-bf2f-56efef9581f8';
    return { endpoint: input.endpoint, method: 'POST', body: Buffer.from('fixture'), headers: {} };
  } }, transport: { sendRequest: async (input) => {
    assert.equal(input.requestDetails.endpoint, originalIdentity.endpoint);
    return { statusCode: 404 };
  } } });
  assert.equal((await context.service.sendNotificationToSubscription({ subscription: mutableSubscription, payload: {} })).status, 'expired');
  await nextTurn();
  assert.deepEqual(context.invalidated, [originalIdentity]);
});

test('stale cleanup is benign and does not invalidate a refreshed registration with identical keys', async () => {
  const pending = deferred();
  const active = { ...subscription, invalidated: false };
  const identities = [];
  const context = harness({ transport: { sendRequest: () => pending.promise },
    store: { invalidateSubscriptionRegistration: async (identity) => {
      identities.push(identity);
      if (identity.registrationToken !== active.registrationToken) return false;
      active.invalidated = true;
      return true;
    } } });
  const delivery = context.service.sendNotificationToSubscription({ subscription: { ...active }, payload: {} });
  active.registrationToken = 'cd55cb14-3dda-405f-bf2f-56efef9581f8';
  pending.resolve({ statusCode: 410 });
  assert.equal((await delivery).status, 'expired');
  await nextTurn();
  assert.equal(active.invalidated, false);
  assert.deepEqual(identities, [registrationIdentity(subscription)]);
  assert.deepEqual(context.logs, []);
});

test('incomplete or non-string registration identity cannot invoke cleanup or a legacy endpoint fallback', async () => {
  let legacyCalls = 0;
  const context = harness({ store: { deleteSubscriptionByEndpoint: () => { legacyCalls++; } },
    transport: { sendRequest: async () => ({ statusCode: 410 }) } });
  for (const field of ['id', 'userId', 'registrationToken']) {
    for (const value of [undefined, null, '', {}, 42]) {
      assert.equal((await context.service.sendNotificationToSubscription({ subscription: { ...subscription, [field]: value }, payload: {} })).status, 'expired');
    }
  }
  await nextTurn();
  assert.deepEqual(context.invalidated, []);
  assert.equal(legacyCalls, 0);
  assert.deepEqual(context.logs, []);
});

test('missing conditional cleanup implementation never falls back to endpoint-only invalidation', async () => {
  let legacyCalls = 0;
  const context = harness({ store: { invalidateSubscriptionRegistration: undefined,
    deleteSubscriptionByEndpoint: () => { legacyCalls++; } }, transport: { sendRequest: async () => ({ statusCode: 410 }) } });
  assert.equal((await context.service.sendNotificationToSubscription({ subscription, payload: {} })).status, 'expired');
  await nextTurn();
  assert.equal(legacyCalls, 0);
  assert.deepEqual(context.logs, ['[harmoniarr-push] Expired subscription invalidation failed.\n']);
});

test('expired delivery finishes independently of cleanup and legacy removed counts attempts rather than mutations', async () => {
  const cleanup = deferred();
  let cleanupStarted = false;
  let cleanupFinished = false;
  const context = harness({ store: { invalidateSubscriptionRegistration: async () => {
    cleanupStarted = true;
    await cleanup.promise;
    cleanupFinished = true;
    return false;
  } }, transport: { sendRequest: async () => ({ statusCode: 404 }) } });
  assert.deepEqual(await context.service.sendNotificationToUser({ userId: subscription.userId, payload: {} }), { sent: 0, failed: 0, removed: 1 });
  assert.equal(cleanupStarted, true);
  assert.equal(cleanupFinished, false);
  cleanup.resolve();
  await nextTurn();
  assert.equal(cleanupFinished, true);
  assert.deepEqual(context.logs, []);
});

test('synchronous and rejected cleanup failures preserve the result and expose only fixed diagnostics', async () => {
  for (const invalidateSubscriptionRegistration of [
    () => { throw new Error(`private ${subscription.endpoint} ${subscription.registrationToken} ${subscription.auth}`); },
    async () => { throw new Error(`private ${subscription.endpoint} ${subscription.registrationToken} ${subscription.p256dh}`); },
  ]) {
    const context = harness({ store: { invalidateSubscriptionRegistration }, transport: { sendRequest: async () => ({ statusCode: 410 }) } });
    assert.equal((await context.service.sendNotificationToSubscription({ subscription, payload: {} })).status, 'expired');
    await nextTurn();
    assert.deepEqual(context.logs, ['[harmoniarr-push] Expired subscription invalidation failed.\n']);
  }
});

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
    const { service } = harness({ stderr: { write }, store: { invalidateSubscriptionRegistration: async () => { throw new Error('private storage error'); } },
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


test('registration service rejects invalid input and persisted invalid subscriptions never reach encryption or transport', async () => {
  let writes = 0;
  const context = harness({ store: { upsertSubscription: async () => { writes++; } } });
  for (const overrides of [{ endpoint: 'https://127.0.0.1/private' }, { auth: 'invalid' }]) {
    const invalid = { ...subscription, ...overrides };
    await assert.rejects(context.service.subscribe(invalid), { code: 'push_subscription_invalid' });
    assert.deepEqual(await context.service.sendNotificationToSubscription({ subscription: invalid, payload: {} }), {
      retryAt: null, retryable: false, status: 'failed', statusCode: null,
    });
  }
  assert.equal(writes, 0);
  assert.deepEqual(context.generated, []);
  assert.deepEqual(context.sent, []);
  assert.deepEqual(context.invalidated, []);
});

test('blocked destinations fail permanently while DNS infrastructure failures retain bounded retries', async () => {
  for (const code of ['push_transport_destination_blocked', 'push_transport_invalid_request', 'push_transport_request_failed']) {
    const context = harness({ transport: { sendRequest: async () => { throw Object.assign(new Error('private-address'), { code }); } } });
    const result = await context.service.sendNotificationToSubscription({ subscription, payload: {} });
    assert.equal(result.status, 'failed');
    assert.equal(result.retryable, code === 'push_transport_request_failed');
    assert.deepEqual(context.invalidated, []);
    assert.doesNotMatch(context.logs.join(''), /private-address/);
  }
});
