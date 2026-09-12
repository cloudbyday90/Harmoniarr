import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setImmediate as settleAsyncWork } from 'node:timers/promises';

function makeDetail(overrides = {}) {
  return {
    ok: true,
    mediaRequest: {
      id: 'req-1',
      requestKind: 'release',
      artistName: 'Daft Punk',
      fulfillmentStatus: { code: 'downloading', detail: 'Downloading' },
      ...overrides.mediaRequest,
    },
    events: [{ id: 'evt-1', eventType: 'reassigned' }],
    hasMoreEvents: false,
    nextCursor: null,
    ...overrides,
  };
}

describe('useMediaRequestDetail SWR', () => {
  test('isRevalidating is false initially and after first load', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    const detail = useMediaRequestDetail({
      fetchDetailFn: async () => makeDetail(),
    });

    assert.equal(detail.isRevalidating.value, false);
    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.isRevalidating.value, false);
  });

  test('isRevalidating is true during revalidation', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    const detail = useMediaRequestDetail({
      fetchDetailFn: async () => makeDetail(),
    });

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.isRevalidating.value, false);

    const secondLoad = detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.isRevalidating.value, true);
    await secondLoad;
    assert.equal(detail.isRevalidating.value, false);
  });

  test('preserves stale data on revalidation error', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    let callCount = 0;
    const fetchDetailFn = async () => {
      callCount += 1;
      if (callCount === 1) return makeDetail();
      throw new Error('network fail');
    };

    const detail = useMediaRequestDetail({ fetchDetailFn });

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.mediaRequest.value.id, 'req-1');
    assert.equal(detail.events.value.length, 1);

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.mediaRequest.value.id, 'req-1', 'stale mediaRequest preserved');
    assert.equal(detail.events.value.length, 1, 'stale events preserved');
    assert.equal(detail.errorMessage.value, 'network fail');
  });

  test('clears data on first-load error', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    const fetchDetailFn = async () => { throw new Error('first fail'); };
    const detail = useMediaRequestDetail({ fetchDetailFn });

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.mediaRequest.value, null);
    assert.equal(detail.events.value.length, 0);
    assert.equal(detail.errorMessage.value, 'first fail');
  });

  test('pollIntervalMs schedules recurring loads while active fulfillment', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    let callCount = 0;
    const fetchDetailFn = async () => {
      callCount += 1;
      return makeDetail();
    };

    const detail = useMediaRequestDetail({ fetchDetailFn, pollIntervalMs: 30 });

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.ok(callCount >= 2, 'polling triggered additional loads');

    detail.destroy();
  });

  test('polling stops when fulfillment becomes inactive', async (t) => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');
    t.mock.timers.enable({ apis: ['setTimeout'] });

    let callCount = 0;
    const fetchDetailFn = async () => {
      callCount += 1;
      if (callCount <= 2) {
        return makeDetail({
          mediaRequest: {
            fulfillmentStatus: { code: 'downloading' },
          },
        });
      }
      return makeDetail({
        mediaRequest: {
          fulfillmentStatus: { code: 'fulfilled' },
        },
      });
    };

    const detail = useMediaRequestDetail({ fetchDetailFn, pollIntervalMs: 30 });
    t.after(() => detail.destroy());

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(callCount, 1);

    t.mock.timers.tick(29);
    assert.equal(callCount, 1, 'poll does not start before the interval');
    t.mock.timers.tick(1);
    // Mock ticks invoke the timer; its async load and rescheduling still need to settle.
    await settleAsyncWork();
    assert.equal(callCount, 2);
    assert.equal(detail.mediaRequest.value.fulfillmentStatus.code, 'downloading');

    t.mock.timers.tick(30);
    await settleAsyncWork();
    assert.equal(callCount, 3);
    assert.equal(detail.mediaRequest.value.fulfillmentStatus.code, 'fulfilled');
    assert.equal(detail.isRevalidating.value, false);

    for (const elapsed of [30, 150, 1000]) {
      t.mock.timers.tick(elapsed);
      await settleAsyncWork();
      assert.equal(callCount, 3, 'polling stopped after fulfillment became inactive');
    }
  });

  test('destroy stops polling', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    let callCount = 0;
    const fetchDetailFn = async () => {
      callCount += 1;
      return makeDetail();
    };

    const detail = useMediaRequestDetail({ fetchDetailFn, pollIntervalMs: 30 });

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(callCount, 1);

    detail.destroy();

    await new Promise((resolve) => { setTimeout(resolve, 80); });
    assert.equal(callCount, 1, 'no additional fetch after destroy');
  });

  test('destroy is safe to call multiple times', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    const fetchDetailFn = async () => makeDetail();
    const detail = useMediaRequestDetail({ fetchDetailFn });

    await detail.load({ mediaRequestId: 'req-1' });
    detail.destroy();
    detail.destroy();
  });

  test('pollIntervalMs=0 does not schedule polling', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    let callCount = 0;
    const fetchDetailFn = async () => {
      callCount += 1;
      return makeDetail();
    };

    const detail = useMediaRequestDetail({ fetchDetailFn, pollIntervalMs: 0 });

    await detail.load({ mediaRequestId: 'req-1' });
    assert.equal(callCount, 1);

    await new Promise((resolve) => { setTimeout(resolve, 60); });
    assert.equal(callCount, 1);

    detail.destroy();
  });

  test('reset clears hasLoaded so next load is treated as first load', async () => {
    const { useMediaRequestDetail } = await import('../../src/client/composables/useMediaRequestDetail.js');

    const fetchDetailFn = async () => makeDetail();
    const detail = useMediaRequestDetail({ fetchDetailFn });

    await detail.load({ mediaRequestId: 'req-1' });

    detail.reset();

    const loadPromise = detail.load({ mediaRequestId: 'req-1' });
    assert.equal(detail.isLoading.value, true);
    assert.equal(detail.isRevalidating.value, false);
    await loadPromise;
    assert.equal(detail.isLoading.value, false);

    detail.destroy();
  });
});
