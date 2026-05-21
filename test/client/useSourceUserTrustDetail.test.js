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
import { useSourceUserTrustDetail } from '../../src/client/composables/useSourceUserTrustDetail.js';

test('useSourceUserTrustDetail loads a selected source user detail payload', async (t) => {
  const fetchActivitySourceUserDetail = t.mock.fn(async (username) => ({
    checkedAt: '2026-06-01T12:00:00.000Z',
    sourceUser: { trustHistory: [], trustState: 'neutral', username },
  }));
  const detail = useSourceUserTrustDetail({ fetchActivitySourceUserDetail });

  await detail.load('peer-1');

  assert.equal(fetchActivitySourceUserDetail.mock.callCount(), 1);
  assert.equal(detail.detail.value.username, 'peer-1');
  assert.equal(detail.selectedUsername.value, 'peer-1');
});

test('useSourceUserTrustDetail clears detail state when no username is selected', async () => {
  const detail = useSourceUserTrustDetail();

  await detail.load('');

  assert.equal(detail.detail.value, null);
  assert.equal(detail.errorMessage.value, '');
});

test('useSourceUserTrustDetail saves trust overrides through the injected api', async (t) => {
  const updateActivitySourceUserTrust = t.mock.fn(async () => ({
    sourceUser: { trustState: 'trusted', username: 'peer-1' },
  }));
  const detail = useSourceUserTrustDetail({
    fetchActivitySourceUserDetail: async () => ({ checkedAt: null, sourceUser: { trustState: 'neutral', username: 'peer-1' } }),
    updateActivitySourceUserTrust,
  });

  await detail.load('peer-1');
  const result = await detail.saveTrustState({ operatorNotes: 'Known good', reason: 'Verified releases', trustState: 'trusted' });

  assert.equal(result.trustState, 'trusted');
  assert.deepEqual(updateActivitySourceUserTrust.mock.calls[0].arguments, [
    'peer-1',
    { operatorNotes: 'Known good', reason: 'Verified releases', trustState: 'trusted' },
  ]);
});

test('useSourceUserTrustDetail surfaces action errors when trust updates fail', async () => {
  const detail = useSourceUserTrustDetail({
    fetchActivitySourceUserDetail: async () => ({ checkedAt: null, sourceUser: { trustState: 'neutral', username: 'peer-1' } }),
    updateActivitySourceUserTrust: async () => {
      throw new Error('Override failed');
    },
  });

  await detail.load('peer-1');
  const result = await detail.saveTrustState({ reason: 'Verified releases', trustState: 'trusted' });

  assert.equal(result, null);
  assert.ok(detail.actionErrorMessage.value.length > 0);
});
