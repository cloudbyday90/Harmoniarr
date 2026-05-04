import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlexDirectoryImportService } from '../../src/server/integrations/plex/plex-directory-import-service.js';

test('createPlexDirectoryImportService buildPreview classifies owner, linked, conflict, and importable profiles', async () => {
  const service = createPlexDirectoryImportService({
    getNow: () => new Date('2026-05-03T12:00:00.000Z'),
    listAppUsers: async () => [
      {
        authProvider: 'plex',
        authSubject: 'plex-linked-uuid',
        email: 'linked@example.com',
        id: 'user-linked',
        isDisabled: false,
        managedLibraryRelativeRoot: 'listeners/linked',
        plexProfile: null,
        role: 'requester',
        username: 'linked-user',
      },
      {
        authProvider: 'local',
        authSubject: null,
        email: 'conflict@example.com',
        id: 'user-conflict',
        isDisabled: false,
        managedLibraryRelativeRoot: 'listeners/conflict',
        plexProfile: null,
        role: 'requester',
        username: 'conflict-user',
      },
    ],
    plexHttpClient: {
      fetchHomeUsers: async () => [
        { email: 'owner@example.com', id: 'owner-id', title: 'Owner', username: 'owner.admin', uuid: 'owner-uuid' },
        { email: 'linked@example.com', id: 'linked-id', title: 'Linked User', username: 'linked-user', uuid: 'plex-linked-uuid' },
        { email: 'conflict@example.com', id: 'conflict-id', title: 'Conflict User', username: 'conflict-user', uuid: 'plex-conflict-uuid' },
        { email: 'importable@example.com', id: 'importable-id', title: 'Importable User', username: 'Importable.User', uuid: 'plex-importable-uuid', servers: ['server-1'] },
      ],
    },
    plexOwnerLinkService: {
      resolveLinkedAccessToken: async () => ({
        accessToken: 'plex-access-token',
        clientIdentifier: 'plex-client-id',
        linkedUser: {
          email: 'owner@example.com',
          id: 'owner-id',
          title: 'Owner',
          username: 'owner.admin',
          uuid: 'owner-uuid',
        },
      }),
    },
  });

  const preview = await service.buildPreview();

  assert.equal(preview.summary.total, 4);
  assert.equal(preview.summary.ownerAccounts, 1);
  assert.equal(preview.summary.linked, 1);
  assert.equal(preview.summary.conflicts, 1);
  assert.equal(preview.summary.importable, 1);

  const ownerProfile = preview.profiles.find((profile) => profile.id === 'owner-id');
  const linkedProfile = preview.profiles.find((profile) => profile.id === 'linked-id');
  const conflictProfile = preview.profiles.find((profile) => profile.id === 'conflict-id');
  const importableProfile = preview.profiles.find((profile) => profile.id === 'importable-id');

  assert.equal(ownerProfile.classification, 'owner_account');
  assert.equal(linkedProfile.classification, 'linked');
  assert.equal(conflictProfile.classification, 'conflict');
  assert.equal(conflictProfile.conflictReason, 'email_match');
  assert.equal(importableProfile.classification, 'create');
  assert.equal(importableProfile.suggestedUsername, 'importable.user');
  assert.equal(importableProfile.libraryAccessState, 'shared');
});

test('createPlexDirectoryImportService applyImport creates new Plex users and refreshes linked metadata', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rows: [] };
    }

    if (String(sql).includes('INSERT INTO app_users')) {
      return {
        rows: [{
          auth_provider: 'plex',
          auth_subject: values[3],
          created_at: '2026-05-03T12:00:00.000Z',
          email: values[1],
          id: 'user-imported-1',
          is_disabled: false,
          last_login_at: null,
          managed_library_relative_root: null,
          must_change_password: false,
          role: 'requester',
          updated_at: '2026-05-03T12:00:00.000Z',
          username: values[0],
        }],
      };
    }

    return { rows: [] };
  });
  const client = {
    query,
    release: t.mock.fn(),
  };
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createPlexDirectoryImportService({
    getNow: () => new Date('2026-05-03T12:00:00.000Z'),
    getPoolFn: () => ({
      connect: async () => client,
    }),
    hashPasswordFn: t.mock.fn(async () => 'hashed-placeholder-password'),
    listAppUsers: async () => [{
      authProvider: 'plex',
      authSubject: 'plex-linked-uuid',
      email: 'linked@example.com',
      id: 'user-linked',
      isDisabled: false,
      managedLibraryRelativeRoot: 'listeners/linked',
      plexProfile: null,
      role: 'requester',
      username: 'linked-user',
    }],
    plexHttpClient: {
      fetchHomeUsers: async () => [
        { email: 'owner@example.com', id: 'owner-id', title: 'Owner', username: 'owner.admin', uuid: 'owner-uuid' },
        { email: 'linked@example.com', id: 'linked-id', title: 'Linked User', username: 'linked-user', uuid: 'plex-linked-uuid' },
        { email: 'importable@example.com', id: 'importable-id', title: 'Importable User', username: 'Importable.User', uuid: 'plex-importable-uuid', servers: ['server-1'] },
      ],
    },
    plexOwnerLinkService: {
      resolveLinkedAccessToken: async () => ({
        accessToken: 'plex-access-token',
        clientIdentifier: 'plex-client-id',
        linkedUser: {
          email: 'owner@example.com',
          id: 'owner-id',
          title: 'Owner',
          username: 'owner.admin',
          uuid: 'owner-uuid',
        },
      }),
    },
    recordAuditEventFn,
  });

  const result = await service.applyImport({
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
  });

  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.updated, 1);
  assert.equal(result.importedUsers.length, 1);
  assert.equal(result.importedUsers[0].authProvider, 'plex');
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(
    query.mock.calls.some((call) => String(call.arguments[0]).includes('INSERT INTO app_user_plex_profiles')),
    true,
  );
  assert.equal(
    query.mock.calls.some((call) => String(call.arguments[0]).includes('UPDATE app_user_plex_profiles')),
    true,
  );
});

test('createPlexDirectoryImportService relinkConflict links a conflicting local user to the Plex profile', async (t) => {
  const query = t.mock.fn(async (sql, values) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rowCount: 0, rows: [] };
    }

    if (String(sql).includes('UPDATE app_users')) {
      return {
        rowCount: 1,
        rows: [{
          auth_provider: 'plex',
          auth_subject: values[1],
          email: 'conflict@example.com',
          id: values[0],
          role: 'requester',
          username: 'conflict-user',
        }],
      };
    }

    if (String(sql).includes('UPDATE app_user_plex_profiles')) {
      return { rowCount: 0, rows: [] };
    }

    if (String(sql).includes('INSERT INTO app_user_plex_profiles')) {
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  });
  const client = {
    query,
    release: t.mock.fn(),
  };
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createPlexDirectoryImportService({
    getNow: () => new Date('2026-05-04T10:00:00.000Z'),
    getPoolFn: () => ({
      connect: async () => client,
    }),
    listAppUsers: async () => [{
      authProvider: 'local',
      authSubject: null,
      email: 'conflict@example.com',
      id: 'user-conflict',
      isDisabled: false,
      managedLibraryRelativeRoot: 'listeners/conflict',
      plexProfile: null,
      role: 'requester',
      username: 'conflict-user',
    }],
    plexHttpClient: {
      fetchHomeUsers: async () => [
        { email: 'owner@example.com', id: 'owner-id', title: 'Owner', username: 'owner.admin', uuid: 'owner-uuid' },
        { email: 'conflict@example.com', id: 'conflict-id', title: 'Conflict User', username: 'conflict-user', uuid: 'plex-conflict-uuid', servers: ['server-1'] },
      ],
    },
    plexOwnerLinkService: {
      resolveLinkedAccessToken: async () => ({
        accessToken: 'plex-access-token',
        clientIdentifier: 'plex-client-id',
        linkedUser: {
          email: 'owner@example.com',
          id: 'owner-id',
          title: 'Owner',
          username: 'owner.admin',
          uuid: 'owner-uuid',
        },
      }),
    },
    recordAuditEventFn,
  });

  const result = await service.relinkConflict({
    actorUserId: 'admin-1',
    plexUserId: 'conflict-id',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    userId: 'user-conflict',
  });

  assert.equal(result.user.id, 'user-conflict');
  assert.equal(result.user.authProvider, 'plex');
  assert.equal(result.user.authSubject, 'plex-conflict-uuid');
  assert.equal(result.profile.classification, 'linked');
  assert.equal(result.profile.existingUser.id, 'user-conflict');
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(
    query.mock.calls.some((call) => String(call.arguments[0]).includes('INSERT INTO app_user_plex_profiles')),
    true,
  );
});

test('createPlexDirectoryImportService relinkConflict rejects non-conflict profiles', async () => {
  const service = createPlexDirectoryImportService({
    listAppUsers: async () => [{
      authProvider: 'plex',
      authSubject: 'plex-linked-uuid',
      email: 'linked@example.com',
      id: 'user-linked',
      isDisabled: false,
      managedLibraryRelativeRoot: 'listeners/linked',
      plexProfile: null,
      role: 'requester',
      username: 'linked-user',
    }],
    plexHttpClient: {
      fetchHomeUsers: async () => [
        { email: 'owner@example.com', id: 'owner-id', title: 'Owner', username: 'owner.admin', uuid: 'owner-uuid' },
        { email: 'linked@example.com', id: 'linked-id', title: 'Linked User', username: 'linked-user', uuid: 'plex-linked-uuid' },
      ],
    },
    plexOwnerLinkService: {
      resolveLinkedAccessToken: async () => ({
        accessToken: 'plex-access-token',
        clientIdentifier: 'plex-client-id',
        linkedUser: {
          email: 'owner@example.com',
          id: 'owner-id',
          title: 'Owner',
          username: 'owner.admin',
          uuid: 'owner-uuid',
        },
      }),
    },
  });

  await assert.rejects(
    () => service.relinkConflict({ actorUserId: 'admin-1', plexUserId: 'linked-id', userId: 'user-linked' }),
    (error) => error?.code === 'plex_directory_profile_not_conflict',
  );
});
