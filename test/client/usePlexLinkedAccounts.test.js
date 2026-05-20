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
import { usePlexLinkedAccounts } from '../../src/client/composables/usePlexLinkedAccounts.js';

function makePayload(overrides = {}) {
  return {
    checkedAt: '2026-06-01T12:00:00.000Z',
    conflictProfiles: [],
    importableProfiles: [],
    linkedUsers: [{ id: 'user-1', username: 'listener-1' }],
    ownerLink: { linked: true, linkedUserTitle: 'Owner' },
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
    ...overrides,
  };
}

test('usePlexLinkedAccounts loads the aggregated overview from the injected api', async (t) => {
  const fetchPlexLinkedAccountsOverview = t.mock.fn(async () => makePayload());
  const linkedAccounts = usePlexLinkedAccounts({ fetchPlexLinkedAccountsOverview });

  await linkedAccounts.load();

  assert.equal(fetchPlexLinkedAccountsOverview.mock.callCount(), 1);
  assert.equal(linkedAccounts.overview.value.summary.linkedUsers, 1);
  assert.equal(linkedAccounts.overview.value.ownerLink.linked, true);
});

test('usePlexLinkedAccounts resets to the empty overview when loading fails', async () => {
  const linkedAccounts = usePlexLinkedAccounts({
    fetchPlexLinkedAccountsOverview: async () => {
      throw new Error('Network down');
    },
  });

  await linkedAccounts.load();

  assert.equal(linkedAccounts.overview.value.summary.linkedUsers, 0);
  assert.equal(linkedAccounts.overview.value.ownerLink.linked, false);
  assert.ok(linkedAccounts.errorMessage.value.length > 0);
});
