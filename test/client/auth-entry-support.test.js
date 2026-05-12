import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthEntrySupportItems,
  getBootstrapHeading,
  getBootstrapTitle,
} from '../../src/client/lib/auth-entry-support.js';

test('login auth entry support exposes only the claim-account path', () => {
  assert.deepEqual(
    buildAuthEntrySupportItems('login').map((item) => item.id),
    ['claim-account'],
  );
});

test('login auth entry support does not expose the bootstrap recovery path', () => {
  const loginItems = buildAuthEntrySupportItems('login');
  assert.ok(
    !loginItems.some((item) => item.id === 'recovery'),
    'recovery link must not appear on the primary login surface',
  );
});

test('auth entry support preserves username prefill for related login and claim routes', () => {
  const loginItems = buildAuthEntrySupportItems('login', { username: 'owner@example.com' });
  const claimItem = loginItems.find((item) => item.id === 'claim-account');

  assert.deepEqual(claimItem.to, {
    name: 'claim-account',
    query: {
      username: 'owner@example.com',
    },
  });

  const claimItems = buildAuthEntrySupportItems('claim-account', { username: 'owner@example.com' });
  const loginItem = claimItems.find((item) => item.id === 'login');

  assert.deepEqual(loginItem.to, {
    name: 'login',
    query: {
      username: 'owner@example.com',
    },
  });
});

test('bootstrap auth entry support uses informational notes instead of dead-end routes', () => {
  assert.deepEqual(
    buildAuthEntrySupportItems('bootstrap').map((item) => ({
      id: item.id,
      to: item.to,
    })),
    [
      { id: 'login-later', to: null },
      { id: 'claim-scope', to: null },
    ],
  );
});

test('recovery auth entry support returns login and claim-account paths', () => {
  assert.deepEqual(
    buildAuthEntrySupportItems('recovery').map((item) => item.id),
    ['login', 'claim-account'],
  );
});

test('all auth entry surface items carry a non-empty label for footer link rendering', () => {
  const surfaces = ['login', 'claim-account', 'bootstrap', 'recovery'];
  for (const surface of surfaces) {
    const items = buildAuthEntrySupportItems(surface);
    for (const item of items) {
      assert.ok(typeof item.label === 'string' && item.label.length > 0,
        `${surface}/${item.id} must have a non-empty label`);
    }
  }
});

test('unknown surface returns an empty array', () => {
  assert.deepEqual(buildAuthEntrySupportItems('nonexistent'), []);
});

test('auth entry support ignores whitespace-only username when building prefill routes', () => {
  const items = buildAuthEntrySupportItems('login', { username: '   ' });
  const claimItem = items.find((item) => item.id === 'claim-account');

  assert.deepEqual(claimItem.to, { name: 'claim-account' });
});

// ── getBootstrapTitle ─────────────────────────────────────────────────────────

test('getBootstrapTitle: required=true returns claim copy', () => {
  assert.equal(getBootstrapTitle({ required: true }), 'Claim the configured owner account');
});

test('getBootstrapTitle: required=false returns create copy', () => {
  assert.equal(getBootstrapTitle({ required: false }), 'Create the first admin account');
});

test('getBootstrapTitle: null summary returns create copy', () => {
  assert.equal(getBootstrapTitle(null), 'Create the first admin account');
});

test('getBootstrapTitle: undefined summary returns create copy', () => {
  assert.equal(getBootstrapTitle(undefined), 'Create the first admin account');
});

test('getBootstrapTitle: does not expose raw internal terms', () => {
  assert.ok(!getBootstrapTitle({ required: true }).includes('bootstrap'));
  assert.ok(!getBootstrapTitle({ required: false }).includes('bootstrap'));
});

// ── getBootstrapHeading ───────────────────────────────────────────────────────

test('getBootstrapHeading: required=true returns claim heading', () => {
  assert.equal(getBootstrapHeading({ required: true }), 'Claim owner account');
});

test('getBootstrapHeading: required=false returns create heading', () => {
  assert.equal(getBootstrapHeading({ required: false }), 'Create admin account');
});

test('getBootstrapHeading: null summary returns create heading', () => {
  assert.equal(getBootstrapHeading(null), 'Create admin account');
});

test('getBootstrapHeading: undefined summary returns create heading', () => {
  assert.equal(getBootstrapHeading(undefined), 'Create admin account');
});

test('getBootstrapHeading is shorter than getBootstrapTitle for the same branch', () => {
  assert.ok(getBootstrapHeading({ required: true }).length < getBootstrapTitle({ required: true }).length);
  assert.ok(getBootstrapHeading({ required: false }).length < getBootstrapTitle({ required: false }).length);
});