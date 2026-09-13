/* Harmoniarr - GPL-3.0; see LICENSE. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { createPushDestinationResolver } from '../../src/server/push/push-destination-resolver.js';

function harness({ resolve4 = async () => ['8.8.8.8'], resolve6 = async () => [], cancel } = {}) {
  let created = 0, cancelled = 0;
  const calls = [];
  const resolver = createPushDestinationResolver({ createResolverFn: () => {
    created++;
    return { resolve4: (hostname) => { calls.push([4, hostname]); return resolve4(hostname); },
      resolve6: (hostname) => { calls.push([6, hostname]); return resolve6(hostname); },
      cancel: () => { cancelled++; cancel?.(); } };
  } });
  const controller = new AbortController();
  return { resolver, controller, calls, created: () => created, cancelled: () => cancelled,
    resolve: () => resolver.resolveDestination({ hostname: 'push.example.com', signal: controller.signal }) };
}

test('resolver checks both families before selecting a pinned public address and does not cache sends', async () => {
  const context = harness({ resolve6: async () => ['2606:4700:4700::1111'] });
  assert.deepEqual(await context.resolve(), { address: '8.8.8.8', family: 4 });
  assert.deepEqual(context.calls, [[4, 'push.example.com'], [6, 'push.example.com']]);
  assert.equal(getEventListeners(context.controller.signal, 'abort').length, 0);
  assert.equal(context.cancelled(), 0);
  await context.resolve();
  assert.equal(context.created(), 2);
  assert.equal(context.calls.length, 4);
});

test('one absent address family is permitted but no usable addresses is a retryable DNS failure', async () => {
  for (const code of ['ENODATA', 'ENOTFOUND']) {
    const context = harness({ resolve4: async () => { throw Object.assign(new Error('private DNS text'), { code }); },
      resolve6: async () => ['2606:4700:4700::1111'] });
    assert.deepEqual(await context.resolve(), { address: '2606:4700:4700::1111', family: 6 });
  }
  await assert.rejects(harness({ resolve4: async () => [] }).resolve(), { code: 'push_destination_failed' });
});

test('any private, malformed, wrong-family or oversized answer blocks the entire destination', async () => {
  for (const [a, aaaa] of [
    [['8.8.8.8', '127.0.0.1'], []], [['8.8.8.8'], ['::ffff:8.8.8.8']],
    [['8.8.8.8'], ['fe80::1']], [['8.8.8.8'], ['64:ff9b::808:808']],
    [['8.8.8.8'], ['8.8.4.4']], [['2001:4860::8888'], []], [['8.8.8.8', null], []],
    [['8.8.8.8'], [undefined]], [Array(1), []], ['8.8.8.8', []], [[{ address: '8.8.8.8' }], []],
    [Array(65).fill('8.8.8.8'), []], [Array(33).fill('8.8.8.8'), Array(32).fill('2606:4700:4700::1111')],
  ]) {
    const context = harness({ resolve4: async () => a, resolve6: async () => aaaa });
    await assert.rejects(context.resolve(), { code: 'push_destination_blocked' });
    assert.equal(context.cancelled(), 1);
    assert.equal(getEventListeners(context.controller.signal, 'abort').length, 0);
  }
  assert.deepEqual(await harness({ resolve4: async () => Array(64).fill('8.8.8.8') }).resolve(), { address: '8.8.8.8', family: 4 });
});

test('DNS infrastructure errors and synchronous resolver throws are fixed and cancel remaining work', async () => {
  for (const code of ['ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED', undefined]) {
    const context = harness({ resolve6: () => { throw Object.assign(new Error('private DNS server'), { code }); } });
    await assert.rejects(context.resolve(), (error) => {
      assert.equal(error.code, 'push_destination_failed');
      assert.equal(error.message, 'Push destination could not be resolved');
      assert.equal(error.cause, undefined); return true;
    });
    assert.equal(context.cancelled(), 1);
  }
  const resolver = createPushDestinationResolver({ createResolverFn: () => { throw new Error('private configuration'); } });
  await assert.rejects(resolver.resolveDestination({ hostname: 'push.example.com', signal: new AbortController().signal }), { code: 'push_destination_failed' });
});

test('aborting cancels both outstanding queries and late results cannot settle a second time', async () => {
  let complete4, complete6;
  const context = harness({ resolve4: () => new Promise((resolve) => { complete4 = resolve; }),
    resolve6: () => new Promise((resolve) => { complete6 = resolve; }) });
  const result = context.resolve();
  const rejected = assert.rejects(result, { code: 'push_destination_cancelled' });
  assert.equal(context.calls.length, 2);
  context.controller.abort();
  await rejected;
  complete4(['8.8.8.8']); complete6(['2606:4700:4700::1111']);
  await Promise.resolve();
  assert.equal(context.cancelled(), 1);
  assert.equal(getEventListeners(context.controller.signal, 'abort').length, 0);
});

test('pre-aborted resolution never creates a DNS channel and missing cancellation wiring fails closed', async () => {
  const context = harness(); context.controller.abort();
  await assert.rejects(context.resolve(), { code: 'push_destination_cancelled' });
  assert.equal(context.created(), 0);
  await assert.rejects(context.resolver.resolveDestination({ hostname: 'push.example.com' }), { code: 'push_destination_failed' });
  assert.equal(context.created(), 0);
});
