/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useAppleMusicSigningStatus } from '../../src/client/composables/useAppleMusicSigningStatus.js';
const valid = { state: 'valid', checks: { teamId: 'valid', keyId: 'valid', privateKey: 'valid' } };
const payload = { appleMusic: { localSigning: valid } };

test('Apple status request forwards only cancellation, rejects duplicates and adopts fixed enums', async () => {
  const pending = Promise.withResolvers(); let calls = 0, signal;
  const owner = useAppleMusicSigningStatus({ fetchStatus: options => { calls++; assert.deepEqual(Object.keys(options), ['signal']); signal = options.signal; return pending.promise; } });
  const first = owner.load(); assert.equal(owner.isLoading.value, true); assert.equal(await owner.load(), null); assert.equal(calls, 1);
  pending.resolve(payload); assert.deepEqual(await first, valid); assert.equal(signal.aborted, false); assert.equal(owner.isLoading.value, false); assert.deepEqual(owner.status.value, valid);
  owner.dispose();
});
test('Apple read failures and malformed payloads clear results without reflecting response text', async () => {
  let response = payload;
  const owner = useAppleMusicSigningStatus({ fetchStatus: async () => { if (response instanceof Error) throw response; return response; } });
  await owner.load();
  for (const value of [new Error('PRIVATE-input-sentinel'), { appleMusic: { localSigning: { ...valid, state: 'wrong' } } }, {}]) {
    response = value; assert.equal(await owner.load(), null); assert.equal(owner.status.value, null); assert.equal(owner.failed.value, true);
  }
  response = payload; await owner.load(); assert.equal(owner.failed.value, false); owner.dispose();
});
test('Apple invalidation rejects late success and late failure even when transport ignores abort', async () => {
  const requests = []; const owner = useAppleMusicSigningStatus({ fetchStatus: ({ signal }) => { const pending = Promise.withResolvers(); requests.push({ ...pending, signal }); return pending.promise; } });
  const old = owner.load(); owner.invalidate(); assert.equal(requests[0].signal.aborted, true);
  const current = owner.load(); requests[0].resolve({}); await old; assert.equal(owner.failed.value, false); assert.equal(owner.isLoading.value, true);
  requests[1].resolve(payload); await current; assert.deepEqual(owner.status.value, valid);
  const stale = owner.load(); owner.invalidate(); const healthy = owner.load(); requests[2].reject(new Error('PRIVATE-input-sentinel')); await stale;
  requests[3].resolve(payload); await healthy; assert.deepEqual(owner.status.value, valid); owner.dispose();
});
test('Apple deadline retires browser state and prevents late publication', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = Promise.withResolvers(); let signal;
  const owner = useAppleMusicSigningStatus({ fetchStatus: options => { signal = options.signal; return pending.promise; } });
  const work = owner.load(); t.mock.timers.tick(15_000);
  assert.equal(signal.aborted, true); assert.equal(owner.isLoading.value, false); assert.equal(owner.failed.value, true);
  pending.resolve(payload); await work; assert.equal(owner.status.value, null); owner.dispose();
});
test('Apple scope disposal aborts the request and closes future admission', async () => {
  const scope = effectScope(), pending = Promise.withResolvers(); let signal, calls = 0;
  const owner = scope.run(() => useAppleMusicSigningStatus({ fetchStatus: options => { signal = options.signal; calls++; return pending.promise; } }));
  const work = owner.load(); scope.stop(); assert.equal(signal.aborted, true); assert.equal(await owner.load(), null); assert.equal(calls, 1);
  pending.resolve(payload); await work; assert.equal(owner.status.value, null);
});
