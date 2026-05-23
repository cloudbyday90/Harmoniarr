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
  const { mediaRequest, events, errorMessage, load, reset } = useMediaRequestDetail({
    fetchDetailFn: async () => ({
      ok: true,
      mediaRequest: { id: 'r1' },
      events: [{ id: 'e1' }],
    }),
  });

  await load({ mediaRequestId: 'r1' });
  assert.equal(mediaRequest.value.id, 'r1');

  reset();
  assert.equal(mediaRequest.value, null);
  assert.equal(events.value.length, 0);
  assert.equal(errorMessage.value, '');
});

test('useMediaRequestDetail handles missing events in response', async () => {
  const { events, load } = useMediaRequestDetail({
    fetchDetailFn: async () => ({ ok: true, mediaRequest: { id: 'r1' } }),
  });

  await load({ mediaRequestId: 'r1' });

  assert.equal(events.value.length, 0);
});
