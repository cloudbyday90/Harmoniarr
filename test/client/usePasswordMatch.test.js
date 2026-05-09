import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { usePasswordMatch } from '../../src/client/composables/usePasswordMatch.js';

// ── initial state ─────────────────────────────────────────────────────────────

test('usePasswordMatch: isTouched starts false', () => {
  const { isTouched } = usePasswordMatch(() => '', () => '');

  assert.equal(isTouched.value, false);
});

test('usePasswordMatch: showMismatch is false before touched even when passwords differ', () => {
  const { showMismatch } = usePasswordMatch(() => 'abc', () => 'xyz');

  assert.equal(showMismatch.value, false);
});

test('usePasswordMatch: showMatch is false before touched even when passwords match', () => {
  const { showMatch } = usePasswordMatch(() => 'abc', () => 'abc');

  assert.equal(showMatch.value, false);
});

// ── after markTouched ─────────────────────────────────────────────────────────

test('usePasswordMatch: showMismatch is true after touch when passwords differ', () => {
  const { markTouched, showMismatch } = usePasswordMatch(() => 'abc', () => 'xyz');

  markTouched();

  assert.equal(showMismatch.value, true);
});

test('usePasswordMatch: showMatch is true after touch when passwords match and confirm is non-empty', () => {
  const { markTouched, showMatch } = usePasswordMatch(() => 'abc', () => 'abc');

  markTouched();

  assert.equal(showMatch.value, true);
});

test('usePasswordMatch: showMatch is false even after touch when confirm is empty', () => {
  const { markTouched, showMatch } = usePasswordMatch(() => '', () => '');

  markTouched();

  // Both are equal (both empty), but confirm is empty so no positive indicator.
  assert.equal(showMatch.value, false);
});

test('usePasswordMatch: showMismatch and showMatch are mutually exclusive', () => {
  const confirm = { value: 'xyz' };
  const { markTouched, showMatch, showMismatch } = usePasswordMatch(
    () => 'abc',
    () => confirm.value,
  );

  markTouched();

  assert.equal(showMismatch.value, true);
  assert.equal(showMatch.value, false);
});

// ── isMatch reactive ──────────────────────────────────────────────────────────

test('usePasswordMatch: isMatch reflects current getter values', () => {
  const pw = ref('abc');
  const confirm = ref('abc');
  const { isMatch } = usePasswordMatch(() => pw.value, () => confirm.value);

  assert.equal(isMatch.value, true);

  confirm.value = 'xyz';

  assert.equal(isMatch.value, false);
});

// ── reset ─────────────────────────────────────────────────────────────────────

test('usePasswordMatch: reset clears touched state', () => {
  const { isTouched, markTouched, reset, showMismatch } = usePasswordMatch(() => 'a', () => 'b');

  markTouched();
  assert.equal(showMismatch.value, true);

  reset();

  assert.equal(isTouched.value, false);
  assert.equal(showMismatch.value, false);
});

// ── edge cases ────────────────────────────────────────────────────────────────

test('usePasswordMatch: markTouched is idempotent', () => {
  const { isTouched, markTouched } = usePasswordMatch(() => 'a', () => 'b');

  markTouched();
  markTouched();
  markTouched();

  assert.equal(isTouched.value, true);
});
