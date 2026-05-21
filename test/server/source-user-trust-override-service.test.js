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
import { createSourceUserTrustOverrideService } from '../../src/server/activity/source-user-trust-override-service.js';

test('updateSourceUserTrust writes a trusted override and appends manual provenance history', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserTrustOverrideService({
    listTrustSnapshot: async () => ([{ successCount: 4, trustState: 'neutral', username: 'peer-1' }]),
    replaceTrustSnapshot,
  });

  const result = await service.updateSourceUserTrust({
    actorUserId: 'admin-1',
    operatorNotes: 'Known complete uploader',
    reason: 'Verified complete releases',
    trustState: 'trusted',
    username: 'peer-1',
  });

  assert.equal(result.sourceUser.trustState, 'trusted');
  assert.equal(result.sourceUser.operatorNotes, 'Known complete uploader');
  const [snapshot] = replaceTrustSnapshot.mock.calls[0].arguments;
  assert.equal(snapshot.sourceUsers[0].trustHistory[0].kind, 'manual_override');
  assert.equal(snapshot.sourceUsers[0].trustHistory[0].actorUserId, 'admin-1');
});

test('updateSourceUserTrust can create a new neutral record for a previously unseen peer', async () => {
  const rows = [];
  const service = createSourceUserTrustOverrideService({
    listTrustSnapshot: async () => rows,
    replaceTrustSnapshot: async ({ sourceUsers }) => {
      rows.splice(0, rows.length, ...sourceUsers);
    },
  });

  const result = await service.updateSourceUserTrust({
    reason: 'Keep neutral until more evidence exists',
    trustState: 'neutral',
    username: 'new-peer',
  });

  assert.equal(result.sourceUser.username, 'new-peer');
  assert.equal(rows[0].trustState, 'neutral');
  assert.equal(rows[0].lastManualDecisionReason, 'Keep neutral until more evidence exists');
});

test('updateSourceUserTrust refuses to mutate blocked peers outside the blocklist flow', async () => {
  const service = createSourceUserTrustOverrideService({
    listTrustSnapshot: async () => ([{ isBlocked: true, trustState: 'blocked', username: 'blocked-peer' }]),
    replaceTrustSnapshot: async () => {},
  });

  await assert.rejects(
    () => service.updateSourceUserTrust({ reason: 'Looks healthy now', trustState: 'trusted', username: 'blocked-peer' }),
    (error) => error?.status === 409 && error?.code === 'source_user_trust_blocked_use_blocklist',
  );
});
