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
import { createLibraryMediaRequestService } from '../../src/server/library/library-media-request-service.js';

function createRequest() {
  return {
    id: 'req-1',
    requestedByUser: { id: 'requester-1' },
    requestedForUser: { id: 'listener-1' },
  };
}

test('getReadableMediaRequest returns owned requests and permits administrators', async () => {
  const mediaRequest = createRequest();
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestById: async () => mediaRequest,
    },
  });

  assert.equal(await service.getReadableMediaRequest({
    actorUserId: 'listener-1',
    actorUserRole: 'requester',
    mediaRequestId: 'req-1',
  }), mediaRequest);
  assert.equal(await service.getReadableMediaRequest({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    mediaRequestId: 'req-1',
  }), mediaRequest);
});

test('getReadableMediaRequest hides nonexistent and unauthorized requests behind the same response', async () => {
  const ownedByAnotherUser = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestById: async () => createRequest(),
    },
  });
  const nonexistent = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestById: async () => null,
    },
  });

  for (const service of [ownedByAnotherUser, nonexistent]) {
    await assert.rejects(
      service.getReadableMediaRequest({
        actorUserId: 'unrelated-1',
        actorUserRole: 'requester',
        mediaRequestId: 'req-1',
      }),
      (error) => error?.status === 404
        && error?.code === 'media_request_not_found'
        && error?.message === 'The specified media request could not be found',
    );
  }
});

test('listMediaRequestEventsPage authorizes before reading event data', async (t) => {
  const listMediaRequestEvents = t.mock.fn(async () => ({
    events: [],
    hasMore: false,
    nextCursor: null,
  }));
  const service = createLibraryMediaRequestService({
    mediaRequestStore: {
      getMediaRequestById: async () => createRequest(),
      listMediaRequestEvents,
    },
  });

  const result = await service.listMediaRequestEventsPage({
    actorUserId: 'listener-1',
    actorUserRole: 'requester',
    mediaRequestId: 'req-1',
    cursor: null,
    limit: 25,
  });

  assert.deepEqual(result, { events: [], hasMore: false, nextCursor: null });
  assert.deepEqual(listMediaRequestEvents.mock.calls[0].arguments, [{
    mediaRequestId: 'req-1',
    cursor: null,
    limit: 25,
  }]);
});
