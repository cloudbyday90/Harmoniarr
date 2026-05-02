import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppUserProvisioningService } from '../../src/server/app-user-provisioning-service.js';

function createUser(overrides = {}) {
  return {
    authProvider: 'local',
    id: 'user-1',
    managedLibraryRelativeRoot: 'listeners/listener',
    username: 'listener',
    ...overrides,
  };
}

test('createAppUserProvisioningService provisions a managed user directory under the shared music root', async (t) => {
  const mkdirFn = t.mock.fn(async () => '/data/music/users');
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createAppUserProvisioningService({
    getAppUserById: t.mock.fn(async () => createUser()),
    loadSettingsFn: t.mock.fn(async () => ({ paths: { music: '/data/music' } })),
    mkdirFn,
    realpathFn: t.mock.fn(async () => '/srv/music/users/listeners/listener'),
    recordAuditEventFn,
    statFn: t.mock.fn(async () => ({ isDirectory: () => true })),
  });

  const result = await service.provisionManagedLibraryRoot({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.9', userAgent: 'HarmoniarrTest/1.0' },
    userId: 'user-1',
  });

  assert.deepEqual(mkdirFn.mock.calls[0].arguments, ['/data/music/users/listeners/listener', { recursive: true }]);
  assert.deepEqual(result, {
    provisioning: {
      authProvider: 'local',
      configuredBy: 'app_user',
      created: true,
      id: 'user-1',
      relativeRoot: 'listeners/listener',
      resolvedPath: '/srv/music/users/listeners/listener',
      userRootPath: '/data/music/users/listeners/listener',
      username: 'listener',
    },
    user: createUser(),
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'app_user_managed_library_root_provisioned');
});

test('createAppUserProvisioningService reports existing directories without treating them as a new create', async (t) => {
  const service = createAppUserProvisioningService({
    getAppUserById: t.mock.fn(async () => createUser()),
    loadSettingsFn: t.mock.fn(async () => ({ paths: { music: '/data/music' } })),
    mkdirFn: t.mock.fn(async () => undefined),
    realpathFn: t.mock.fn(async () => '/data/music/users/listeners/listener'),
    recordAuditEventFn: t.mock.fn(async () => {}),
    statFn: t.mock.fn(async () => ({ isDirectory: () => true })),
  });

  const result = await service.provisionManagedLibraryRoot({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '203.0.113.9', userAgent: 'HarmoniarrTest/1.0' },
    userId: 'user-1',
  });

  assert.equal(result.provisioning.created, false);
});

test('createAppUserProvisioningService rejects provisioning when no managed library root is configured', async () => {
  const service = createAppUserProvisioningService({
    getAppUserById: async () => createUser({ managedLibraryRelativeRoot: null }),
  });

  await assert.rejects(
    () => service.provisionManagedLibraryRoot({ actorUserId: 'admin-1', userId: 'user-1' }),
    (error) => error?.code === 'app_user_managed_library_root_unconfigured',
  );
});

test('createAppUserProvisioningService claims a generated managed root for the current user before provisioning', async (t) => {
  const recordAuditEventFn = t.mock.fn(async () => {});
  let currentUser = createUser({
    id: 'user-7',
    managedLibraryRelativeRoot: null,
    username: 'Plex Listener',
  });
  const service = createAppUserProvisioningService({
    getAppUserById: t.mock.fn(async () => currentUser),
    loadSettingsFn: t.mock.fn(async () => ({ paths: { music: '/data/music' } })),
    mkdirFn: t.mock.fn(async () => '/data/music/users'),
    realpathFn: t.mock.fn(async () => '/srv/music/users/listeners/plex-listener'),
    recordAuditEventFn,
    statFn: t.mock.fn(async () => ({ isDirectory: () => true })),
    updateAppUser: t.mock.fn(async ({ managedLibraryRelativeRoot }) => {
      currentUser = {
        ...currentUser,
        managedLibraryRelativeRoot,
      };
      return currentUser;
    }),
  });

  const result = await service.claimManagedLibraryRoot({
    actorUserId: 'user-7',
    requestMetadata: { ipAddress: '203.0.113.11', userAgent: 'HarmoniarrTest/1.0' },
  });

  assert.equal(result.user.managedLibraryRelativeRoot, 'listeners/plex-listener');
  assert.equal(result.provisioning.relativeRoot, 'listeners/plex-listener');
  assert.equal(recordAuditEventFn.mock.callCount(), 2);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'app_user_managed_library_root_claimed');
  assert.equal(recordAuditEventFn.mock.calls[1].arguments[0].eventType, 'app_user_managed_library_root_provisioned');
});

test('createAppUserProvisioningService rejects claim requests that try to replace an existing managed root', async () => {
  const service = createAppUserProvisioningService({
    getAppUserById: async () => createUser({ id: 'user-1', managedLibraryRelativeRoot: 'listeners/listener' }),
  });

  await assert.rejects(
    () => service.claimManagedLibraryRoot({
      actorUserId: 'user-1',
      managedLibraryRelativeRoot: 'listeners/other',
    }),
    (error) => error?.code === 'app_user_managed_library_root_already_claimed',
  );
});