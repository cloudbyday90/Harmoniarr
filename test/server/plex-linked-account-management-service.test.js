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
import { createPlexLinkedAccountManagementService } from '../../src/server/integrations/plex/plex-linked-account-management-service.js';

test('buildOverview aggregates owner status, linked users, and repair states', async () => {
  const service = createPlexLinkedAccountManagementService({
    buildPlexDirectoryImportPreview: async () => ({
      fetchedAt: '2026-06-01T12:00:00.000Z',
      linkedOwner: { id: 'owner-1', title: 'Owner' },
      profiles: [
        { classification: 'linked', existingUser: { id: 'user-1' }, id: 'plex-1', title: 'Healthy User', uuid: 'plex-uuid-1' },
        { classification: 'conflict', existingUser: { id: 'user-2', username: 'listener-2' }, id: 'plex-2', title: 'Conflict User', uuid: 'plex-uuid-2' },
        { classification: 'create', id: 'plex-3', suggestedUsername: 'new-plex-user', title: 'Importable User', uuid: 'plex-uuid-3' },
      ],
      summary: { conflicts: 1, importable: 1, linked: 1, ownerAccounts: 1, skipped: 0, total: 4 },
    }),
    buildPlexLinkStatus: async () => ({ linked: true, linkedAt: '2026-06-01T11:00:00.000Z', linkedUserTitle: 'Owner' }),
    listAppUsers: async () => ([
      {
        authProvider: 'plex',
        authSubject: 'plex-uuid-1',
        id: 'user-1',
        localAuth: { unlinkPlexReady: true },
        plexProfile: { plexTitle: 'Healthy User', plexUserId: 'plex-1', plexUuid: 'plex-uuid-1', syncedAt: '2026-06-01T11:30:00.000Z' },
        username: 'listener-1',
      },
      {
        authProvider: 'plex',
        authSubject: 'plex-uuid-missing',
        id: 'user-2',
        localAuth: { unlinkPlexBlockedReason: 'Set a temporary password first.', unlinkPlexReady: false },
        plexProfile: { plexTitle: 'Missing User', plexUserId: 'plex-missing', plexUuid: 'plex-uuid-missing', syncedAt: '2026-06-01T11:45:00.000Z' },
        username: 'listener-2',
      },
    ]),
  });

  const overview = await service.buildOverview();

  assert.equal(overview.ownerLink.linked, true);
  assert.equal(overview.previewStatus.state, 'ready');
  assert.equal(overview.summary.linkedUsers, 2);
  assert.equal(overview.summary.importableProfiles, 1);
  assert.equal(overview.summary.conflictProfiles, 1);
  assert.equal(overview.summary.repairRequiredUsers, 1);
  assert.equal(overview.summary.staleUsers, 1);
  const healthyUser = overview.linkedUsers.find((entry) => entry.username === 'listener-1');
  const staleUser = overview.linkedUsers.find((entry) => entry.username === 'listener-2');
  assert.equal(healthyUser?.repairState, 'healthy');
  assert.equal(staleUser?.repairState, 'remote_profile_missing');
});

test('buildOverview reports owner-link-required state when no Plex owner is linked', async () => {
  const buildPlexDirectoryImportPreview = async () => {
    throw new Error('should not run');
  };
  const service = createPlexLinkedAccountManagementService({
    buildPlexDirectoryImportPreview,
    buildPlexLinkStatus: async () => ({ linked: false }),
    listAppUsers: async () => ([]),
  });

  const overview = await service.buildOverview();

  assert.equal(overview.previewStatus.state, 'owner_link_required');
  assert.equal(overview.summary.ownerLinked, false);
  assert.equal(overview.linkedUsers.length, 0);
});

test('buildOverview preserves linked users when preview loading fails', async () => {
  const service = createPlexLinkedAccountManagementService({
    buildPlexDirectoryImportPreview: async () => {
      const error = new Error('Plex preview failed');
      error.code = 'plex_preview_failed';
      throw error;
    },
    buildPlexLinkStatus: async () => ({ linked: true }),
    listAppUsers: async () => ([{
      authProvider: 'plex',
      authSubject: 'plex-uuid-1',
      id: 'user-1',
      localAuth: { unlinkPlexReady: true },
      plexProfile: { plexTitle: 'Linked User', plexUserId: 'plex-1', plexUuid: 'plex-uuid-1' },
      username: 'listener-1',
    }]),
  });

  const overview = await service.buildOverview();

  assert.equal(overview.previewStatus.state, 'error');
  assert.equal(overview.linkedUsers.length, 1);
  assert.equal(overview.linkedUsers[0].repairState, 'preview_unavailable');
});
