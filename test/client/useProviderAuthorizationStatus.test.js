/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, reactive } from 'vue';
import { useProviderAuthorizationStatus } from '../../src/client/composables/useProviderAuthorizationStatus.js';

const payload = (linked, provider = 'spotify') => ({ [provider]: { provider, linked, accessToken: 'PRIVATE' }, statusSummary: { state: 'complete', unavailableProviders: [] } });
function fixture(options = {}) {
  const session = reactive({ authenticated: true, user: { id: 'admin', role: 'admin', mustChangePassword: false }, csrfToken: 'fixture' });
  const calls = [], writes = [];
  const owner = useProviderAuthorizationStatus({ getSession: () => session,
    fetchSessionFn: async ({ signal }) => { calls.push(['session', signal]); return { user: { ...session.user }, csrfToken: session.csrfToken }; },
    fetchStatusFn: async ({ signal }) => { calls.push(['status', signal]); return payload(true); },
    onObserved: (...args) => writes.push(args), ...options });
  return { owner, session, calls, writes };
}
test('one review checks the same session before bounded target projection and keeps a reusable retry', async () => {
  const f = fixture(); assert.equal(f.owner.feedback.value, null);
  assert.equal(await f.owner.review('spotify'), true); assert.deepEqual(f.calls.map(([name]) => name), ['session', 'status']);
  assert.equal(f.calls[0][1], f.calls[1][1]); assert.deepEqual(f.writes, [['spotify', true]]);
  assert.match(f.owner.feedback.value.message, /Last check found a saved Spotify/u); assert.doesNotMatch(f.owner.feedback.value.message, /PRIVATE/u);
  await f.owner.check(); assert.equal(f.calls.length, 4); f.owner.dispose();
});
test('pending retry is coalesced through both reads', async () => {
  const session = Promise.withResolvers(), status = Promise.withResolvers(); let reads = 0;
  const f = fixture({ fetchSessionFn: async () => { reads++; return session.promise; }, fetchStatusFn: async () => { reads++; return status.promise; } });
  const work = f.owner.review('spotify'); await nextTick(); await f.owner.check(); assert.equal(reads, 1);
  session.resolve({ user: { id: 'admin', role: 'admin', mustChangePassword: false }, csrfToken: 'fixture' }); await nextTick(); await nextTick();
  await f.owner.check(); assert.equal(reads, 2); status.resolve(payload(false)); await work;
  assert.deepEqual(f.writes, [['spotify', false]]); f.owner.dispose();
});
for (const response of [null, {}, { user: null }, { user: { id: 'other', role: 'admin', mustChangePassword: false }, csrfToken: 'fixture' },
  { user: { id: 'admin', role: 'operator', mustChangePassword: false }, csrfToken: 'fixture' },
  { user: { id: 'admin', role: 'admin', mustChangePassword: true }, csrfToken: 'fixture' },
  { user: { id: 'admin', role: 'admin', mustChangePassword: false }, csrfToken: 'different' }]) {
  test(`unconfirmed session ${JSON.stringify(response?.user ?? response)} refuses provider reads and local command admission`, async () => {
    const f = fixture({ fetchSessionFn: async () => response });
    assert.equal(await f.owner.review('spotify'), false); assert.equal(f.owner.sessionBlocked.value, true);
    assert.deepEqual(f.calls, []); assert.deepEqual(f.writes, []); assert.match(f.owner.feedback.value.message, /administrator session/u); f.owner.dispose();
  });
}
test('local session loss closes publication even when the transport ignores abort', async () => {
  const held = Promise.withResolvers(); let signal;
  const f = fixture({ fetchStatusFn: ({ signal: value }) => { signal = value; return held.promise; } });
  const work = f.owner.review('spotify'); await nextTick(); await nextTick();
  f.session.user.role = 'requester'; assert.equal(signal.aborted, true); assert.equal(f.owner.isChecking.value, false);
  held.resolve(payload(true)); await work; assert.deepEqual(f.writes, []); assert.equal(f.owner.sessionBlocked.value, true);
  await f.owner.check(); assert.equal(f.calls.length, 1); f.owner.dispose();
});
test('new context fences late success and failure and explicit retry can recover session refusal', async () => {
  const pending = [], f = fixture({ fetchStatusFn: ({ signal }) => { const held = Promise.withResolvers(); pending.push({ ...held, signal }); return held.promise; } });
  const first = f.owner.review('spotify'); await nextTick(); await nextTick(); f.owner.reset();
  const second = f.owner.review('youtube'); await nextTick(); await nextTick();
  assert.equal(pending[0].signal.aborted, true); pending[1].resolve(payload(false, 'youtube')); await second;
  pending[0].resolve(payload(true)); await first; assert.deepEqual(f.writes, [['youtube', false]]);
  const third = f.owner.check(); await nextTick(); await nextTick(); f.session.csrfToken = 'new-context';
  pending[2].reject(new Error('PRIVATE')); await third; assert.equal(f.owner.sessionBlocked.value, true);
  const fourth = f.owner.check(); await nextTick(); await nextTick(); pending[3].resolve(payload(true, 'youtube')); await fourth;
  assert.equal(f.owner.sessionBlocked.value, false); assert.deepEqual(f.writes, [['youtube', false], ['youtube', true]]); f.owner.dispose();
});
test('unavailable, malformed and rejected status retain older card data and fixed feedback', async () => {
  for (const response of [null, {}, { ...payload(true), statusSummary: { state: 'partial', unavailableProviders: ['spotify'] } },
    { ...payload(true), spotify: { linked: 'false' } }, new Proxy({}, { get() { throw new Error('Diagnostic read'); } })]) {
    const f = fixture({ fetchStatusFn: async () => { if (response && !Object.hasOwn(response, 'statusSummary')) throw response; return response; } });
    assert.equal(await f.owner.review('spotify'), false); assert.deepEqual(f.writes, []);
    assert.match(f.owner.feedback.value.message, /could not be checked/u); assert.equal(f.owner.sessionBlocked.value, false); f.owner.dispose();
  }
});
test('session read failure never reads diagnostics and an explicit subsequent check can recover', async () => {
  let fail = true;
  const f = fixture({ fetchSessionFn: async () => { if (fail) throw new Proxy({}, { get() { assert.fail('Diagnostic read'); } }); return { user: { ...f.session.user }, csrfToken: f.session.csrfToken }; } });
  await f.owner.review('spotify'); assert.equal(f.owner.sessionBlocked.value, true); assert.equal(f.calls.length, 0);
  fail = false; await f.owner.check(); assert.equal(f.owner.sessionBlocked.value, false); assert.deepEqual(f.writes, [['spotify', true]]); f.owner.dispose();
});
test('deadline releases only its read and ignores a late response after an explicit retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const held = Promise.withResolvers(); let signal, reads = 0;
  const f = fixture({ timeoutMs: 50, fetchStatusFn: ({ signal: value }) => { reads++; if (reads > 1) return payload(false); signal = value; return held.promise; } });
  const work = f.owner.review('spotify'); await nextTick(); await nextTick(); t.mock.timers.tick(50);
  assert.equal(signal.aborted, true); assert.equal(f.owner.isChecking.value, false); assert.equal(f.owner.sessionBlocked.value, false);
  await f.owner.check(); held.resolve(payload(true)); await work; assert.deepEqual(f.writes, [['spotify', false]]); f.owner.dispose();
});
test('scope disposal aborts the read, closes later admission and prevents publication', async () => {
  const scope = effectScope(), held = Promise.withResolvers(); let signal;
  const f = scope.run(() => fixture({ fetchSessionFn: ({ signal: value }) => { signal = value; return held.promise; } }));
  const work = f.owner.review('spotify'); await nextTick(); scope.stop(); assert.equal(signal.aborted, true);
  held.resolve({ user: { ...f.session.user }, csrfToken: f.session.csrfToken }); await work;
  assert.deepEqual(f.writes, []); assert.equal(await f.owner.check(), false); assert.equal(f.owner.feedback.value, null);
});
test('session deadline blocks local commands and never advances to the provider read', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const held = Promise.withResolvers(); let signal;
  const f = fixture({ timeoutMs: 50, fetchSessionFn: ({ signal: value }) => { signal = value; return held.promise; } });
  const work = f.owner.review('spotify'); await nextTick(); t.mock.timers.tick(50);
  assert.equal(signal.aborted, true); assert.equal(f.owner.sessionBlocked.value, true); assert.equal(f.owner.isChecking.value, false);
  held.resolve({ user: { ...f.session.user }, csrfToken: f.session.csrfToken }); await work;
  assert.deepEqual(f.calls, []); assert.deepEqual(f.writes, []); f.owner.dispose();
});
test('invalid and denied intent does not start reads; invalid bounds are refused', async () => {
  const f = fixture({ canCheck: () => false });
  for (const value of ['spotify', '__proto__', null]) assert.equal(await f.owner.review(value), false);
  assert.deepEqual(f.calls, []); assert.equal(f.owner.feedback.value, null); f.owner.dispose();
  assert.throws(() => fixture({ timeoutMs: 0 }), /timeout/u);
});
