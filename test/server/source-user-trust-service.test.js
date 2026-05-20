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
import { createSourceUserTrustService } from '../../src/server/activity/source-user-trust-service.js';

test('listSourceUsers maps trust rows into explainable trust summaries', async () => {
  const service = createSourceUserTrustService({
    listTrustSnapshot: async () => ([
      {
        failureCount: 0,
        operatorNotes: 'Always ships complete releases.',
        successCount: 9,
        trustState: 'trusted',
        updatedAt: '2026-06-01T10:00:00.000Z',
        username: 'trusted-peer',
      },
      {
        blockReason: 'Repeated fake FLAC labels',
        failureCount: 4,
        isBlocked: true,
        successCount: 0,
        updatedAt: '2026-06-02T10:00:00.000Z',
        username: 'blocked-peer',
      },
      {
        failureCount: 3,
        successCount: 1,
        updatedAt: '2026-06-03T10:00:00.000Z',
        username: 'watch-peer',
      },
      {
        username: 'new-peer',
      },
    ]),
  });

  const result = await service.listSourceUsers();

  assert.equal(result.total, 4);
  assert.equal(result.counts.blocked, 1);
  assert.equal(result.counts.trusted, 1);
  assert.equal(result.counts.neutral, 2);
  assert.equal(result.counts.needsReview, 1);
  assert.equal(result.counts.preferred, 1);
  assert.equal(result.counts.unknown, 1);
  assert.equal(result.counts.withEvidence, 3);

  assert.equal(result.sourceUsers[0].username, 'blocked-peer');
  assert.equal(result.sourceUsers[0].trustState, 'blocked');
  assert.equal(result.sourceUsers[0].review.state, 'excluded');
  assert.equal(result.sourceUsers[0].review.reason, 'Repeated fake FLAC labels');

  assert.equal(result.sourceUsers[1].username, 'watch-peer');
  assert.equal(result.sourceUsers[1].review.state, 'watch');
  assert.equal(result.sourceUsers[1].reputation.successRatePercent, 25);

  assert.equal(result.sourceUsers[2].username, 'trusted-peer');
  assert.equal(result.sourceUsers[2].review.state, 'preferred');
  assert.equal(result.sourceUsers[2].reputation.reliability, 'strong');

  assert.equal(result.sourceUsers[3].username, 'new-peer');
  assert.equal(result.sourceUsers[3].review.state, 'unknown');
  assert.equal(result.sourceUsers[3].reputation.evidenceCount, 0);
});

test('listSourceUsers filters by case-insensitive query and trustState', async () => {
  const service = createSourceUserTrustService({
    listTrustSnapshot: async () => ([
      { trustState: 'trusted', username: 'DJShadow' },
      { blockReason: 'Corrupt files', isBlocked: true, username: 'nightcrawler' },
      { operatorNotes: 'Queued but inconsistent', username: 'slow-peer' },
    ]),
  });

  const trusted = await service.listSourceUsers({ trustState: 'trusted' });
  assert.equal(trusted.total, 1);
  assert.equal(trusted.sourceUsers[0].username, 'DJShadow');

  const queried = await service.listSourceUsers({ query: 'corrupt' });
  assert.equal(queried.total, 1);
  assert.equal(queried.sourceUsers[0].username, 'nightcrawler');
});

test('listSourceUsers rejects invalid trustState filters', async () => {
  const service = createSourceUserTrustService();

  await assert.rejects(
    () => service.listSourceUsers({ trustState: 'suspicious' }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});
