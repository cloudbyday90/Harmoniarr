import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorNav,
  buildRequesterNav,
  buildVisibleNav,
  notificationTone,
} from '../../src/client/lib/app-shell-presentation.js';

// ---------------------------------------------------------------------------
// buildOperatorNav
// ---------------------------------------------------------------------------

test('buildOperatorNav returns 6 items in expected order', () => {
  const nav = buildOperatorNav();
  assert.deepEqual(
    nav.map((item) => item.name),
    ['dashboard', 'dashboard-panel', 'discover', 'missing', 'activity', 'settings'],
  );
});

test('buildOperatorNav missing item uses icon "missing"', () => {
  const nav = buildOperatorNav();
  const missingItem = nav.find((item) => item.name === 'missing');
  assert.ok(missingItem, 'missing item must exist in operator nav');
  assert.equal(missingItem.icon, 'missing');
});

test('buildOperatorNav missing item does not use an info icon', () => {
  const nav = buildOperatorNav();
  const missingItem = nav.find((item) => item.name === 'missing');
  assert.ok(missingItem, 'missing item must exist in operator nav');
  assert.notEqual(missingItem.icon, 'info',
    'missing releases should not be represented by an info icon');
  assert.notEqual(missingItem.icon, 'info-circle',
    'missing releases should not be represented by an info-circle icon');
});

test('buildOperatorNav dashboard item has exact: true', () => {
  const nav = buildOperatorNav();
  const dashboardItem = nav.find((item) => item.name === 'dashboard');
  assert.ok(dashboardItem, 'dashboard item must exist');
  assert.equal(dashboardItem.exact, true);
});

test('buildOperatorNav items all have non-empty name, label, and icon', () => {
  for (const item of buildOperatorNav()) {
    assert.ok(item.name?.length > 0, `item must have a name: ${JSON.stringify(item)}`);
    assert.ok(item.label?.length > 0, `item must have a label: ${JSON.stringify(item)}`);
    assert.ok(item.icon?.length > 0, `item must have an icon: ${JSON.stringify(item)}`);
  }
});

test('buildOperatorNav returns a stable reference across multiple calls', () => {
  assert.equal(buildOperatorNav(), buildOperatorNav());
});

// ---------------------------------------------------------------------------
// buildRequesterNav
// ---------------------------------------------------------------------------

test('buildRequesterNav returns 4 items in expected order', () => {
  const nav = buildRequesterNav();
  assert.deepEqual(
    nav.map((item) => item.name),
    ['dashboard', 'discover', 'search', 'my-requests'],
  );
});

test('buildRequesterNav does not include the missing route', () => {
  const nav = buildRequesterNav();
  assert.ok(!nav.some((item) => item.name === 'missing'),
    'requester nav must not include the missing releases route');
});

test('buildRequesterNav includes my-requests item with requests icon', () => {
  const nav = buildRequesterNav();
  const myRequests = nav.find((item) => item.name === 'my-requests');
  assert.ok(myRequests, 'my-requests item must exist in requester nav');
  assert.equal(myRequests.icon, 'requests');
});

test('buildRequesterNav returns a stable reference across multiple calls', () => {
  assert.equal(buildRequesterNav(), buildRequesterNav());
});

// ---------------------------------------------------------------------------
// buildVisibleNav
// ---------------------------------------------------------------------------

test('buildVisibleNav for operator returns operator nav regardless of count', () => {
  const nav = buildVisibleNav(false, 0);
  assert.deepEqual(
    nav.map((item) => item.name),
    ['dashboard', 'dashboard-panel', 'discover', 'missing', 'activity', 'settings'],
  );
});

test('buildVisibleNav for operator ignores a non-zero notification count', () => {
  const nav = buildVisibleNav(false, 99);
  assert.ok(!nav.some((item) => item.badge), 'operator nav items must not have badges');
});

test('buildVisibleNav for requester with count 0 returns base array without badge', () => {
  const nav = buildVisibleNav(true, 0);
  assert.deepEqual(
    nav.map((item) => item.name),
    ['dashboard', 'discover', 'search', 'my-requests'],
  );
  assert.ok(!nav.some((item) => item.badge), 'no badge when count is 0');
});

test('buildVisibleNav for requester with negative count returns base array without badge', () => {
  const nav = buildVisibleNav(true, -1);
  assert.ok(!nav.some((item) => item.badge), 'no badge when count is negative');
});

test('buildVisibleNav for requester with count 3 adds badge to my-requests only', () => {
  const nav = buildVisibleNav(true, 3);
  const myRequests = nav.find((item) => item.name === 'my-requests');
  assert.ok(myRequests, 'my-requests item must be present');
  assert.equal(myRequests.badge, 3);
  for (const item of nav.filter((i) => i.name !== 'my-requests')) {
    assert.ok(!item.badge, `unexpected badge on: ${item.name}`);
  }
});

test('buildVisibleNav does not mutate the original nav arrays', () => {
  const operatorBefore = buildOperatorNav().map((i) => ({ ...i }));
  const requesterBefore = buildRequesterNav().map((i) => ({ ...i }));
  buildVisibleNav(false, 10);
  buildVisibleNav(true, 10);
  assert.deepEqual(buildOperatorNav().map((i) => ({ ...i })), operatorBefore);
  assert.deepEqual(buildRequesterNav().map((i) => ({ ...i })), requesterBefore);
});

test('buildVisibleNav for requester with null count returns base array', () => {
  const nav = buildVisibleNav(true, null);
  assert.ok(!nav.some((item) => item.badge), 'null count treated as 0 — no badge');
});

// ---------------------------------------------------------------------------
// notificationTone
// ---------------------------------------------------------------------------

test('notificationTone failure maps to danger', () => {
  assert.equal(notificationTone('failure'), 'danger');
});

test('notificationTone manual_intervention maps to warning', () => {
  assert.equal(notificationTone('manual_intervention'), 'warning');
});

test('notificationTone recovery maps to info', () => {
  assert.equal(notificationTone('recovery'), 'info');
});

test('notificationTone unknown string maps to info', () => {
  assert.equal(notificationTone('some-unknown-category'), 'info');
});

test('notificationTone null maps to info', () => {
  assert.equal(notificationTone(null), 'info');
});

test('notificationTone undefined maps to info', () => {
  assert.equal(notificationTone(undefined), 'info');
});

test('notificationTone empty string maps to info', () => {
  assert.equal(notificationTone(''), 'info');
});
