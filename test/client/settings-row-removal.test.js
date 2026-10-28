/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { removeSettingsRowWithFocus } from '../../src/client/lib/settings-row-removal.js';

function fixture() {
  const listeners = new Set(), document = { body: {}, activeElement: null,
    addEventListener: (_type, listener) => listeners.add(listener), removeEventListener: (_type, listener) => listeners.delete(listener),
    move(node) { this.activeElement = node; for (const listener of listeners) listener({ target: node }); } };
  const target = () => ({ isConnected: true, disabled: false, getClientRects: () => [{}], focus() { document.move(this); } });
  const next = target(), previous = target(), addButton = target();
  const invoker = target(), card = { ownerDocument: document, contains: node => node === invoker,
    nextElementSibling: { querySelector: () => next }, previousElementSibling: { querySelector: () => previous } };
  invoker.closest = () => card; document.move(invoker);
  const remove = () => { invoker.isConnected = false; document.move(document.body); };
  return { document, listeners, next, previous, addButton, invoker, card, remove };
}

test('row removal mutates synchronously and focuses the next row after rendering', async () => {
  const f = fixture(); let release;
  const update = new Promise(resolve => { release = resolve; });
  const pending = removeSettingsRowWithFocus({ ...f, afterUpdate: () => update });
  assert.equal(f.invoker.isConnected, false); assert.equal(f.document.activeElement, f.document.body);
  release(); await pending; assert.equal(f.document.activeElement, f.next); assert.equal(f.listeners.size, 0);
});

test('last and only rows use the previous input and Add action respectively', async () => {
  for (const hasPrevious of [true, false]) {
    const f = fixture(); f.card.nextElementSibling = null;
    if (!hasPrevious) f.card.previousElementSibling = null;
    await removeSettingsRowWithFocus({ ...f, afterUpdate: async () => {} });
    assert.equal(f.document.activeElement, hasPrevious ? f.previous : f.addButton); assert.equal(f.listeners.size, 0);
  }
});

test('programmatic removal preserves focus already owned outside that row', async () => {
  const f = fixture(); f.document.move(f.next);
  await removeSettingsRowWithFocus({ ...f, remove: () => { f.invoker.isConnected = false; }, afterUpdate: () => { throw new Error('No focus update should be requested'); } });
  assert.equal(f.document.activeElement, f.next); assert.equal(f.listeners.size, 0);
});

test('a user move elsewhere permanently revokes recovery even if focus later reaches body', async () => {
  const f = fixture();
  await removeSettingsRowWithFocus({ ...f, afterUpdate: async () => { f.document.move(f.previous); f.document.move(f.document.body); } });
  assert.equal(f.document.activeElement, f.document.body); assert.equal(f.listeners.size, 0);
});

test('retired or hidden targets are skipped and refused removal does not move focus', async () => {
  const f = fixture(); f.next.isConnected = false; f.previous.getClientRects = () => [];
  await removeSettingsRowWithFocus({ ...f, afterUpdate: async () => {} }); assert.equal(f.document.activeElement, f.addButton);
  const refused = fixture(); await removeSettingsRowWithFocus({ ...refused, remove: () => {}, afterUpdate: async () => {} });
  assert.equal(refused.document.activeElement, refused.invoker); assert.equal(refused.listeners.size, 0);
});

test('render failure preserves the original failure and retires the focus listener', async () => {
  const f = fixture(), failure = new Error('controlled render failure');
  await assert.rejects(removeSettingsRowWithFocus({ ...f, afterUpdate: async () => { throw failure; } }), error => error === failure);
  assert.equal(f.listeners.size, 0);
});
