import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppUserService } from '../../src/server/app-user-service.js';

test('createAppUserService lists users with resolved permission sets', async (t) => {
  const getPoolFn = t.mock.fn(() => ({
    query: t.mock.fn(async () => ({
      rows: [{
        auth_provider: 'local',
        auth_subject: null,
        created_at: '2026-05-02T15:00:00.000Z',
        id: 'user-1',
        is_disabled: false,
        last_login_at: null,
        managed_library_relative_root: 'listeners/listener',
        must_change_password: true,
        password_changed_at: '2026-05-01T14:00:00.000Z',
        role: 'requester',
        updated_at: '2026-05-02T15:00:00.000Z',
        username: 'listener',
      }],
    })),
  }));
  const service = createAppUserService({ getPoolFn });

  const users = await service.listAppUsers();

  assert.deepEqual(users, [{
    authProvider: 'local',
    authSubject: null,
    createdAt: '2026-05-02T15:00:00.000Z',
    email: null,
    id: 'user-1',
    isDisabled: false,
    lastLoginAt: null,
    localAuth: {
      hasConfiguredPassword: true,
      mustChangePassword: true,
      passwordChangedAt: '2026-05-01T14:00:00.000Z',
      unlinkPlexBlockedReason: null,
      unlinkPlexReady: true,
    },
    managedLibraryRelativeRoot: 'listeners/listener',
    mustChangePassword: true,
    permissions: ['import.preview.self', 'media.request', 'playlist.submit'],
    plexProfile: null,
    role: 'requester',
    updatedAt: '2026-05-02T15:00:00.000Z',
    username: 'listener',
  }]);
});

test('createAppUserService creates a user with the requested role and audit evidence', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      auth_provider: 'local',
      auth_subject: null,
      created_at: '2026-05-02T15:05:00.000Z',
      id: 'user-2',
      is_disabled: false,
      last_login_at: null,
      managed_library_relative_root: 'owned/curator',
      must_change_password: true,
      password_changed_at: '2026-05-02T15:05:00.000Z',
      role: 'operator',
      updated_at: '2026-05-02T15:05:00.000Z',
      username: 'curator',
    }],
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createAppUserService({
    getPoolFn: () => ({ query }),
    hashPasswordFn: t.mock.fn(async () => 'hashed-password'),
    recordAuditEventFn,
  });

  const user = await service.createAppUser({
    actorUserId: 'admin-1',
    managedLibraryRelativeRoot: 'owned/curator',
    password: 'password-1234',
    requestMetadata: {
      ipAddress: '203.0.113.9',
      userAgent: 'HarmoniarrTest/1.0',
    },
    role: 'operator',
    username: 'Curator',
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments, [
    `
          INSERT INTO app_users (
            username,
            password_hash,
            role,
            managed_library_relative_root,
            must_change_password,
            password_changed_at
          )
          VALUES ($1, $2, $3, $4, TRUE, NOW())
          RETURNING *
        `,
    ['curator', 'hashed-password', 'operator', 'owned/curator'],
  ]);
  assert.deepEqual(user, {
    authProvider: 'local',
    authSubject: null,
    createdAt: '2026-05-02T15:05:00.000Z',
    email: null,
    id: 'user-2',
    isDisabled: false,
    lastLoginAt: null,
    localAuth: {
      hasConfiguredPassword: true,
      mustChangePassword: true,
      passwordChangedAt: '2026-05-02T15:05:00.000Z',
      unlinkPlexBlockedReason: null,
      unlinkPlexReady: true,
    },
    managedLibraryRelativeRoot: 'owned/curator',
    mustChangePassword: true,
    permissions: ['import.execute', 'import.review', 'library.discovery', 'library.scan', 'media.request', 'playlist.submit'],
    plexProfile: null,
    role: 'operator',
    updatedAt: '2026-05-02T15:05:00.000Z',
    username: 'curator',
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'app_user_created');
});

test('createAppUserService updates user role and disabled state', async (t) => {
  const query = t.mock.fn(async () => ({
    rowCount: 1,
    rows: [{
      auth_provider: 'local',
      auth_subject: null,
      created_at: '2026-05-02T15:05:00.000Z',
      id: 'user-2',
      is_disabled: true,
      last_login_at: null,
      managed_library_relative_root: 'owned/listener',
      must_change_password: true,
      password_changed_at: '2026-05-02T15:05:00.000Z',
      role: 'requester',
      updated_at: '2026-05-02T16:00:00.000Z',
      username: 'curator',
    }],
  }));
  const service = createAppUserService({
    getPoolFn: () => ({ query }),
    recordAuditEventFn: t.mock.fn(async () => {}),
  });

  const user = await service.updateAppUser({
    actorUserId: 'admin-1',
    isDisabled: true,
    managedLibraryRelativeRoot: 'owned/listener',
    requestMetadata: { ipAddress: '203.0.113.9', userAgent: 'HarmoniarrTest/1.0' },
    role: 'requester',
    userId: 'user-2',
  });

  assert.equal(query.mock.callCount(), 1);
  assert.equal(user.authProvider, 'local');
  assert.equal(user.isDisabled, true);
  assert.equal(user.managedLibraryRelativeRoot, 'owned/listener');
  assert.equal(user.role, 'requester');
  assert.deepEqual(user.permissions, ['import.preview.self', 'media.request', 'playlist.submit']);
});

test('createAppUserService resolves users by id for import target ownership lookups', async (t) => {
  const service = createAppUserService({
    getPoolFn: () => ({
      query: t.mock.fn(async () => ({
        rowCount: 1,
        rows: [{
          auth_provider: 'local',
          auth_subject: null,
          created_at: '2026-05-02T15:00:00.000Z',
          id: 'user-1',
          is_disabled: false,
          last_login_at: null,
          managed_library_relative_root: 'listeners/listener',
          must_change_password: true,
          password_changed_at: '2026-05-01T14:00:00.000Z',
          role: 'requester',
          updated_at: '2026-05-02T15:00:00.000Z',
          username: 'listener',
        }],
      })),
    }),
  });

  const user = await service.getAppUserById({ userId: 'user-1' });

  assert.equal(user.id, 'user-1');
  assert.equal(user.managedLibraryRelativeRoot, 'listeners/listener');
});

test('createAppUserService resets a user password, requires password change, and revokes sessions', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rowCount: 0, rows: [] };
    }

    if (String(sql).includes('UPDATE app_users')) {
      return {
        rowCount: 1,
        rows: [{
          auth_provider: 'plex',
          auth_subject: 'plex-user-1',
          created_at: '2026-05-02T15:05:00.000Z',
          id: 'user-2',
          is_disabled: false,
          last_login_at: null,
          managed_library_relative_root: null,
          must_change_password: true,
          password_changed_at: '2026-05-04T18:00:00.000Z',
          role: 'requester',
          updated_at: '2026-05-04T18:00:00.000Z',
          username: 'plex-friend',
        }],
      };
    }

    if (String(sql).includes('UPDATE refresh_tokens')) {
      return { rowCount: 3, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  });
  const client = {
    query,
    release: t.mock.fn(),
  };
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createAppUserService({
    getPoolFn: () => ({ connect: async () => client }),
    hashPasswordFn: t.mock.fn(async () => 'hashed-password'),
    recordAuditEventFn,
  });

  const result = await service.resetAppUserPassword({
    actorUserId: 'admin-1',
    password: 'password-1234',
    requestMetadata: { ipAddress: '203.0.113.10', userAgent: 'HarmoniarrTest/1.0' },
    userId: 'user-2',
  });

  assert.equal(result.user.id, 'user-2');
  assert.equal(result.user.mustChangePassword, true);
  assert.equal(result.user.authProvider, 'plex');
  assert.equal(result.user.localAuth.unlinkPlexReady, true);
  assert.equal(result.revokedSessionCount, 3);
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'app_user_password_reset');
});
