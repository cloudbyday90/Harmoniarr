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
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_KEYS,
  buildDefaultNotificationPreferences,
} from '../../src/server/notification/notification-preference-constants.js';

test('NOTIFICATION_CATEGORY_KEYS lists every key in NOTIFICATION_CATEGORIES', () => {
  assert.deepEqual(NOTIFICATION_CATEGORY_KEYS, Object.keys(NOTIFICATION_CATEGORIES));
});

test('every category has a non-empty string label', () => {
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    const cat = NOTIFICATION_CATEGORIES[key];
    assert.equal(typeof cat.label, 'string', `${key} label should be string`);
    assert.ok(cat.label.length > 0, `${key} label should not be empty`);
  }
});

test('every category has a boolean adminOnly flag', () => {
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    assert.equal(typeof NOTIFICATION_CATEGORIES[key].adminOnly, 'boolean', `${key} adminOnly should be boolean`);
  }
});

test('every category has a boolean defaultEnabled flag', () => {
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    assert.equal(typeof NOTIFICATION_CATEGORIES[key].defaultEnabled, 'boolean', `${key} defaultEnabled should be boolean`);
  }
});

test('buildDefaultNotificationPreferences returns a boolean for every category', () => {
  const defaults = buildDefaultNotificationPreferences();
  assert.equal(Object.keys(defaults).length, NOTIFICATION_CATEGORY_KEYS.length);

  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    assert.equal(typeof defaults[key], 'boolean', `${key} default should be boolean`);
    assert.equal(defaults[key], NOTIFICATION_CATEGORIES[key].defaultEnabled, `${key} default should match category`);
  }
});

test('includes trust and blocklist categories for admin users', () => {
  assert.ok('trustOverride' in NOTIFICATION_CATEGORIES);
  assert.ok('blocklistEvent' in NOTIFICATION_CATEGORIES);
  assert.ok('trustThresholdCrossed' in NOTIFICATION_CATEGORIES);
  assert.equal(NOTIFICATION_CATEGORIES.trustOverride.adminOnly, true);
  assert.equal(NOTIFICATION_CATEGORIES.blocklistEvent.adminOnly, true);
  assert.equal(NOTIFICATION_CATEGORIES.trustThresholdCrossed.adminOnly, true);
});

test('includes standard activity categories for all users', () => {
  const standardKeys = ['requestFulfilled', 'downloadCompleted', 'releaseAdded', 'artistMonitored', 'requestCreated'];
  for (const key of standardKeys) {
    assert.ok(key in NOTIFICATION_CATEGORIES, `${key} should be in categories`);
    assert.equal(NOTIFICATION_CATEGORIES[key].adminOnly, false, `${key} should not be adminOnly`);
  }
});
