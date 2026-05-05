import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAuthEntrySupportItems } from '../../src/client/lib/auth-entry-support.js';

test('login auth entry support keeps claim and recovery paths in a stable order', () => {
  assert.deepEqual(
    buildAuthEntrySupportItems('login').map((item) => item.id),
    ['claim-account', 'recovery'],
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