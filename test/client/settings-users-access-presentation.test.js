import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUsersAccessPosture } from '../../src/client/lib/settings-users-access-presentation.js';

test('access posture distinguishes complete account data from a partial list', () => {
  const posture = buildUsersAccessPosture({
    plexOwnerLinked: true,
    totalCount: 3,
    users: [
      { isDisabled: false, role: 'admin' },
      { isDisabled: false, role: 'requester' },
      { isDisabled: true, role: 'requester' },
    ],
  });

  assert.equal(posture.statusLabel, 'Access overview');
  assert.equal(posture.tone, 'warning');
  assert.match(posture.message, /listed accounts/);
  assert.deepEqual(posture.checks.map((check) => check.statusLabel), [
    '3 users',
    '2 active',
    '1 shown',
    'Connected',
  ]);
});

test('access posture scopes role and active counts when the user list is paginated', () => {
  const posture = buildUsersAccessPosture({
    totalCount: 60,
    users: Array.from({ length: 50 }, (_, index) => ({
      isDisabled: index === 0,
      role: index === 1 ? 'admin' : 'requester',
    })),
  });

  assert.match(posture.message, /50 loaded accounts/);
  assert.equal(posture.checks[1].statusLabel, '49 active shown');
  assert.equal(posture.checks[2].statusLabel, '1 shown');
  assert.equal(posture.checks[3].statusLabel, 'Not connected');
});

test('access posture does not claim that an empty client list has no server accounts', () => {
  const posture = buildUsersAccessPosture({ totalCount: 4, users: [] });

  assert.equal(posture.checks[0].statusLabel, '4 users');
  assert.match(posture.message, /0 loaded accounts/);
  assert.doesNotMatch(posture.message, /No accounts are loaded/);
});

test('access posture does not present an empty loading list as an account state', () => {
  const posture = buildUsersAccessPosture({ isLoading: true, totalCount: 0, users: [] });

  assert.equal(posture.statusLabel, 'Loading access');
  assert.deepEqual(posture.checks, []);
  assert.match(posture.message, /Loading saved account access/);
});

test('access posture labels a filtered total as matching accounts', () => {
  const posture = buildUsersAccessPosture({
    isFiltered: true,
    totalCount: 2,
    users: [{ isDisabled: false, role: 'requester' }, { isDisabled: false, role: 'requester' }],
  });

  assert.equal(posture.checks[0].statusLabel, '2 users matching');
  assert.match(posture.message, /matching accounts/);
});
