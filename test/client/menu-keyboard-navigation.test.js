import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveMenuFocus } from '../../src/client/lib/menu-keyboard-navigation.js';

describe('resolveMenuFocus', () => {
  test('returns null for empty items array', () => {
    assert.equal(resolveMenuFocus([], null, 'ArrowDown'), null);
  });

  test('returns null for null items', () => {
    assert.equal(resolveMenuFocus(null, null, 'ArrowDown'), null);
  });

  test('returns null for unrecognized key', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'a', 'Enter'), null);
  });

  test('ArrowDown moves to next item', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'a', 'ArrowDown'), 'b');
  });

  test('ArrowDown wraps from last to first', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'c', 'ArrowDown'), 'a');
  });

  test('ArrowDown from unknown active element goes to first', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'x', 'ArrowDown'), 'a');
  });

  test('ArrowUp moves to previous item', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'c', 'ArrowUp'), 'b');
  });

  test('ArrowUp wraps from first to last', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'a', 'ArrowUp'), 'c');
  });

  test('ArrowUp from unknown active element goes to last', () => {
    const items = ['a', 'b', 'c'];
    assert.equal(resolveMenuFocus(items, 'x', 'ArrowUp'), 'c');
  });

  test('handles single-item list', () => {
    const items = ['only'];
    assert.equal(resolveMenuFocus(items, 'only', 'ArrowDown'), 'only');
    assert.equal(resolveMenuFocus(items, 'only', 'ArrowUp'), 'only');
  });
});
