/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive, ref } from 'vue';
import { usePasswordConfirmation } from '../../src/client/composables/usePasswordConfirmation.js';

test('confirmation validates locally, focuses after its state update and clears mismatch when either field changes', async t => {
  const previous = globalThis.document; const invoker = {}; let focused = 0;
  globalThis.document = { activeElement: invoker }; t.after(() => { globalThis.document = previous; });
  const form = reactive({ password: 'first', confirm: 'different' });
  const state = usePasswordConfirmation(() => form.password, () => form.confirm, ref({ focus() {
    assert.equal(state.showMismatch.value, true); focused++;
  } }));
  assert.equal(state.showMismatch.value, false); assert.equal(await state.validate(), false); assert.equal(focused, 1);
  form.password = 'different'; assert.equal(state.showMismatch.value, false); assert.equal(state.showMatch.value, true);
  assert.equal(await state.validate(), true); assert.equal(focused, 1);
  form.confirm = 'third'; assert.equal(state.showMismatch.value, true);
  form.password = 'third'; assert.equal(state.showMismatch.value, false);
  form.confirm = 'fourth'; const correcting = state.validate(); form.password = 'fourth';
  assert.equal(await correcting, false); assert.equal(focused, 1, 'a corrected field must not receive stale error focus');
});

test('confirmation never replaces a later focus owner or focuses an unmounted input', async t => {
  const previous = globalThis.document; globalThis.document = { activeElement: {} };
  t.after(() => { globalThis.document = previous; });
  let focused = 0; const input = ref({ focus() { focused++; } });
  const state = usePasswordConfirmation(() => 'first', () => 'second', input);
  const pending = state.validate(); globalThis.document.activeElement = {};
  assert.equal(await pending, false); assert.equal(focused, 0);
  const unmounted = state.validate(); input.value = null;
  assert.equal(await unmounted, false); assert.equal(focused, 0);
});
