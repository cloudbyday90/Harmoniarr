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
  buildAdminNav,
  buildOperatorNav,
  buildRequesterNav,
  buildVisibleNav,
  notificationTone,
} from '../../src/client/lib/app-shell-presentation.js';

test('administrator navigation follows the Missing Music then Downloader workflow', () => {
  assert.deepEqual(
    buildAdminNav().map((item) => item.name),
    ['dashboard', 'discover', 'missing', 'downloader', 'activity', 'settings'],
  );
  assert.ok(!buildAdminNav().some((item) => item.name === 'acquisition'));
});

test('operator navigation exposes Missing Music but not the protected Downloader workspace', () => {
  assert.deepEqual(
    buildOperatorNav().map((item) => item.name),
    ['dashboard', 'discover', 'missing', 'activity', 'settings'],
  );
  assert.ok(!buildOperatorNav().some((item) => item.name === 'downloader'));
});

test('Missing Music has one stable visible label and the intended icon', () => {
  for (const navigation of [buildAdminNav(), buildOperatorNav(), buildRequesterNav()]) {
    const missingMusic = navigation.find((item) => item.name === 'missing');
    assert.ok(missingMusic);
    assert.equal(missingMusic.label, 'Missing Music');
    assert.equal(missingMusic.icon, 'missing');
  }
});

test('requester navigation provides their scoped Missing Music worklist', () => {
  assert.deepEqual(
    buildRequesterNav().map((item) => item.name),
    ['dashboard', 'missing', 'discover', 'search', 'my-requests'],
  );
  assert.ok(!buildRequesterNav().some((item) => item.name === 'music-queue'));
});

test('navigation helpers return stable immutable references', () => {
  assert.equal(buildAdminNav(), buildAdminNav());
  assert.equal(buildOperatorNav(), buildOperatorNav());
  assert.equal(buildRequesterNav(), buildRequesterNav());
});

test('buildVisibleNav selects the explicit session role without treating it as authorization', () => {
  assert.deepEqual(
    buildVisibleNav('admin', 99).map((item) => item.name),
    ['dashboard', 'discover', 'missing', 'downloader', 'activity', 'settings'],
  );
  assert.deepEqual(
    buildVisibleNav('operator', 99).map((item) => item.name),
    ['dashboard', 'discover', 'missing', 'activity', 'settings'],
  );
  assert.deepEqual(
    buildVisibleNav('requester', 0).map((item) => item.name),
    ['dashboard', 'missing', 'discover', 'search', 'my-requests'],
  );
});

test('buildVisibleNav preserves the requester notification badge without mutating base navigation', () => {
  const requesterBefore = buildRequesterNav().map((item) => ({ ...item }));
  const nav = buildVisibleNav('requester', 3);
  const myRequests = nav.find((item) => item.name === 'my-requests');

  assert.equal(myRequests.badge, 3);
  assert.deepEqual(buildRequesterNav().map((item) => ({ ...item })), requesterBefore);
});

test('buildVisibleNav accepts the former requester boolean while callers move to explicit roles', () => {
  assert.deepEqual(
    buildVisibleNav(true, 0).map((item) => item.name),
    ['dashboard', 'missing', 'discover', 'search', 'my-requests'],
  );
});

test('notificationTone maps operational categories to the design-system tones', () => {
  assert.equal(notificationTone('failure'), 'danger');
  assert.equal(notificationTone('manual_intervention'), 'warning');
  assert.equal(notificationTone('recovery'), 'info');
  assert.equal(notificationTone('some-unknown-category'), 'info');
});
