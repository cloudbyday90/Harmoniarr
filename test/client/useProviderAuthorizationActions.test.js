/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick } from 'vue';
import { useProviderAuthorizationActions } from '../../src/client/composables/useProviderAuthorizationActions.js';

const commands = [['spotify', 'start'], ['spotify', 'clear'], ['youtube', 'start'], ['youtube', 'clear']];
const pageEvent = persisted => { const event = new Event('pageshow'); Object.defineProperty(event, 'persisted', { value: persisted }); return event; };
function fixture(overrides = {}) {
  const calls = [], cleared = [], redirects = [], page = new EventTarget();
  const fn = (provider, kind) => async () => { calls.push([provider, kind]); return kind === 'start' ? { authorizationUrl: 'https://provider.example/authorize' } : { status: { linked: false } }; };
  const owner = useProviderAuthorizationActions({ start: { spotify: fn('spotify', 'start'), youtube: fn('youtube', 'start') },
    clear: { spotify: fn('spotify', 'clear'), youtube: fn('youtube', 'clear') }, pageTarget: page,
    onCleared: (provider, status) => cleared.push({ provider, status }), redirectToUrl: url => redirects.push(url), ...overrides });
  return { owner, calls, cleared, redirects, page };
}
for (const [provider, kind] of commands) {
  test(`${provider} ${kind} owns duplicate and competing admission until its actual response settles`, async () => {
    const held = Promise.withResolvers(); let calls = 0;
    const command = async () => { calls++; return held.promise; };
    const { owner, page } = fixture({ start: { spotify: command, youtube: command }, clear: { spotify: command, youtube: command } });
    const first = owner.run(provider, kind), before = owner.feedback.value;
    for (const [other, action] of commands) assert.equal(await owner.run(other, action), false);
    owner.clearFeedback(); page.dispatchEvent(pageEvent(true));
    assert.deepEqual(owner.feedback.value, before); assert.equal(owner.isPending.value, true); assert.equal(calls, 1);
    held.reject(new Proxy({}, { get() { assert.fail('Failure diagnostics read'); } }));
    assert.equal(await first, false); assert.equal(calls, 1); assert.equal(owner.isPending.value, false);
    assert.equal(owner.feedback.value.tone, 'danger'); assert.match(owner.feedback.value.message, /could not be confirmed/u); owner.dispose();
  });
}
test('clear publishes only confirmed saved absence; malformed results never publish a false clear', async () => {
  for (const response of [null, {}, { status: { linked: true } }, { status: { linked: 'false' } }, { status: { linked: false } }]) {
    const { owner, cleared } = fixture({ clear: { spotify: async () => response } });
    assert.equal(await owner.run('spotify', 'clear'), response?.status?.linked === false);
    assert.equal(cleared.length, response?.status?.linked === false ? 1 : 0); assert.equal(owner.isPending.value, false); owner.dispose();
  }
});
test('acknowledged start keeps handoff ownership; only persisted return retires it without another POST', async () => {
  const { owner, calls, redirects, page } = fixture();
  assert.equal(await owner.run('spotify', 'start'), true); assert.equal(redirects.length, 1); assert.equal(owner.isPending.value, true);
  for (const pair of commands) assert.equal(await owner.run(...pair), false);
  page.dispatchEvent(pageEvent(false)); assert.equal(owner.isPending.value, true);
  page.dispatchEvent(pageEvent(true)); assert.equal(owner.isPending.value, false); assert.equal(calls.length, 1);
  assert.match(owner.feedback.value.message, /Reload Connections/u);
  await owner.run('youtube', 'clear'); assert.equal(calls.length, 2); assert.equal(owner.feedback.value.tone, 'success'); owner.dispose();
});
test('navigation failure has fixed guidance, releases admission and does not replay the acknowledged start', async () => {
  const { owner, calls } = fixture({ redirectToUrl: async () => { throw new Error('PRIVATE navigation'); } });
  assert.equal(await owner.run('youtube', 'start'), false); assert.equal(calls.length, 1); assert.equal(owner.isPending.value, false);
  assert.match(owner.feedback.value.message, /could not be opened/u); assert.doesNotMatch(owner.feedback.value.message, /PRIVATE/u);
  await owner.run('spotify', 'clear'); assert.equal(calls.length, 2); owner.dispose();
});
test('malformed start acknowledgement cannot navigate or claim provider completion', async () => {
  const { owner, redirects } = fixture({ start: { spotify: async () => ({ authorizationUrl: null, accessToken: 'PRIVATE' }) } });
  assert.equal(await owner.run('spotify', 'start'), false); assert.deepEqual(redirects, []);
  assert.equal(owner.isPending.value, false); assert.doesNotMatch(owner.feedback.value.message, /PRIVATE/u); owner.dispose();
});
test('disposal before dispatch and after dispatch suppresses late status, feedback and navigation without abort/replay', async () => {
  const early = fixture(), first = early.owner.run('spotify', 'clear'); early.owner.dispose(); await first; assert.equal(early.calls.length, 0);
  for (const kind of ['start', 'clear']) {
    const held = Promise.withResolvers(), scope = effectScope(); let writes = 0;
    const f = scope.run(() => fixture({ [kind]: { spotify: async () => held.promise }, onFeedback: () => { writes++; } }));
    const work = f.owner.run('spotify', kind); await nextTick(); const before = writes;
    scope.stop(); assert.equal(f.owner.isPending.value, false); assert.equal(await f.owner.run('youtube', 'clear'), false);
    f.page.dispatchEvent(pageEvent(true)); held.resolve(kind === 'start' ? { authorizationUrl: 'https://provider.example' } : { status: { linked: false } });
    await work; assert.equal(writes, before); assert.deepEqual(f.cleared, []); assert.deepEqual(f.redirects, []); assert.equal(f.owner.feedback.value, null);
  }
});
test('late navigation rejection after a persisted return cannot replace a newer action outcome', async () => {
  const held = Promise.withResolvers(), { owner, page } = fixture({ redirectToUrl: () => held.promise });
  const work = owner.run('spotify', 'start'); await nextTick(); await nextTick();
  page.dispatchEvent(pageEvent(true)); await owner.run('youtube', 'clear');
  const result = owner.feedback.value; held.reject(new Error('PRIVATE')); await work; assert.deepEqual(owner.feedback.value, result); owner.dispose();
});
test('unsupported commands and denied settings admission leave feedback and API untouched', async () => {
  const { owner, calls } = fixture({ canRun: () => false });
  for (const pair of [...commands, ['__proto__', 'start'], ['spotify', 'PRIVATE']]) assert.equal(await owner.run(...pair), false);
  assert.deepEqual(calls, []); assert.equal(owner.feedback.value, null); owner.dispose();
});

test('scope cleanup removes its exact page listener and synchronous publication cannot outlive disposal', async t => {
  const added = t.mock.fn(), removed = t.mock.fn(), scope = effectScope();
  scope.run(() => fixture({ pageTarget: { addEventListener: added, removeEventListener: removed } }));
  assert.equal(added.mock.callCount(), 1); scope.stop(); assert.equal(removed.mock.callCount(), 1);
  assert.deepEqual(removed.mock.calls[0].arguments, added.mock.calls[0].arguments);
  let closing;
  const next = fixture({ onFeedback: value => { if (value?.message.startsWith('Opening')) closing.dispose(); } }); closing = next.owner;
  assert.equal(await next.owner.run('spotify', 'start'), false); assert.deepEqual(next.redirects, []);
});
