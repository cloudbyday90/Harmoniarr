/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick } from 'vue';
import { useRecoveryStatus } from '../../src/client/composables/useRecoveryStatus.js';

const available = overrides => ({ recoveryAvailable: true, blockedByLock: false, remainingAttempts: 5,
  expiresAt: new Date(Date.now() + 300_000).toISOString(), ...overrides });

test('recovery owns a single POST through failure refresh and preserves Error/null with current attempt count', async t => {
  for (const failure of [new Error('Recovery code is invalid or expired'), null]) {
    const request = Promise.withResolvers(); const refresh = Promise.withResolvers(); let reads = 0; let posts = 0;
    const state = useRecoveryStatus({ pollIntervalMs: 0,
      fetchRecoveryStatus: async () => ++reads === 1 ? available() : refresh.promise,
      completeRecovery: async () => { posts++; return request.promise; } });
    t.after(() => state.destroy()); await state.loadStatus();
    const pending = state.submitRecovery({ username: 'fixture' }); let rejected = false;
    const outcome = pending.catch(error => { rejected = true; assert.equal(error, failure); });
    t.after(async () => { request.reject(failure); refresh.resolve(available({ remainingAttempts: 4 })); await outcome; });
    await nextTick(); assert.equal(posts, 1); assert.equal(await state.submitRecovery({}), null);
    request.reject(failure); await nextTick(); await nextTick();
    assert.equal(state.isSubmitting.value, true); assert.equal(state.isLoading.value, false);
    assert.equal(state.errorMessage.value, failure === null ? 'Recovery failed' : failure.message);
    assert.equal(await state.submitRecovery({}), null); assert.equal(posts, 1);
    refresh.resolve(available({ remainingAttempts: 4 })); await outcome;
    assert.equal(rejected, true); assert.equal(state.remainingAttempts.value, 4); assert.equal(state.isSubmitting.value, false);
    assert.equal(state.errorMessage.value, failure === null ? 'Recovery failed' : failure.message);
  }
});

test('late status reads cannot overwrite a newer read, completed recovery or destroyed state', async t => {
  const gates = []; let reads = 0;
  const state = useRecoveryStatus({ pollIntervalMs: 0, completeRecovery: async () => ({ success: true }),
    fetchRecoveryStatus: async () => { if (++reads === 1) return available(); const gate = Promise.withResolvers(); gates.push(gate); return gate.promise; } });
  t.after(() => state.destroy()); await state.loadStatus();
  const older = state.revalidate(); const newer = state.revalidate();
  gates[1].resolve(available({ remainingAttempts: 4 })); await newer;
  gates[0].resolve(available()); await older; assert.equal(state.remainingAttempts.value, 4);
  const delayed = state.revalidate(); await state.submitRecovery({});
  gates[2].resolve({ recoveryAvailable: false }); await delayed;
  assert.equal(state.isCompleted.value, true); assert.equal(state.recoveryAvailable.value, true);
  assert.deepEqual(state.completionResult.value, { success: true }); assert.equal(await state.submitRecovery({}), null);
  await state.loadStatus(); await state.revalidate(); assert.equal(reads, 4);
  const disposed = useRecoveryStatus({ pollIntervalMs: 0, fetchRecoveryStatus: () => gates[3].promise });
  gates.push(Promise.withResolvers()); const loading = disposed.loadStatus(); disposed.destroy();
  gates[3].resolve(available()); await loading; assert.equal(disposed.status.value, null);
});

test('unavailable, expired, held, exhausted and destroyed recovery refuse client submission before feedback/request changes', async () => {
  for (const status of [{ recoveryAvailable: false }, available({ blockedByLock: true }), available({ remainingAttempts: 0 }),
    available({ expiresAt: new Date(Date.now() - 1000).toISOString() })]) {
    let posts = 0; const state = useRecoveryStatus({ pollIntervalMs: 0, fetchRecoveryStatus: async () => status,
      completeRecovery: async () => { posts++; } });
    await state.loadStatus(); state.errorMessage.value = 'retained'; assert.equal(await state.submitRecovery({}), null);
    assert.equal(posts, 0); assert.equal(state.errorMessage.value, 'retained'); state.destroy();
  }
  let posts = 0; const state = useRecoveryStatus({ pollIntervalMs: 0, fetchRecoveryStatus: async () => available(),
    completeRecovery: async () => { posts++; } });
  await state.loadStatus(); const pending = state.submitRecovery({}); state.destroy(); await pending; assert.equal(posts, 0);
});

test('a failed recovery status refresh retains the original rejection and visibility cleanup is idempotent', async t => {
  const previous = globalThis.document; const listeners = new Set();
  globalThis.document = { addEventListener(_event, fn) { listeners.add(fn); }, removeEventListener(_event, fn) { listeners.delete(fn); } };
  t.after(() => { globalThis.document = previous; });
  let reads = 0; const failure = new Error('original recovery failure');
  const state = useRecoveryStatus({ revalidateOnFocus: true, pollIntervalMs: 0,
    fetchRecoveryStatus: async () => { if (++reads === 1) return available(); throw new Error('status unavailable'); },
    completeRecovery: async () => { throw failure; } });
  state.attachVisibilityListener(); state.attachVisibilityListener(); assert.equal(listeners.size, 1);
  await state.loadStatus(); await assert.rejects(state.submitRecovery({}), error => error === failure);
  assert.equal(state.errorMessage.value, failure.message); assert.equal(state.remainingAttempts.value, 5);
  state.destroy(); state.destroy(); state.attachVisibilityListener(); assert.equal(listeners.size, 0);
});
