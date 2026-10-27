import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAuthCookies,
  createRequireCsrf,
  csrfProtectionModeEnvVar,
  csrfProtectionModes,
  requireAdminSession,
  requireFreshAdminSession,
  requireFreshSession,
  resolveCsrfProtectionMode,
  resolveSessionFromRefreshTokenLookup,
  setAuthCookies,
} from '../../src/server/auth.js';

function createRefreshTokenRow(overrides = {}) {
  return {
    refresh_token_id: 'token-1',
    app_user_id: 'user-1',
    token_family_id: 'family-1',
    csrf_token_hash: 'csrf-hash-1',
    expires_at: '2026-05-01T12:30:00.000Z',
    is_revoked: false,
    revoked_reason: null,
    replaced_by_refresh_token_id: null,
    id: 'user-1',
    username: 'admin',
    role: 'admin',
    must_change_password: false,
    last_login_at: '2026-05-01T11:30:00.000Z',
    is_disabled: false,
    ...overrides,
  };
}

test('resolveSessionFromRefreshTokenLookup returns the active session payload for a valid refresh token', async () => {
  const session = await resolveSessionFromRefreshTokenLookup({
    row: createRefreshTokenRow(),
    refreshToken: 'refresh-token-value',
    csrfToken: 'csrf-token-value',
    requestMetadata: { ipAddress: '203.0.113.10', userAgent: 'HarmoniarrAuthTest/1.0' },
    now: () => Date.parse('2026-05-01T12:00:00.000Z'),
  });

  assert.deepEqual(session, {
    refreshTokenId: 'token-1',
    appUserId: 'user-1',
    tokenFamilyId: 'family-1',
    csrfTokenHash: 'csrf-hash-1',
    expiresAt: '2026-05-01T12:30:00.000Z',
    user: {
      id: 'user-1',
      username: 'admin',
      role: 'admin',
      mustChangePassword: false,
      lastLoginAt: '2026-05-01T11:30:00.000Z',
    },
    refreshToken: 'refresh-token-value',
    csrfToken: 'csrf-token-value',
  });
});

test('rotated-token replay delegates to the owned security transaction and never grants a session', async t => {
  const row = createRefreshTokenRow({ is_revoked: true, revoked_reason: 'rotated', replaced_by_refresh_token_id: 'token-2' });
  const requestMetadata = { ipAddress: '198.51.100.25', userAgent: 'HarmoniarrAuthTest/1.0' };
  const handleSessionReplayFn = t.mock.fn(async () => 1);
  const args = { row, requestMetadata, refreshToken: 'stale-secret', csrfToken: 'csrf-secret',
    now: () => Date.parse('2026-05-01T12:00:00.000Z'), handleSessionReplayFn };
  assert.equal(await resolveSessionFromRefreshTokenLookup(args), null);
  assert.deepEqual(handleSessionReplayFn.mock.calls[0].arguments, [{ row, requestMetadata }]);
  for (const overrides of [{ is_disabled: true }, { expires_at: '2026-01-01' }, { replaced_by_refresh_token_id: null }]) {
    assert.equal(await resolveSessionFromRefreshTokenLookup({ ...args, row: { ...row, ...overrides } }), null);
  }
  assert.equal(handleSessionReplayFn.mock.callCount(), 1);
  const unavailable = Object.assign(new Error('safe refusal'), { status: 503 });
  await assert.rejects(resolveSessionFromRefreshTokenLookup({ ...args, handleSessionReplayFn: async () => { throw unavailable; } }), error => error === unavailable);
});

test('requireAdminSession rejects authenticated non-admin sessions', async (t) => {
  const request = { headers: {}, socket: {} };
  const requireSessionFn = t.mock.fn(async () => ({
    appUserId: 'user-2',
    user: {
      id: 'user-2',
      role: 'viewer',
      username: 'viewer-user',
    },
  }));

  await assert.rejects(
    () => requireAdminSession(request, requireSessionFn),
    (error) => error?.status === 403
      && error?.code === 'admin_required'
      && error?.message === 'Administrator access is required',
  );
});

test('requireFreshSession rejects sessions flagged for forced re-authentication', async (t) => {
  const request = { headers: {}, socket: {} };
  const requireSessionFn = t.mock.fn(async () => ({
    appUserId: 'user-3',
    user: {
      id: 'user-3',
      role: 'admin',
      username: 'admin-user',
      mustChangePassword: true,
    },
  }));

  await assert.rejects(
    () => requireFreshSession(request, requireSessionFn),
    (error) => error?.status === 403
      && error?.code === 'reauth_required'
      && error?.message === 'Re-authentication is required before continuing',
  );
});

test('requireFreshAdminSession composes forced re-auth and admin checks through shared helpers', async (t) => {
  const request = { headers: {}, socket: {} };
  const requireAdminSessionFn = t.mock.fn(async (_request, requireFreshSessionFn) => requireFreshSessionFn(_request));
  const requireFreshSessionFn = t.mock.fn(async () => ({
    appUserId: 'user-4',
    user: {
      id: 'user-4',
      role: 'admin',
      username: 'admin-user',
      mustChangePassword: false,
    },
  }));

  const session = await requireFreshAdminSession(request, requireAdminSessionFn, requireFreshSessionFn);

  assert.equal(requireAdminSessionFn.mock.callCount(), 1);
  assert.equal(requireFreshSessionFn.mock.callCount(), 1);
  assert.equal(session.appUserId, 'user-4');
});

test('resolveCsrfProtectionMode defaults to required and accepts an explicit disabled mode', () => {
  assert.equal(resolveCsrfProtectionMode(undefined), csrfProtectionModes.required);
  assert.equal(resolveCsrfProtectionMode(' disabled '), csrfProtectionModes.disabled);
});

test('resolveCsrfProtectionMode rejects invalid mode values', () => {
  assert.throws(
    () => resolveCsrfProtectionMode('optional'),
    (error) => error instanceof Error
      && error.message === `Invalid ${csrfProtectionModeEnvVar} value: optional. Expected "required" or "disabled".`,
  );
});

test('createRequireCsrf skips header enforcement when csrf protection is disabled explicitly', () => {
  const requireCsrf = createRequireCsrf({ mode: csrfProtectionModes.disabled });

  assert.doesNotThrow(() => requireCsrf({ headers: {} }, { csrfToken: null, csrfTokenHash: null }));
});

test('createRequireCsrf enforces csrf headers when protection remains enabled', () => {
  const requireCsrf = createRequireCsrf({ mode: csrfProtectionModes.required });

  assert.throws(
    () => requireCsrf({ headers: {} }, { csrfToken: 'csrf-token', csrfTokenHash: 'csrf-hash' }),
    (error) => error?.status === 403
      && error?.code === 'csrf_required'
      && error?.message === 'CSRF token is required',
  );
});

test('createRequireCsrf can resolve the mode from request-scoped deployment policy', () => {
  const requireCsrf = createRequireCsrf({
    modeResolver(request) {
      return request.deploymentSecurityPolicy?.csrfProtectionMode;
    },
  });

  assert.doesNotThrow(() => requireCsrf({ deploymentSecurityPolicy: { csrfProtectionMode: 'disabled' }, headers: {} }, {
    csrfToken: null,
    csrfTokenHash: null,
  }));
});

test('setAuthCookies and clearAuthCookies honor request-scoped secure cookie policy', () => {
  const response = {
    locals: {
      deploymentSecurityPolicy: {
        secureCookies: true,
      },
    },
    setHeader(name, value) {
      this.header = { name, value };
    },
  };

  setAuthCookies(response, 'refresh-token', 'csrf-token', 60);
  assert.equal(response.header.name, 'Set-Cookie');
  assert.match(response.header.value[0], /Secure/);
  assert.match(response.header.value[1], /Secure/);

  clearAuthCookies(response);
  assert.equal(response.header.name, 'Set-Cookie');
  assert.match(response.header.value[0], /Secure/);
  assert.match(response.header.value[1], /Secure/);
});