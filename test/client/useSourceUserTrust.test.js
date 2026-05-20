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
import { useSourceUserTrust } from '../../src/client/composables/useSourceUserTrust.js';

function makePayload(overrides = {}) {
  return {
    checkedAt: '2026-06-01T12:00:00.000Z',
    counts: {
      blocked: 1,
      needsReview: 1,
      neutral: 1,
      preferred: 0,
      total: 1,
      trusted: 0,
      unknown: 0,
      withEvidence: 1,
    },
    ok: true,
    sourceUsers: [{ username: 'peer-1' }],
    total: 1,
    trustState: null,
    ...overrides,
  };
}

test('useSourceUserTrust loads source user trust state from the injected api', async (t) => {
  const fetchActivitySourceUsers = t.mock.fn(async () => makePayload());
  const trust = useSourceUserTrust({ fetchActivitySourceUsers });

  await trust.load();

  assert.equal(fetchActivitySourceUsers.mock.callCount(), 1);
  assert.equal(trust.sourceUsers.value.length, 1);
  assert.equal(trust.counts.value.blocked, 1);
  assert.equal(trust.total.value, 1);
  assert.equal(trust.checkedAt.value, '2026-06-01T12:00:00.000Z');
});

test('useSourceUserTrust clears stale state on load failure', async () => {
  let callCount = 0;
  const fetchActivitySourceUsers = async () => {
    callCount += 1;
    if (callCount === 1) {
      return makePayload();
    }

    throw new Error('Network down');
  };
  const trust = useSourceUserTrust({ fetchActivitySourceUsers });

  await trust.load();
  assert.equal(trust.total.value, 1);

  await trust.load();
  assert.deepEqual(trust.sourceUsers.value, []);
  assert.equal(trust.total.value, 0);
  assert.equal(trust.counts.value.total, 0);
  assert.ok(trust.errorMessage.value.length > 0);
});

test('useSourceUserTrust forwards query and trustState to the injected api', async (t) => {
  const fetchActivitySourceUsers = t.mock.fn(async () => makePayload());
  const trust = useSourceUserTrust({ fetchActivitySourceUsers });

  await trust.load({ query: 'peer', trustState: 'blocked' });

  assert.deepEqual(fetchActivitySourceUsers.mock.calls[0].arguments[0], {
    query: 'peer',
    trustState: 'blocked',
  });
});
