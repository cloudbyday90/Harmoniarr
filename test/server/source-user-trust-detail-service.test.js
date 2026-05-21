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
import { createSourceUserTrustDetailService } from '../../src/server/activity/source-user-trust-detail-service.js';

test('getSourceUserDetail returns mapped peer state with trust history sorted newest-first', async () => {
  const service = createSourceUserTrustDetailService({
    listTrustSnapshot: async () => ([{
      failureCount: 2,
      successCount: 5,
      trustHistory: [
        { id: 'evt-older', kind: 'delivery_evidence', occurredAt: '2026-06-01T10:00:00.000Z', outcome: 'success', reason: 'Completed' },
        { id: 'evt-newer', actorUserId: 'admin-1', kind: 'manual_override', occurredAt: '2026-06-01T12:00:00.000Z', reason: 'Verified complete releases', trustState: 'trusted' },
      ],
      trustState: 'trusted',
      updatedAt: '2026-06-01T12:00:00.000Z',
      username: 'peer-1',
    }]),
  });

  const result = await service.getSourceUserDetail({ username: 'peer-1' });

  assert.equal(result.sourceUser.username, 'peer-1');
  assert.equal(result.sourceUser.trustState, 'trusted');
  assert.equal(result.sourceUser.trustHistory.length, 2);
  assert.equal(result.sourceUser.trustHistory[0].id, 'evt-newer');
  assert.equal(result.sourceUser.review.reason, 'Verified complete releases');
  assert.equal(result.sourceUser.trustHistoryPagination.total, 2);
  assert.equal(result.sourceUser.trustHistoryPagination.offset, 0);
  assert.equal(result.sourceUser.trustHistoryPagination.limit, 10);
});

test('getSourceUserDetail paginates trust history with historyLimit and historyOffset', async () => {
  const history = Array.from({ length: 15 }, (_, i) => ({
    id: `evt-${i}`,
    kind: 'delivery_evidence',
    occurredAt: `2026-06-01T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
    outcome: i % 2 === 0 ? 'success' : 'failure',
  }));

  const service = createSourceUserTrustDetailService({
    listTrustSnapshot: async () => ([{
      failureCount: 8,
      successCount: 7,
      trustHistory: history,
      trustState: 'neutral',
      updatedAt: '2026-06-01T20:00:00.000Z',
      username: 'paginated-peer',
    }]),
  });

  const page1 = await service.getSourceUserDetail({ username: 'paginated-peer', historyLimit: 5, historyOffset: 0 });

  assert.equal(page1.sourceUser.trustHistory.length, 5);
  assert.equal(page1.sourceUser.trustHistoryPagination.total, 15);
  assert.equal(page1.sourceUser.trustHistoryPagination.limit, 5);
  assert.equal(page1.sourceUser.trustHistoryPagination.offset, 0);

  const page2 = await service.getSourceUserDetail({ username: 'paginated-peer', historyLimit: 5, historyOffset: 5 });

  assert.equal(page2.sourceUser.trustHistory.length, 5);
  assert.equal(page2.sourceUser.trustHistoryPagination.offset, 5);

  const page3 = await service.getSourceUserDetail({ username: 'paginated-peer', historyLimit: 5, historyOffset: 10 });

  assert.equal(page3.sourceUser.trustHistory.length, 5);
  assert.equal(page3.sourceUser.trustHistoryPagination.offset, 10);

  const allIds = [...page1.sourceUser.trustHistory, ...page2.sourceUser.trustHistory, ...page3.sourceUser.trustHistory].map((e) => e.id);
  assert.equal(new Set(allIds).size, 15);
});

test('getSourceUserDetail rejects invalid historyLimit', async () => {
  const service = createSourceUserTrustDetailService({ listTrustSnapshot: async () => [] });

  await assert.rejects(
    () => service.getSourceUserDetail({ username: 'peer', historyLimit: 0 }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );

  await assert.rejects(
    () => service.getSourceUserDetail({ username: 'peer', historyLimit: 30 }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('getSourceUserDetail rejects invalid historyOffset', async () => {
  const service = createSourceUserTrustDetailService({ listTrustSnapshot: async () => [] });

  await assert.rejects(
    () => service.getSourceUserDetail({ username: 'peer', historyOffset: -1 }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );

  await assert.rejects(
    () => service.getSourceUserDetail({ username: 'peer', historyOffset: 30 }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('getSourceUserDetail rejects missing peers', async () => {
  const service = createSourceUserTrustDetailService({
    listTrustSnapshot: async () => ([]),
  });

  await assert.rejects(
    () => service.getSourceUserDetail({ username: 'missing-peer' }),
    (error) => error?.status === 404 && error?.code === 'source_user_not_found',
  );
});
