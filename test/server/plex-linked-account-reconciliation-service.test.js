/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlexLinkedAccountReconciliationService } from '../../src/server/integrations/plex/plex-linked-account-reconciliation-service.js';

test('reconcileUser refresh_profile repairs a missing synced Plex profile from the latest preview', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rowCount: 0, rows: [] };
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
  const getAppUserById = t.mock.fn(async () => ({
    authProvider: 'plex',
    authSubject: 'plex-uuid-1',
    id: 'user-1',
    localAuth: { unlinkPlexReady: true },
    plexProfile: null,
    username: 'listener-1',
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createPlexLinkedAccountReconciliationService({
    buildPlexDirectoryImportPreview: async () => ({
      fetchedAt: '2026-06-01T12:00:00.000Z',
      profiles: [{
        classification: 'create',
        email: 'listener@example.com',
        homeRole: 'home_member',
        id: 'plex-1',
        libraryAccessDetails: { serverIds: ['server-1'] },
        libraryAccessState: 'shared',
        title: 'Listener',
        username: 'listener',
        uuid: 'plex-uuid-1',
      }],
    }),
    getAppUserById,
    getNow: () => new Date('2026-06-01T12:10:00.000Z'),
    getPoolFn: () => ({ connect: async () => client }),
    recordAuditEventFn,
  });

  const result = await service.reconcileUser({
    action: 'refresh_profile',
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    userId: 'user-1',
  });

  assert.equal(result.action, 'refresh_profile');
  assert.equal(result.profile.id, 'plex-1');
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'plex_linked_account_profile_refreshed');
  assert.equal(query.mock.calls.some((call) => String(call.arguments[0]).includes('INSERT INTO app_user_plex_profiles')), true);
});

test('reconcileUser safe_relink restores Plex as the primary sign-in provider', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rowCount: 0, rows: [] };
    }

    if (String(sql).includes('UPDATE app_users')) {
      return { rowCount: 1, rows: [] };
    }

    if (String(sql).includes('UPDATE app_user_plex_profiles')) {
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  });
  const client = {
    query,
    release: t.mock.fn(),
  };
  const getAppUserById = t.mock.fn(async () => ({
    authProvider: 'local',
    authSubject: null,
    id: 'user-1',
    localAuth: { unlinkPlexReady: true },
    plexProfile: { plexTitle: 'Listener', plexUserId: 'plex-1', plexUuid: 'plex-uuid-1' },
    username: 'listener-1',
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createPlexLinkedAccountReconciliationService({
    buildPlexDirectoryImportPreview: async () => ({
      fetchedAt: '2026-06-01T12:00:00.000Z',
      profiles: [{
        classification: 'create',
        email: 'listener@example.com',
        homeRole: 'home_member',
        id: 'plex-1',
        libraryAccessDetails: { serverIds: ['server-1'] },
        libraryAccessState: 'shared',
        title: 'Listener',
        username: 'listener',
        uuid: 'plex-uuid-1',
      }],
    }),
    getAppUserById,
    getNow: () => new Date('2026-06-01T12:10:00.000Z'),
    getPoolFn: () => ({ connect: async () => client }),
    recordAuditEventFn,
  });

  const result = await service.reconcileUser({
    action: 'safe_relink',
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    userId: 'user-1',
  });

  assert.equal(result.action, 'safe_relink');
  assert.equal(client.release.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'plex_linked_account_safely_relinked');
  assert.equal(query.mock.calls.some((call) => String(call.arguments[0]).includes('UPDATE app_users')), true);
});

test('reconcileUser mark_stale records an auditable stale acknowledgement', async (t) => {
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createPlexLinkedAccountReconciliationService({
    buildPlexDirectoryImportPreview: async () => ({
      fetchedAt: '2026-06-01T12:00:00.000Z',
      profiles: [],
    }),
    getAppUserById: async () => ({
      authProvider: 'plex',
      authSubject: 'plex-uuid-1',
      id: 'user-1',
      localAuth: { unlinkPlexReady: true },
      plexProfile: { plexTitle: 'Listener', plexUserId: 'plex-1', plexUuid: 'plex-uuid-1' },
      username: 'listener-1',
    }),
    getNow: () => new Date('2026-06-01T12:10:00.000Z'),
    recordAuditEventFn,
  });

  const result = await service.reconcileUser({
    action: 'mark_stale',
    actorUserId: 'admin-1',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test' },
    userId: 'user-1',
  });

  assert.equal(result.action, 'mark_stale');
  assert.equal(result.staleAcknowledgedAt, '2026-06-01T12:10:00.000Z');
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'plex_linked_account_stale_acknowledged');
});

test('listLatestStaleAcknowledgements returns the newest acknowledgement per user', async () => {
  const service = createPlexLinkedAccountReconciliationService({
    getPoolFn: () => ({
      query: async () => ({
        rowCount: 1,
        rows: [{
          actor_user_id: 'admin-1',
          entity_id: '8a38fd2d-6407-42e9-b1d2-b33fc61ff1f3',
          occurred_at: '2026-06-01T12:10:00.000Z',
        }],
      }),
    }),
  });

  const acknowledgements = await service.listLatestStaleAcknowledgements({
    userIds: ['8a38fd2d-6407-42e9-b1d2-b33fc61ff1f3'],
  });

  assert.deepEqual(acknowledgements.get('8a38fd2d-6407-42e9-b1d2-b33fc61ff1f3'), {
    actorUserId: 'admin-1',
    occurredAt: '2026-06-01T12:10:00.000Z',
  });
});
