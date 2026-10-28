/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive } from 'vue';
import { createSettingsRowKey } from '../../src/client/lib/settings-row-key.js';

test('row identity survives edits, movement and preceding-row removal', () => {
  const key = createSettingsRowKey(), rows = reactive([{ userId: '' }, { userId: '' }, { userId: '' }]);
  const original = rows.map(key); assert.equal(new Set(original).size, 3);
  rows[1].userId = 'changed'; assert.equal(key(rows[1]), original[1]);
  rows.splice(0, 1); assert.deepEqual(rows.map(key), original.slice(1));
  rows.reverse(); assert.deepEqual(rows.map(key), original.slice(1).reverse());
  rows.push({ userId: 'changed' }); assert.ok(!original.includes(key(rows.at(-1))));
});

test('row keys do not mutate or serialize into saved data, including frozen rows', () => {
  const row = Object.freeze({ userId: 'user', relativeRoot: 'family/user' }), before = JSON.stringify(row), ownKeys = Reflect.ownKeys(row);
  const key = createSettingsRowKey(); assert.equal(typeof key(row), 'symbol'); assert.equal(key(row), key(row));
  assert.equal(JSON.stringify(row), before); assert.deepEqual(Reflect.ownKeys(row), ownKeys);
});

test('independent view owners assign distinct render keys to the same object', () => {
  const row = {}, first = createSettingsRowKey(), second = createSettingsRowKey();
  assert.notEqual(first(row), second(row)); assert.notEqual(first(row), first({}));
});

test('row identity refuses non-object input', () => {
  const key = createSettingsRowKey();
  for (const row of [null, undefined, '', 0, true, Symbol(), () => {}]) assert.throws(() => key(row), TypeError);
});
