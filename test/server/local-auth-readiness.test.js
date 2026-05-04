import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalAuthStatus, isLocalAuthReadyForPlexUnlink } from '../../src/server/local-auth-readiness.js';

test('buildLocalAuthStatus treats imported Plex placeholder credentials as not unlink-ready', () => {
  const readiness = buildLocalAuthStatus({
    must_change_password: false,
    password_changed_at: null,
  });

  assert.deepEqual(readiness, {
    hasConfiguredPassword: false,
    mustChangePassword: false,
    passwordChangedAt: null,
    unlinkPlexBlockedReason: 'local_password_not_configured',
    unlinkPlexReady: false,
  });
  assert.equal(isLocalAuthReadyForPlexUnlink({ password_changed_at: null }), false);
});

test('buildLocalAuthStatus treats established local credentials as unlink-ready', () => {
  const readiness = buildLocalAuthStatus({
    mustChangePassword: true,
    passwordChangedAt: '2026-05-04T18:00:00.000Z',
  });

  assert.deepEqual(readiness, {
    hasConfiguredPassword: true,
    mustChangePassword: true,
    passwordChangedAt: '2026-05-04T18:00:00.000Z',
    unlinkPlexBlockedReason: null,
    unlinkPlexReady: true,
  });
  assert.equal(isLocalAuthReadyForPlexUnlink({ passwordChangedAt: '2026-05-04T18:00:00.000Z' }), true);
});