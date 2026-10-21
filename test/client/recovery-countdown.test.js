/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { useExpiryCountdown } from '../../src/client/composables/useExpiryCountdown.js';
import { useRecoveryStatus } from '../../src/client/composables/useRecoveryStatus.js';

const start = Date.parse('2026-10-21T12:00:00Z');
const available = expiresAt => ({ recoveryAvailable: true, blockedByLock: false, remainingAttempts: 5, expiresAt });
function clock(t) { t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: start }); }
function owner(t, options = {}) {
  const state = useRecoveryStatus({ pollIntervalMs: 0,
    fetchRecoveryStatus: async () => available(new Date(start + 90_000).toISOString()), ...options });
  t.after(() => state.destroy()); return state;
}

test('unchanged recovery expiry counts down without polling and catches a late timer at the exact deadline', async t => {
  clock(t); let reads = 0;
  const state = owner(t, { fetchRecoveryStatus: async () => { reads++; return available(new Date(start + 90_000).toISOString()); } });
  await state.loadStatus(); assert.equal(state.secondsRemaining.value, 90);
  t.mock.timers.tick(1000); assert.equal(state.secondsRemaining.value, 89); assert.equal(reads, 1);
  t.mock.timers.setTime(start + 89_999); t.mock.timers.tick(0);
  assert.equal(state.secondsRemaining.value, 1); assert.equal(state.canSubmit.value, true);
  t.mock.timers.tick(1);
  assert.equal(state.secondsRemaining.value, 0); assert.equal(state.expired.value, true); assert.equal(state.canSubmit.value, false);
  t.mock.timers.tick(100_000); assert.equal(state.secondsRemaining.value, 0); assert.equal(reads, 1);
});

test('submission refreshes a suspended clock before admission and again after the DOM flush', async t => {
  clock(t); let posts = 0;
  const completeRecovery = async () => { posts++; return { success: true }; };
  const suspended = owner(t, { completeRecovery }); await suspended.loadStatus();
  assert.equal(suspended.canSubmit.value, true);
  t.mock.timers.setTime(start + 90_000); // No timer callback has run.
  assert.equal(suspended.secondsRemaining.value, 90);
  assert.equal(await suspended.submitRecovery({}), null); assert.equal(suspended.expired.value, true); assert.equal(posts, 0);
  t.mock.timers.setTime(start);
  const crossing = owner(t, { completeRecovery }); await crossing.loadStatus();
  const pending = crossing.submitRecovery({}); t.mock.timers.setTime(start + 90_000);
  assert.equal(await pending, null); assert.equal(posts, 0); assert.equal(crossing.isSubmitting.value, false);
});

test('tab wake refreshes immediately while the status read is held and a failed read cannot revive expired admission', async t => {
  clock(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = new EventTarget(); document.hidden = false;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  const held = Promise.withResolvers(); let reads = 0;
  const state = owner(t, { revalidateOnFocus: true, fetchRecoveryStatus: async () => ++reads === 1
    ? available(new Date(start + 90_000).toISOString()) : held.promise });
  t.after(() => held.reject(new Error('offline')));
  state.attachVisibilityListener(); state.attachVisibilityListener(); await state.loadStatus();
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  t.mock.timers.setTime(start + 91_000); // Hidden display has no ticking owner.
  t.mock.timers.tick(0);
  assert.equal(state.secondsRemaining.value, 90); assert.equal(reads, 1);
  document.hidden = false; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(state.secondsRemaining.value, 0); assert.equal(state.canSubmit.value, false); assert.equal(reads, 2);
  held.reject(new Error('offline')); await state.revalidate(); assert.equal(state.canSubmit.value, false);
  state.destroy(); state.destroy(); const after = reads;
  document.dispatchEvent(new Event('visibilitychange')); t.mock.timers.tick(100_000); assert.equal(reads, after);
});

test('a newly accepted run replaces the deadline; malformed or absent expiry refuses submission', async t => {
  clock(t); let result = available(new Date(start + 1000).toISOString()); let posts = 0;
  const state = owner(t, { fetchRecoveryStatus: async () => result, completeRecovery: async () => { posts++; } });
  await state.loadStatus(); t.mock.timers.tick(1000); assert.equal(state.expired.value, true);
  result = available(new Date(start + 60_000).toISOString()); await state.revalidate();
  assert.equal(state.secondsRemaining.value, 59); assert.equal(state.canSubmit.value, true);
  for (const expiresAt of [null, '', 'invalid-date']) {
    result = available(expiresAt); await state.revalidate();
    assert.equal(state.secondsRemaining.value, 0); assert.equal(state.expired.value, true);
    assert.equal(await state.submitRecovery({}), null);
  }
  assert.equal(posts, 0);
});

test('completion retires the display timer and destroy fences late status publication', async t => {
  clock(t);
  const completed = owner(t, { completeRecovery: async () => ({ success: true }) });
  await completed.loadStatus(); await completed.submitRecovery({});
  const remaining = completed.secondsRemaining.value;
  t.mock.timers.tick(1000); assert.equal(completed.secondsRemaining.value, remaining); assert.equal(completed.canSubmit.value, false);
  const held = Promise.withResolvers(); const late = owner(t, { fetchRecoveryStatus: () => held.promise });
  const pending = late.loadStatus(); late.destroy(); held.resolve(available(new Date(start + 90_000).toISOString())); await pending;
  t.mock.timers.tick(100_000); assert.equal(late.status.value, null); assert.equal(late.secondsRemaining.value, 0);
});

test('destroy cancels the owned timer and refuses later refresh without reading deadline getters', t => {
  clock(t); let reads = 0;
  const countdown = useExpiryCountdown({ getExpiresAt: () => { reads++; return new Date(start + 90_000).toISOString(); }, isActive: () => true });
  t.after(() => countdown.destroy()); countdown.refresh(); t.mock.timers.tick(1000);
  assert.equal(countdown.secondsRemaining.value, 89); const before = reads;
  countdown.destroy(); countdown.destroy(); countdown.refresh(); t.mock.timers.tick(100_000);
  assert.equal(reads, before); assert.equal(countdown.secondsRemaining.value, 89);
});
