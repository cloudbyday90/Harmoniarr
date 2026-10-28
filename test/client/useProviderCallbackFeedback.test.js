/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useProviderCallbackFeedback } from '../../src/client/composables/useProviderCallbackFeedback.js';
const intent = { provider: 'spotify', guidance: 'check' };
const payload = linked => ({ spotify: { linked }, statusSummary: { state: 'complete', unavailableProviders: [] } });

test('a callback checks saved state once, refuses pending duplicates and permits explicit retry', async () => {
  const held = Promise.withResolvers(); let calls = 0;
  const owner = useProviderCallbackFeedback({ fetchStatus: options => { calls++; assert.deepEqual(Object.keys(options), ['signal']); return held.promise; } });
  const first = owner.accept(intent, true); await owner.check(); assert.equal(calls, 1);
  assert.match(owner.feedback.value.message, /^Checking/u);
  held.resolve(payload(false)); await first; assert.match(owner.feedback.value.message, /no saved Spotify link/u);
  await owner.check(); assert.equal(calls, 2); owner.dispose();
});
test('unknown or non-administrator returns never read and role loss discards an in-flight observation', async () => {
  const held = Promise.withResolvers(); let calls = 0, signal;
  const owner = useProviderCallbackFeedback({ fetchStatus: options => { calls++; signal = options.signal; return held.promise; } });
  await owner.accept({ provider: null, guidance: 'review' }, true); await owner.accept(intent, false); await owner.check(); assert.equal(calls, 0);
  const first = owner.accept(intent, true); owner.setPermission(false); assert.equal(signal.aborted, true);
  held.resolve(payload(true)); await first; assert.match(owner.feedback.value.message, /administrator/u);
  await owner.check(); assert.equal(calls, 1); owner.setPermission(true); assert.equal(calls, 1); owner.dispose();
});
test('new return intent fences stale success and stale rejection even when transport ignores abort', async () => {
  const pending = [], owner = useProviderCallbackFeedback({ fetchStatus: ({ signal }) => { const held = Promise.withResolvers(); pending.push({ ...held, signal }); return held.promise; } });
  const first = owner.accept(intent, true), second = owner.accept(intent, true); assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(payload(false)); await second; pending[0].resolve(payload(true)); await first;
  assert.match(owner.feedback.value.message, /no saved/u);
  const third = owner.accept(intent, true), fourth = owner.accept(intent, true);
  pending[2].reject(new Error('PRIVATE')); await third; assert.equal(owner.isLoading.value, true);
  pending[3].resolve(payload(true)); await fourth; assert.match(owner.feedback.value.message, /found a saved/u); owner.dispose();
});
test('read rejection and malformed status clear earlier observations without diagnostic echo', async () => {
  let response = payload(true);
  const owner = useProviderCallbackFeedback({ fetchStatus: async () => { if (response instanceof Error) throw response; return response; } });
  await owner.accept(intent, true); assert.match(owner.feedback.value.message, /found a saved/u);
  for (const value of [new Error('PRIVATE'), {}, payload('PRIVATE')]) {
    response = value; await owner.check(); assert.match(owner.feedback.value.message, /could not be checked/u); assert.doesNotMatch(JSON.stringify(owner.feedback.value), /PRIVATE/u);
  }
  owner.markCleanupFailed(); assert.match(owner.feedback.value.message, /could not be cleared/u);
  response = payload(false); await owner.accept(intent, true); assert.doesNotMatch(owner.feedback.value.message, /could not be cleared/u); owner.dispose();
});
test('deadline aborts a held check and later completion cannot replace an explicit retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = [], owner = useProviderCallbackFeedback({ fetchStatus: ({ signal }) => { const held = Promise.withResolvers(); pending.push({ ...held, signal }); return held.promise; } });
  const first = owner.accept(intent, true); t.mock.timers.tick(15_000);
  assert.equal(pending[0].signal.aborted, true); assert.equal(owner.isLoading.value, false); assert.match(owner.feedback.value.message, /could not be checked/u);
  const second = owner.check(); pending[0].resolve(payload(true)); await first; assert.equal(owner.isLoading.value, true);
  pending[1].resolve(payload(false)); await second; assert.match(owner.feedback.value.message, /no saved/u); owner.dispose();
});
test('scope disposal closes admission and ignores later completion and intents', async () => {
  const scope = effectScope(), held = Promise.withResolvers(); let signal, calls = 0;
  const owner = scope.run(() => useProviderCallbackFeedback({ fetchStatus: options => { calls++; signal = options.signal; return held.promise; } }));
  const first = owner.accept(intent, true); scope.stop(); assert.equal(signal.aborted, true);
  await owner.accept(intent, true); await owner.check(); owner.setPermission(true); owner.markCleanupFailed(); assert.equal(calls, 1);
  held.resolve(payload(true)); await first; assert.equal(owner.intent.value, null); assert.equal(owner.feedback.value.message, '');
});
