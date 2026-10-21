/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick } from 'vue';
import { useAuthSubmission } from '../../src/client/composables/useAuthSubmission.js';

test('auth submission admits one request/navigation owner and preserves its feedback through competing actions', async () => {
  const state = useAuthSubmission(); const gate = Promise.withResolvers(); let calls = 0;
  const pending = state.run(async () => { calls++; await gate.promise; }, { name: 'login', pendingText: 'Logging in…' });
  assert.equal(state.activeAction.value, 'login'); assert.equal(state.isSubmitting.value, true);
  assert.equal(await state.run(() => { calls++; }, { name: 'plex', pendingText: 'Opening Plex…' }), false);
  assert.equal(state.pendingMessage.value, 'Logging in…'); assert.equal(calls, 1);
  gate.resolve(); assert.equal(await pending, true);
  assert.equal(state.isSubmitting.value, false); assert.equal(state.activeAction.value, null); assert.equal(state.pendingMessage.value, '');
});

test('auth failures clear before a repeated immediate failure, retain safe text and permit an explicit retry', async () => {
  const state = useAuthSubmission();
  for (const failure of [new Error('Generic authentication failure'), null]) {
    assert.equal(await state.run(() => { throw failure; }, { fallbackMessage: 'Sign-in failed' }), false);
    const message = failure === null ? 'Sign-in failed' : failure.message;
    assert.equal(state.errorMessage.value, message); assert.equal(state.isSubmitting.value, false);
    const retry = state.run(() => { assert.equal(state.errorMessage.value, ''); throw failure; }, { fallbackMessage: 'Sign-in failed' });
    assert.equal(state.errorMessage.value, ''); await nextTick();
    assert.equal(await retry, false); assert.equal(state.errorMessage.value, message);
  }
  assert.equal(await state.run(async () => {}), true); assert.equal(state.errorMessage.value, '');
});
