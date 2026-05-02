import assert from 'node:assert/strict';
import test from 'node:test';
import { registerAppUserRoutes } from '../../src/server/routes/app-user-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createAppUserRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAppUserRoutes(app, {
      claimManagedLibraryRoot: async ({ actorUserId }) => ({
        provisioning: {
          authProvider: 'local',
          configuredBy: 'app_user',
          created: true,
          id: actorUserId,
          relativeRoot: 'listeners/listener',
          resolvedPath: '/data/music/users/listeners/listener',
          userRootPath: '/data/music/users/listeners/listener',
          username: 'listener',
        },
        user: { id: actorUserId, username: 'listener', role: 'requester', authProvider: 'local', managedLibraryRelativeRoot: 'listeners/listener', permissions: ['media.request'] },
      }),
      createAppUser: async ({ username, role, managedLibraryRelativeRoot }) => ({ id: 'user-2', username, role, managedLibraryRelativeRoot, authProvider: 'local', permissions: ['media.request'] }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      listAppUsers: async () => [{ id: 'user-1', username: 'admin', role: 'admin', authProvider: 'local', managedLibraryRelativeRoot: 'staff/admin', permissions: ['admin.system'] }],
      provisionManagedLibraryRoot: async ({ userId }) => ({
        provisioning: {
          authProvider: 'local',
          configuredBy: 'app_user',
          created: true,
          id: userId,
          relativeRoot: 'listeners/listener',
          resolvedPath: '/data/music/users/listeners/listener',
          userRootPath: '/data/music/users/listeners/listener',
          username: 'listener',
        },
        user: { id: userId, username: 'listener', role: 'requester', authProvider: 'local', managedLibraryRelativeRoot: 'listeners/listener', permissions: ['media.request'] },
      }),
      requireAdminSession: async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }),
      requireCsrf: () => {},
      requireFreshAdminSession: async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }),
      requireFreshSession: async () => ({ appUserId: 'user-2', csrfToken: 'csrf-users-self', user: { role: 'requester' } }),
      roleOptions: ['admin', 'operator', 'requester'],
      updateAppUser: async ({ userId, role, isDisabled, managedLibraryRelativeRoot }) => ({
        id: userId,
        isDisabled,
        managedLibraryRelativeRoot,
        permissions: ['media.request'],
        role,
        authProvider: 'local',
        username: 'listener',
      }),
      ...overrides,
    });
  });
}

test('app user list route returns shared users and role options', async (t) => {
  const listAppUsers = t.mock.fn(async () => [{ id: 'user-1', username: 'admin', role: 'admin', authProvider: 'local', managedLibraryRelativeRoot: 'staff/admin', permissions: ['admin.system'] }]);
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }));
  const app = createAppUserRouteTestApp({ listAppUsers, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(listAppUsers.mock.callCount(), 1);
    assert.deepEqual(payload, {
      ok: true,
      roleOptions: ['admin', 'operator', 'requester'],
      users: [{ id: 'user-1', username: 'admin', role: 'admin', authProvider: 'local', managedLibraryRelativeRoot: 'staff/admin', permissions: ['admin.system'] }],
    });
  });
});

test('app user create route passes actor and request metadata to the shared service', async (t) => {
  const createAppUser = t.mock.fn(async ({ username, role, actorUserId, requestMetadata, managedLibraryRelativeRoot }) => ({
    id: 'user-2',
    managedLibraryRelativeRoot,
    permissions: ['media.request'],
    role,
    authProvider: 'local',
    username,
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const app = createAppUserRouteTestApp({ createAppUser, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.7',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
      body: JSON.stringify({ managedLibraryRelativeRoot: 'listeners/listener', password: 'password-1234', role: 'requester', username: 'listener' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(createAppUser.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      managedLibraryRelativeRoot: 'listeners/listener',
      password: 'password-1234',
      requestMetadata: {
        ipAddress: '198.51.100.7',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      role: 'requester',
      username: 'listener',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      roleOptions: ['admin', 'operator', 'requester'],
      user: {
        id: 'user-2',
        authProvider: 'local',
        managedLibraryRelativeRoot: 'listeners/listener',
        permissions: ['media.request'],
        role: 'requester',
        username: 'listener',
      },
    });
  });
});

test('app user update route passes role and disabled state to the shared service', async (t) => {
  const updateAppUser = t.mock.fn(async ({ userId, role, isDisabled, managedLibraryRelativeRoot }) => ({
    id: userId,
    isDisabled,
    managedLibraryRelativeRoot,
    permissions: ['media.request'],
    role,
    authProvider: 'local',
    username: 'listener',
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const app = createAppUserRouteTestApp({ requireCsrf, requireFreshAdminSession, updateAppUser });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/user-2`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.8',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
      body: JSON.stringify({ isDisabled: true, managedLibraryRelativeRoot: 'listeners/listener', role: 'operator' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(updateAppUser.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      isDisabled: true,
      managedLibraryRelativeRoot: 'listeners/listener',
      requestMetadata: {
        ipAddress: '198.51.100.8',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      role: 'operator',
      userId: 'user-2',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      user: {
        id: 'user-2',
        authProvider: 'local',
        isDisabled: true,
        managedLibraryRelativeRoot: 'listeners/listener',
        permissions: ['media.request'],
        role: 'operator',
        username: 'listener',
      },
    });
  });
});

test('app user provisioning route provisions the configured managed library root through the shared service', async (t) => {
  const provisionManagedLibraryRoot = t.mock.fn(async ({ userId }) => ({
    provisioning: {
      authProvider: 'local',
      configuredBy: 'app_user',
      created: true,
      id: userId,
      relativeRoot: 'listeners/listener',
      resolvedPath: '/data/music/users/listeners/listener',
      userRootPath: '/data/music/users/listeners/listener',
      username: 'listener',
    },
    user: {
      id: userId,
      authProvider: 'local',
      managedLibraryRelativeRoot: 'listeners/listener',
      permissions: ['media.request'],
      role: 'requester',
      username: 'listener',
    },
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const app = createAppUserRouteTestApp({ provisionManagedLibraryRoot, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/user-2/provision-managed-library-root`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.9',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(provisionManagedLibraryRoot.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      requestMetadata: {
        ipAddress: '198.51.100.9',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      userId: 'user-2',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.provisioning.userRootPath, '/data/music/users/listeners/listener');
    assert.equal(payload.user.id, 'user-2');
  });
});

test('app user self-claim route claims and provisions a managed library root for the current session user', async (t) => {
  const claimManagedLibraryRoot = t.mock.fn(async ({ actorUserId }) => ({
    provisioning: {
      authProvider: 'local',
      configuredBy: 'app_user',
      created: true,
      id: actorUserId,
      relativeRoot: 'listeners/listener',
      resolvedPath: '/data/music/users/listeners/listener',
      userRootPath: '/data/music/users/listeners/listener',
      username: 'listener',
    },
    user: {
      id: actorUserId,
      authProvider: 'local',
      managedLibraryRelativeRoot: 'listeners/listener',
      permissions: ['media.request'],
      role: 'requester',
      username: 'listener',
    },
  }));
  const requireFreshSession = t.mock.fn(async () => ({ appUserId: 'user-2', csrfToken: 'csrf-users-self', user: { role: 'requester' } }));
  const requireCsrf = t.mock.fn();
  const app = createAppUserRouteTestApp({ claimManagedLibraryRoot, requireCsrf, requireFreshSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/me/claim-managed-library-root`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users-self',
        'x-forwarded-for': '198.51.100.19',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
      body: JSON.stringify({ managedLibraryRelativeRoot: 'listeners/listener' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(claimManagedLibraryRoot.mock.calls[0].arguments, [{
      actorUserId: 'user-2',
      managedLibraryRelativeRoot: 'listeners/listener',
      requestMetadata: {
        ipAddress: '198.51.100.19',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.provisioning.id, 'user-2');
    assert.equal(payload.user.id, 'user-2');
  });
});