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
import { useMediaRequestDetail } from '../../src/client/composables/useMediaRequestDetail.js';

function makeFetchDetailFn(result) {
  return async () => result;
}

test('useMediaRequestDetail load populates mediaRequest and events', async () => {
  const mockResult = {
    ok: true,
    mediaRequest: { id: 'req-1', requestKind: 'release', artistName: 'Daft Punk' },
    events: [{ id: 'evt-1', eventType: 'reassigned' }],
    hasMoreEvents: false,
    nextCursor: null,
  };
  const { mediaRequest, events, load } = useMediaRequestDetail({
    fetchDetailFn: makeFetchDetailFn(mockResult),
  });

  await load({ mediaRequestId: 'req-1' });

  assert.equal(mediaRequest.value.id, 'req-1');
  assert.equal(events.value.length, 1);
});

test('useMediaRequestDetail load handles null mediaRequest', async () => {
  const { mediaRequest, events, load } = useMediaRequestDetail({
    fetchDetailFn: async () => ({ ok: true, mediaRequest: null, events: [] }),
  });

  await load({ mediaRequestId: 'nonexistent' });

  assert.equal(mediaRequest.value, null);
  assert.equal(events.value.length, 0);
});

test('useMediaRequestDetail load sets error on failure', async () => {
  const { errorMessage, load } = useMediaRequestDetail({
    fetchDetailFn: async () => { throw new Error('not found'); },
  });

  await load({ mediaRequestId: 'bad' });

  assert.equal(errorMessage.value, 'not found');
});

test('useMediaRequestDetail load clears error before fetch', async () => {
  let callCount = 0;
  const { errorMessage, load } = useMediaRequestDetail({
    fetchDetailFn: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('fail');
      return { ok: true, mediaRequest: { id: 'r1' }, events: [] };
    },
  });

  await load({ mediaRequestId: 'r1' });
  assert.equal(errorMessage.value, 'fail');

  await load({ mediaRequestId: 'r1' });
  assert.equal(errorMessage.value, '');
});

test('useMediaRequestDetail isLoading is false initially', () => {
  const { isLoading } = useMediaRequestDetail();
  assert.equal(isLoading.value, false);
});

test('useMediaRequestDetail reset clears all state', async () => {
  const { mediaRequest, events, errorMessage, hasMoreEvents, load, reset } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
      hasMoreEvents: true,
      nextCursor: 'cursor-1',
    }),
  });

  await load({ mediaRequestId: 'r1' });
  assert.equal(mediaRequest.value.id, 'r1');
  assert.equal(hasMoreEvents.value, true);

  reset();
  assert.equal(mediaRequest.value, null);
  assert.equal(events.value.length, 0);
  assert.equal(errorMessage.value, '');
  assert.equal(hasMoreEvents.value, false);
});

test('useMediaRequestDetail handles missing events in response', async () => {
  const { events, load } = useMediaRequestDetail({
    fetchDetailFn: async () => ({ ok: true, mediaRequest: { id: 'r1' } }),
  });

  await load({ mediaRequestId: 'r1' });

  assert.equal(events.value.length, 0);
});

test('useMediaRequestDetail load sets hasMoreEvents and nextCursor from detail', async () => {
  const { hasMoreEvents, load } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }, { id: 'e2' }],
      hasMoreEvents: true,
      nextCursor: 'cursor-abc',
    }),
  });

  await load({ mediaRequestId: 'r1' });

  assert.equal(hasMoreEvents.value, true);
});

test('useMediaRequestDetail loadMoreEvents appends events and updates cursor', async () => {
  let fetchEventsCallCount = 0;
  const { events, hasMoreEvents, load, loadMoreEvents } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
      hasMoreEvents: true,
      nextCursor: 'cursor-1',
    }),
    fetchEventsFn: async () => {
      fetchEventsCallCount += 1;
      return {
        events: [{ id: 'e2' }, { id: 'e3' }],
        hasMore: false,
        nextCursor: null,
      };
    },
  });

  await load({ mediaRequestId: 'r1' });
  assert.equal(events.value.length, 1);

  await loadMoreEvents({ mediaRequestId: 'r1' });
  assert.equal(events.value.length, 3);
  assert.equal(events.value[0].id, 'e1');
  assert.equal(events.value[1].id, 'e2');
  assert.equal(events.value[2].id, 'e3');
  assert.equal(hasMoreEvents.value, false);
  assert.equal(fetchEventsCallCount, 1);
});

test('useMediaRequestDetail loadMoreEvents is no-op when no cursor', async () => {
  let fetchEventsCallCount = 0;
  const { events, load, loadMoreEvents } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
      hasMoreEvents: false,
      nextCursor: null,
    }),
    fetchEventsFn: async () => {
      fetchEventsCallCount += 1;
      return { events: [], hasMore: false, nextCursor: null };
    },
  });

  await load({ mediaRequestId: 'r1' });
  await loadMoreEvents({ mediaRequestId: 'r1' });

  assert.equal(events.value.length, 1);
  assert.equal(fetchEventsCallCount, 0);
});

test('useMediaRequestDetail loadMoreEvents is no-op when already loading', async () => {
  let resolveEvents;
  const fetchEventsFn = async () => new Promise((resolve) => { resolveEvents = resolve; });
  const { events, load, loadMoreEvents } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
      hasMoreEvents: true,
      nextCursor: 'cursor-1',
    }),
    fetchEventsFn,
  });

  await load({ mediaRequestId: 'r1' });

  const p1 = loadMoreEvents({ mediaRequestId: 'r1' });
  loadMoreEvents({ mediaRequestId: 'r1' });

  resolveEvents({ events: [{ id: 'e2' }], hasMore: false, nextCursor: null });
  await p1;

  assert.equal(events.value.length, 2);
});

test('useMediaRequestDetail loadMoreEvents silently ignores fetch errors', async () => {
  const { events, hasMoreEvents, load, loadMoreEvents } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
      hasMoreEvents: true,
      nextCursor: 'cursor-1',
    }),
    fetchEventsFn: async () => { throw new Error('network error'); },
  });

  await load({ mediaRequestId: 'r1' });
  await loadMoreEvents({ mediaRequestId: 'r1' });

  assert.equal(events.value.length, 1);
  assert.equal(hasMoreEvents.value, true);
});

test('useMediaRequestDetail reset clears pagination state', async () => {
  const { hasMoreEvents, isLoadingMoreEvents, load, reset } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
      hasMoreEvents: true,
      nextCursor: 'cursor-1',
    }),
  });

  await load({ mediaRequestId: 'r1' });
  assert.equal(hasMoreEvents.value, true);

  reset();
  assert.equal(hasMoreEvents.value, false);
  assert.equal(isLoadingMoreEvents.value, false);
});
