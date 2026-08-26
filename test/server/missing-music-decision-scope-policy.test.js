import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMissingMusicAccountStatus,
  resolveMissingMusicDecisionScope,
} from '../../src/server/missing-music/missing-music-decision-scope-policy.js';

test('non-admin Missing Music decisions always resolve to the signed-in user', () => {
  const scope = resolveMissingMusicDecisionScope({
    actorUserId: 'user-1',
    actorUserRole: 'requester',
    requestedScope: 'all',
  });

  assert.deepEqual(scope, {
    isAdmin: false,
    requestedForUserId: 'user-1',
    scope: 'mine',
  });
});

test('non-admin Missing Music decisions reject another user target', () => {
  assert.throws(
    () => resolveMissingMusicDecisionScope({
      actorUserId: 'user-1',
      actorUserRole: 'requester',
      requestedForUserId: 'user-2',
    }),
    (error) => error?.status === 403 && error?.code === 'forbidden',
  );
});

test('admins can filter the all-user Missing Music scope by a retained user', () => {
  const scope = resolveMissingMusicDecisionScope({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    requestedForUserId: 'disabled-user',
    requestedScope: 'all',
  });

  assert.deepEqual(scope, {
    isAdmin: true,
    requestedForUserId: 'disabled-user',
    scope: 'all',
  });
});

test('admins cannot combine their personal scope with another user target', () => {
  assert.throws(
    () => resolveMissingMusicDecisionScope({
      actorUserId: 'admin-1',
      actorUserRole: 'admin',
      requestedForUserId: 'user-2',
      requestedScope: 'mine',
    }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('Missing Music account-status filters validate the retained account states', () => {
  assert.equal(normalizeMissingMusicAccountStatus(), 'active');
  assert.equal(normalizeMissingMusicAccountStatus('disabled'), 'disabled');
  assert.throws(
    () => normalizeMissingMusicAccountStatus('archived'),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});
