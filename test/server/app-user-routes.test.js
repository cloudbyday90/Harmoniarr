import assert from 'node:assert/strict';
import test from 'node:test';
import { registerAppUserRoutes } from '../../src/server/routes/app-user-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createAppUserRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAppUserRoutes(app, {
      applyPlexDirectoryImport: async ({ actorUserId }) => ({
        appliedAt: '2026-05-03T12:00:00.000Z',
        importedUsers: [{ id: 'user-plex-1', username: 'plex-friend', role: 'requester', authProvider: 'plex' }],
        linkedOwner: { id: 'owner-1', title: 'Owner Account' },
        profiles: [],
        summary: {
          conflicts: 0,
          created: 1,
          importable: 1,
          linked: 0,
          ownerAccounts: 1,
          skipped: 0,
          total: 2,
          updated: 0,
        },
        triggeredBy: actorUserId,
      }),
      buildPlexDirectoryImportPreview: async () => ({
        fetchedAt: '2026-05-03T11:55:00.000Z',
        linkedOwner: { id: 'owner-1', title: 'Owner Account' },
        profiles: [{
          classification: 'create',
          email: 'friend@example.com',
          homeRole: 'home_member',
          id: 'plex-1',
          libraryAccessDetails: { serverIds: ['server-1'] },
          libraryAccessState: 'shared',
          suggestedUsername: 'plex-friend',
          title: 'Friend',
          username: 'friend',
          uuid: 'plex-uuid-1',
        }],
        summary: {
          conflicts: 0,
          importable: 1,
          linked: 0,
          ownerAccounts: 1,
          skipped: 0,
          total: 2,
        },
      }),
      buildPlexLinkedAccountOverview: async () => ({
        checkedAt: '2026-05-03T11:56:00.000Z',
        conflictProfiles: [],
        importableProfiles: [],
        linkedUsers: [{ id: 'user-plex-1', repairState: 'healthy', unlinkReady: true, username: 'plex-friend' }],
        ownerLink: { linked: true, linkedUserTitle: 'Owner Account' },
        previewLinkedProfiles: [],
        previewStatus: { code: null, message: 'Plex linked-account preview is current.', state: 'ready' },
        summary: {
          conflictProfiles: 0,
          importableProfiles: 0,
          linkedUsers: 1,
          ownerLinked: true,
          previewLinkedProfiles: 0,
          repairRequiredUsers: 0,
          staleUsers: 0,
          unlinkBlockedUsers: 0,
          unlinkReadyUsers: 1,
        },
      }),
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
      issueAppUserClaimCode: async ({ userId }) => ({
        claimCode: 'HCLM-ABCD-EFGH-JKLM',
        expiresAt: '2026-05-05T01:00:00.000Z',
        replacedExistingClaim: false,
        user: {
          id: userId,
          username: 'listener',
          role: 'requester',
          authProvider: 'plex',
          mustChangePassword: false,
          managedLibraryRelativeRoot: 'listeners/listener',
          permissions: ['media.request'],
        },
      }),
      listAppUsers: async () => [{ id: 'user-1', username: 'admin', role: 'admin', authProvider: 'local', managedLibraryRelativeRoot: 'staff/admin', permissions: ['admin.system'] }],
      resetAppUserPassword: async ({ userId }) => ({
        revokedSessionCount: 0,
        user: {
          id: userId,
          username: 'listener',
          role: 'requester',
          authProvider: 'local',
          mustChangePassword: true,
          managedLibraryRelativeRoot: 'listeners/listener',
          permissions: ['media.request'],
        },
      }),
      unlinkPlexAppUser: async ({ userId }) => ({
        unlinkedAt: '2026-05-04T10:30:00.000Z',
        user: {
          id: userId,
          username: 'listener',
          role: 'requester',
          authProvider: 'local',
          authSubject: null,
          localAuth: {
            hasConfiguredPassword: true,
            mustChangePassword: true,
            passwordChangedAt: '2026-05-04T18:00:00.000Z',
            unlinkPlexBlockedReason: null,
            unlinkPlexReady: true,
          },
          managedLibraryRelativeRoot: 'listeners/listener',
          permissions: ['media.request'],
        },
      }),
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

test('app user claim-code route passes actor and request metadata to the shared claim service', async (t) => {
  const issueAppUserClaimCode = t.mock.fn(async ({ userId }) => ({
    claimCode: 'HCLM-ABCD-EFGH-JKLM',
    expiresAt: '2026-05-05T01:00:00.000Z',
    replacedExistingClaim: true,
    user: {
      id: userId,
      authProvider: 'plex',
      managedLibraryRelativeRoot: 'listeners/listener',
      mustChangePassword: false,
      permissions: ['media.request'],
      role: 'requester',
      username: 'listener',
    },
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const app = createAppUserRouteTestApp({ issueAppUserClaimCode, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/user-2/claim-code`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.11',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
      body: JSON.stringify({ ttlMinutes: 30 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(issueAppUserClaimCode.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      requestMetadata: {
        ipAddress: '198.51.100.11',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      ttlMinutes: 30,
      userId: 'user-2',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.claimCode, 'HCLM-ABCD-EFGH-JKLM');
    assert.equal(payload.replacedExistingClaim, true);
    assert.equal(payload.user.authProvider, 'plex');
  });
});

test('app user reset-password route passes actor and temporary password to the shared service', async (t) => {
  const resetAppUserPassword = t.mock.fn(async ({ userId }) => ({
    revokedSessionCount: 2,
    user: {
      id: userId,
      authProvider: 'plex',
      managedLibraryRelativeRoot: 'listeners/listener',
      mustChangePassword: true,
      permissions: ['media.request'],
      role: 'requester',
      username: 'listener',
    },
  }));
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const requireCsrf = t.mock.fn();
  const app = createAppUserRouteTestApp({ requireCsrf, requireFreshAdminSession, resetAppUserPassword });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/user-2/reset-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.10',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
      body: JSON.stringify({ password: 'password-1234' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(resetAppUserPassword.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      password: 'password-1234',
      requestMetadata: {
        ipAddress: '198.51.100.10',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      userId: 'user-2',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.revokedSessionCount, 2);
    assert.equal(payload.user.mustChangePassword, true);
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

test('app user Plex preview route returns the classified directory preview for admins', async (t) => {
  const buildPlexDirectoryImportPreview = t.mock.fn(async () => ({
    fetchedAt: '2026-05-03T11:55:00.000Z',
    linkedOwner: { id: 'owner-1', title: 'Owner Account' },
    profiles: [{
      classification: 'create',
      id: 'plex-1',
      suggestedUsername: 'plex-friend',
      title: 'Friend',
    }],
    summary: {
      conflicts: 0,
      importable: 1,
      linked: 0,
      ownerAccounts: 1,
      skipped: 0,
      total: 2,
    },
  }));
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }));
  const app = createAppUserRouteTestApp({ buildPlexDirectoryImportPreview, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/imports/plex/preview`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(buildPlexDirectoryImportPreview.mock.callCount(), 1);
    assert.equal(payload.ok, true);
    assert.equal(payload.summary.importable, 1);
    assert.equal(payload.profiles[0].suggestedUsername, 'plex-friend');
  });
});

test('app user Plex linked accounts overview route returns the aggregated management payload for admins', async (t) => {
  const buildPlexLinkedAccountOverview = t.mock.fn(async () => ({
    checkedAt: '2026-05-03T11:56:00.000Z',
    conflictProfiles: [],
    importableProfiles: [],
    linkedUsers: [{ id: 'user-plex-1', repairState: 'healthy', unlinkReady: true, username: 'plex-friend' }],
    ownerLink: { linked: true, linkedUserTitle: 'Owner Account' },
    previewLinkedProfiles: [],
    previewStatus: { code: null, message: 'Plex linked-account preview is current.', state: 'ready' },
    summary: {
      conflictProfiles: 0,
      importableProfiles: 0,
      linkedUsers: 1,
      ownerLinked: true,
      previewLinkedProfiles: 0,
      repairRequiredUsers: 0,
      staleUsers: 0,
      unlinkBlockedUsers: 0,
      unlinkReadyUsers: 1,
    },
  }));
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', user: { role: 'admin' } }));
  const app = createAppUserRouteTestApp({ buildPlexLinkedAccountOverview, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/linked-accounts/plex`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(buildPlexLinkedAccountOverview.mock.callCount(), 1);
    assert.equal(payload.ok, true);
    assert.equal(payload.summary.linkedUsers, 1);
    assert.equal(payload.ownerLink.linked, true);
    assert.equal(payload.linkedUsers[0].username, 'plex-friend');
  });
});

test('app user Plex import route applies the import through the shared service', async (t) => {
  const applyPlexDirectoryImport = t.mock.fn(async ({ actorUserId, requestMetadata }) => ({
    appliedAt: '2026-05-03T12:00:00.000Z',
    importedUsers: [{ id: 'user-plex-1', username: 'plex-friend', role: 'requester', authProvider: 'plex' }],
    profiles: [],
    summary: {
      conflicts: 0,
      created: 1,
      importable: 1,
      linked: 0,
      ownerAccounts: 1,
      skipped: 0,
      total: 2,
      updated: 0,
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const app = createAppUserRouteTestApp({ applyPlexDirectoryImport, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/imports/plex/apply`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.20',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(applyPlexDirectoryImport.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      requestMetadata: {
        ipAddress: '198.51.100.20',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.summary.created, 1);
    assert.equal(payload.importedUsers[0].authProvider, 'plex');
  });
});

test('app user Plex relink route resolves a conflict through the shared service', async (t) => {
  const relinkPlexDirectoryConflict = t.mock.fn(async ({ actorUserId, plexUserId, requestMetadata, userId }) => ({
    linkedAt: '2026-05-04T10:00:00.000Z',
    profile: {
      classification: 'linked',
      existingUser: { id: userId, username: 'conflict-user' },
      id: plexUserId,
    },
    user: {
      authProvider: 'plex',
      authSubject: 'plex-conflict-uuid',
      id: userId,
      username: 'conflict-user',
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const app = createAppUserRouteTestApp({ relinkPlexDirectoryConflict, requireCsrf, requireFreshAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/imports/plex/relink`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.21',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
      body: JSON.stringify({ plexUserId: 'plex-1', userId: 'user-conflict' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(relinkPlexDirectoryConflict.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      plexUserId: 'plex-1',
      requestMetadata: {
        ipAddress: '198.51.100.21',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      userId: 'user-conflict',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.user.authProvider, 'plex');
    assert.equal(payload.profile.classification, 'linked');
  });
});

test('app user Plex unlink route passes actor and request metadata to the shared service', async (t) => {
  const unlinkPlexAppUser = t.mock.fn(async ({ actorUserId, requestMetadata, userId }) => ({
    unlinkedAt: '2026-05-04T10:30:00.000Z',
    user: {
      authProvider: 'local',
      authSubject: null,
      id: userId,
      localAuth: {
        hasConfiguredPassword: true,
        mustChangePassword: true,
        passwordChangedAt: '2026-05-04T18:00:00.000Z',
        unlinkPlexBlockedReason: null,
        unlinkPlexReady: true,
      },
      username: 'conflict-user',
    },
  }));
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'admin-1', csrfToken: 'csrf-users', user: { role: 'admin' } }));
  const app = createAppUserRouteTestApp({ requireCsrf, requireFreshAdminSession, unlinkPlexAppUser });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/users/user-conflict/unlink-plex`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-users',
        'x-forwarded-for': '198.51.100.22',
        'user-agent': 'HarmoniarrUsersTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.deepEqual(unlinkPlexAppUser.mock.calls[0].arguments, [{
      actorUserId: 'admin-1',
      requestMetadata: {
        ipAddress: '198.51.100.22',
        userAgent: 'HarmoniarrUsersTest/1.0',
      },
      userId: 'user-conflict',
    }]);
    assert.equal(payload.ok, true);
    assert.equal(payload.user.authProvider, 'local');
    assert.equal(payload.user.localAuth.unlinkPlexReady, true);
  });
});
