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
import { useTheme } from '../../src/client/composables/useTheme.js';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function createStorage({ initial = null } = {}) {
  const store = new Map();
  if (initial !== null) store.set('hx-theme-preference', initial);
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    _store: store,
  };
}

function createSubscribe(t) {
  let capturedCallback = null;
  const subscribe = t.mock.fn((callback) => {
    capturedCallback = callback;
    return () => { capturedCallback = null; };
  });
  subscribe.trigger = (isDark) => capturedCallback?.(isDark);
  return subscribe;
}

function createApply(t) {
  return t.mock.fn();
}

// ---------------------------------------------------------------------------
// Default preference
// ---------------------------------------------------------------------------

test('useTheme default preference is "system" when storage is empty', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(preference.value, 'system');
});

test('useTheme reads initial preference from storage', (t) => {
  const storage = createStorage({ initial: 'dark' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(preference.value, 'dark');
});

test('useTheme reads initial preference "light" from storage', (t) => {
  const storage = createStorage({ initial: 'light' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(preference.value, 'light');
});

test('useTheme ignores an invalid value in storage and falls back to "system"', (t) => {
  const storage = createStorage({ initial: 'blorp' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(preference.value, 'system');
});

// ---------------------------------------------------------------------------
// Resolved theme — system preference
// ---------------------------------------------------------------------------

test('useTheme resolves to "dark" when preference is "system" and system is dark', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => true,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'dark');
});

test('useTheme resolves to "light" when preference is "system" and system is light', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'light');
});

// ---------------------------------------------------------------------------
// Resolved theme — explicit overrides
// ---------------------------------------------------------------------------

test('useTheme resolves to "dark" when preference is "dark" regardless of system', (t) => {
  const storage = createStorage({ initial: 'dark' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'dark');
});

test('useTheme resolves to "light" when preference is "light" regardless of system', (t) => {
  const storage = createStorage({ initial: 'light' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => true,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'light');
});

// ---------------------------------------------------------------------------
// setPreference — updates preference and storage
// ---------------------------------------------------------------------------

test('setPreference("dark") changes preference to "dark"', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference, setPreference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  setPreference('dark');

  assert.equal(preference.value, 'dark');
});

test('setPreference("light") changes preference to "light"', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference, setPreference } = useTheme({
    storage,
    getSystemDark: () => true,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  setPreference('light');

  assert.equal(preference.value, 'light');
});

test('setPreference("system") changes preference back to "system"', (t) => {
  const storage = createStorage({ initial: 'dark' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference, setPreference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  setPreference('system');

  assert.equal(preference.value, 'system');
});

test('setPreference persists the chosen value to storage', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { setPreference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  setPreference('dark');

  assert.equal(storage.getItem('hx-theme-preference'), 'dark');
});

test('setPreference ignores invalid values', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference, setPreference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  setPreference('rainbow');

  assert.equal(preference.value, 'system');
  assert.equal(storage.getItem('hx-theme-preference'), null);
});

// ---------------------------------------------------------------------------
// applyToDocument — called at construction and on change
// ---------------------------------------------------------------------------

test('applyToDocument is called with the resolved theme on construction', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  useTheme({
    storage,
    getSystemDark: () => true,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(apply.mock.callCount(), 1);
  assert.equal(apply.mock.calls[0].arguments[0], 'dark');
});

test('applyToDocument is called with the correct resolved theme after setPreference', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { setPreference } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  setPreference('dark');

  const calls = apply.mock.calls.map((c) => c.arguments[0]);
  // First call is construction (system=false → light), second is after setPreference('dark')
  assert.deepEqual(calls, ['light', 'dark']);
});

// ---------------------------------------------------------------------------
// Reactive system changes
// ---------------------------------------------------------------------------

test('resolvedTheme updates reactively when system changes and preference is "system"', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'light');

  subscribe.trigger(true);

  assert.equal(resolvedTheme.value, 'dark');
});

test('resolvedTheme does NOT change when system changes and preference is "dark"', (t) => {
  const storage = createStorage({ initial: 'dark' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'dark');

  // Simulate system switching to light — explicit dark override must hold
  subscribe.trigger(false);

  assert.equal(resolvedTheme.value, 'dark');
});

test('resolvedTheme does NOT change when system changes and preference is "light"', (t) => {
  const storage = createStorage({ initial: 'light' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { resolvedTheme } = useTheme({
    storage,
    getSystemDark: () => true,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(resolvedTheme.value, 'light');

  // Simulate system staying dark — explicit light override must hold
  subscribe.trigger(true);

  assert.equal(resolvedTheme.value, 'light');
});

test('applyToDocument is called when system changes and preference is "system"', (t) => {
  const storage = createStorage();
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  subscribe.trigger(true);

  const calls = apply.mock.calls.map((c) => c.arguments[0]);
  assert.deepEqual(calls, ['light', 'dark']);
});

test('applyToDocument is NOT called when system changes and preference is explicit', (t) => {
  const storage = createStorage({ initial: 'dark' });
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  useTheme({
    storage,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  const callCountBeforeChange = apply.mock.callCount();

  subscribe.trigger(false);

  // applyToDocument should NOT be called again for explicit preference
  assert.equal(apply.mock.callCount(), callCountBeforeChange);
});

// ---------------------------------------------------------------------------
// Null storage guard
// ---------------------------------------------------------------------------

test('useTheme works when storage is null (server-side / no localStorage)', (t) => {
  const subscribe = createSubscribe(t);
  const apply = createApply(t);

  const { preference, resolvedTheme, setPreference } = useTheme({
    storage: null,
    getSystemDark: () => false,
    subscribeToSystemDark: subscribe,
    applyToDocument: apply,
  });

  assert.equal(preference.value, 'system');
  assert.equal(resolvedTheme.value, 'light');

  // setPreference should not throw when storage is null
  assert.doesNotThrow(() => setPreference('dark'));
  assert.equal(preference.value, 'dark');
});
