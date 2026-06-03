/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeInvoker,
  shouldRestoreInvokerFocus,
} from '../../src/client/lib/focus-return.js';

// ── shouldRestoreInvokerFocus ─────────────────────────────────────────────────

test('shouldRestoreInvokerFocus is true for a connected, enabled invoker', () => {
  assert.equal(
    shouldRestoreInvokerFocus({ invokerConnected: true, invokerDisabled: false }),
    true,
  );
});

test('shouldRestoreInvokerFocus is false when the invoker is disconnected', () => {
  assert.equal(
    shouldRestoreInvokerFocus({ invokerConnected: false, invokerDisabled: false }),
    false,
  );
});

test('shouldRestoreInvokerFocus is false when the invoker is disabled', () => {
  assert.equal(
    shouldRestoreInvokerFocus({ invokerConnected: true, invokerDisabled: true }),
    false,
  );
});

test('shouldRestoreInvokerFocus is false when both connected and disabled flags fail', () => {
  assert.equal(
    shouldRestoreInvokerFocus({ invokerConnected: false, invokerDisabled: true }),
    false,
  );
});

test('shouldRestoreInvokerFocus defaults to false when given no descriptor', () => {
  assert.equal(shouldRestoreInvokerFocus(), false);
  assert.equal(shouldRestoreInvokerFocus({}), false);
});

test('shouldRestoreInvokerFocus requires strict booleans (no truthy coercion)', () => {
  assert.equal(
    shouldRestoreInvokerFocus({ invokerConnected: 'yes', invokerDisabled: false }),
    false,
  );
});

// ── describeInvoker ───────────────────────────────────────────────────────────

test('describeInvoker reports a connected, enabled element', () => {
  const element = { isConnected: true, disabled: false };
  assert.deepEqual(describeInvoker(element), {
    invokerConnected: true,
    invokerDisabled: false,
  });
});

test('describeInvoker reports a disabled element', () => {
  const element = { isConnected: true, disabled: true };
  assert.deepEqual(describeInvoker(element), {
    invokerConnected: true,
    invokerDisabled: true,
  });
});

test('describeInvoker honors aria-disabled="true"', () => {
  const element = {
    isConnected: true,
    disabled: false,
    getAttribute: (name) => (name === 'aria-disabled' ? 'true' : null),
  };
  assert.deepEqual(describeInvoker(element), {
    invokerConnected: true,
    invokerDisabled: true,
  });
});

test('describeInvoker ignores aria-disabled values other than "true"', () => {
  const element = {
    isConnected: true,
    disabled: false,
    getAttribute: (name) => (name === 'aria-disabled' ? 'false' : null),
  };
  assert.equal(describeInvoker(element).invokerDisabled, false);
});

test('describeInvoker treats a disconnected element as not connected', () => {
  const element = { isConnected: false, disabled: false };
  assert.equal(describeInvoker(element).invokerConnected, false);
});

test('describeInvoker returns a safe descriptor for null/undefined', () => {
  assert.deepEqual(describeInvoker(null), {
    invokerConnected: false,
    invokerDisabled: false,
  });
  assert.deepEqual(describeInvoker(undefined), {
    invokerConnected: false,
    invokerDisabled: false,
  });
});

// ── integration: describeInvoker → shouldRestoreInvokerFocus ──────────────────

test('a freshly disabled "Add" button does not reclaim focus', () => {
  const addButton = { isConnected: true, disabled: true };
  assert.equal(shouldRestoreInvokerFocus(describeInvoker(addButton)), false);
});

test('an enabled, attached invoker reclaims focus', () => {
  const link = { isConnected: true, disabled: false };
  assert.equal(shouldRestoreInvokerFocus(describeInvoker(link)), true);
});
