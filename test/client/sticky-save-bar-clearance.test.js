/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { observeStickySaveBar } from '../../src/client/lib/sticky-save-bar-clearance.js';

const property = '--hx-settings-save-bar-height';
function fixture() {
  const properties = new Map(), listeners = new Map(), observations = [];
  const host = { clientHeight: 800, style: {
    getPropertyValue: key => properties.get(key)?.value ?? '', getPropertyPriority: key => properties.get(key)?.priority ?? '',
    setProperty: (key, value, priority = '') => properties.set(key, { value, priority }), removeProperty: key => properties.delete(key),
  } };
  const windowTarget = { addEventListener: (name, callback) => listeners.set(callback, name), removeEventListener: (_name, callback) => listeners.delete(callback) };
  class Observer { constructor(callback) { this.callback = callback; this.targets = []; this.closed = false; observations.push(this); } observe(...args) { this.targets.push(args); } disconnect() { this.closed = true; } }
  function bar(height = 60) {
    const attrs = new Map();
    return { height, position: 'sticky', closest: selector => selector === '.hx-main' ? host : null, getBoundingClientRect() { return { height: this.height }; },
      getAttribute: key => attrs.get(key) ?? null, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) };
  }
  const attach = (element, options) => observeStickySaveBar(element, { ResizeObserverCtor: Observer, windowTarget,
    getStyle: node => ({ position: node.getAttribute('data-sticky-overflow') === null ? node.position : 'static' }), ...options });
  return { host, listeners, observations, bar, attach, value: () => host.style.getPropertyValue(property) };
}
test('border-box resize reserves actual space, retires listeners/observer and ignores late callbacks', () => {
  const f = fixture(), bar = f.bar(58.2), owner = f.attach(bar);
  assert.equal(f.value(), '59px'); assert.deepEqual(f.observations[0].targets, [[bar, { box: 'border-box' }], [f.host, { box: 'border-box' }]]);
  bar.height = 94.1; f.observations[0].callback(); assert.equal(f.value(), '95px');
  owner.dispose(); owner.dispose(); assert.equal(f.value(), ''); assert.equal(f.listeners.size, 0); assert.equal(f.observations[0].closed, true);
  f.observations[0].callback(); owner.refresh(); assert.equal(f.value(), '');
});
test('normal flow reserves no sticky space; a tall bar returns to sticky when the scrollport fits it', () => {
  const f = fixture(), bar = f.bar(), owner = f.attach(bar);
  bar.position = 'static'; owner.refresh(); assert.equal(f.value(), '0px');
  bar.position = 'sticky'; bar.height = 450; owner.refresh(); assert.equal(bar.getAttribute('data-sticky-overflow'), ''); assert.equal(f.value(), '0px');
  f.host.clientHeight = 1000; f.observations[0].callback(); assert.equal(bar.getAttribute('data-sticky-overflow'), null); assert.equal(f.value(), '450px'); owner.dispose();
});
for (const order of [[0, 1], [1, 0]]) {
  test(`overlapping mounts preserve the largest active reservation and restore prior priority, order ${order}`, () => {
    const f = fixture(); f.host.style.setProperty(property, '13px', 'important');
    const bars = [f.bar(60), f.bar(90)], owners = bars.map(bar => f.attach(bar)); assert.equal(f.value(), '90px');
    owners[order[0]].dispose(); assert.equal(f.value(), `${bars[order[1]].height}px`);
    f.observations[order[0]].callback(); assert.equal(f.value(), `${bars[order[1]].height}px`);
    owners[order[1]].dispose(); assert.equal(f.value(), '13px'); assert.equal(f.host.style.getPropertyPriority(property), 'important');
  });
}
test('a later foreign inline writer is preserved during refresh and retirement', () => {
  const f = fixture(), owner = f.attach(f.bar());
  f.host.style.setProperty(property, '120px', 'important'); owner.refresh(); owner.dispose();
  assert.equal(f.value(), '120px'); assert.equal(f.host.style.getPropertyPriority(property), 'important');
});
test('fallback render/resize updates work without ResizeObserver, and unrelated scrollports stay independent', () => {
  const a = fixture(), b = fixture(), bar = a.bar(), first = a.attach(bar, { ResizeObserverCtor: null }), second = b.attach(b.bar(100));
  bar.height = 85; [...a.listeners.keys()][0](); assert.equal(a.value(), '85px'); assert.equal(b.value(), '100px');
  first.dispose(); assert.equal(a.value(), ''); assert.equal(b.value(), '100px'); second.dispose();
  const absent = observeStickySaveBar(null); absent.refresh(); absent.dispose();
});
test('setup and disconnect failures still release the owned reservation', () => {
  const f = fixture(), failure = new Error('fixture observer failure'); let disconnected = false;
  class Broken { observe() { throw failure; } disconnect() { disconnected = true; } }
  assert.throws(() => f.attach(f.bar(), { ResizeObserverCtor: Broken }), error => error === failure);
  assert.equal(disconnected, true); assert.equal(f.listeners.size, 0);
  const owner = f.attach(f.bar()); assert.equal(f.value(), '60px');
  f.observations[0].disconnect = () => { throw failure; };
  assert.throws(owner.dispose, error => error === failure); assert.equal(f.value(), ''); assert.equal(f.listeners.size, 0);
});
