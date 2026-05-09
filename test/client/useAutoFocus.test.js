import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useAutoFocus } from '../../src/client/composables/useAutoFocus.js';

// Injects synchronous lifecycle and nextTick so tests don't need a mounted
// Vue component or a real DOM.

function makeDeps({ callMounted = true } = {}) {
  return {
    onMountedFn: callMounted ? (cb) => void cb() : () => {},
    nextTickFn: () => Promise.resolve(),
  };
}

test('useAutoFocus calls focus on the element ref after mount and nextTick', async (t) => {
  const focus = t.mock.fn();
  const elementRef = ref({ focus });

  useAutoFocus(elementRef, makeDeps());

  // Drain the microtask queue so the nextTick().then() callback fires.
  await Promise.resolve();

  assert.equal(focus.mock.callCount(), 1);
});

test('useAutoFocus does not throw when element ref value is null', async () => {
  const elementRef = ref(null);

  useAutoFocus(elementRef, makeDeps());

  await Promise.resolve();

  // No assertion needed — reaching here without throwing is the contract.
});

test('useAutoFocus does not call focus when onMountedFn never invokes its callback', async (t) => {
  const focus = t.mock.fn();
  const elementRef = ref({ focus });

  useAutoFocus(elementRef, makeDeps({ callMounted: false }));

  await Promise.resolve();

  assert.equal(focus.mock.callCount(), 0);
});

test('useAutoFocus only calls focus once per mount', async (t) => {
  const focus = t.mock.fn();
  const elementRef = ref({ focus });

  useAutoFocus(elementRef, makeDeps());

  await Promise.resolve();

  assert.equal(focus.mock.callCount(), 1);
});
