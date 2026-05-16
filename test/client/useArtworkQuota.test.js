import assert from 'node:assert/strict';
import test from 'node:test';
import { useArtworkQuota } from '../../src/client/composables/useArtworkQuota.js';

const mockQuotaPayload = {
  date: '2026-06-15',
  limit: 1000,
  providers: [
    { exceeded: false, limit: 1000, provider: 'coverArtArchive', remaining: 950, used: 50 },
    { exceeded: false, limit: 1000, provider: 'fanartTv', remaining: 1000, used: 0 },
  ],
  totalUsed: 50,
};

test('useArtworkQuota loads quota and exposes reactive state', async () => {
  const fetchFn = async () => ({ ...mockQuotaPayload });
  const { quota, isLoading, totalUsed, limit, providers, loadQuota } = useArtworkQuota({
    fetchArtworkQuota: fetchFn,
  });

  assert.equal(isLoading.value, false);
  assert.equal(quota.value, null);

  const promise = loadQuota();
  assert.equal(isLoading.value, true);
  await promise;

  assert.equal(isLoading.value, false);
  assert.equal(totalUsed.value, 50);
  assert.equal(limit.value, 1000);
  assert.equal(providers.value.length, 2);
  assert.equal(providers.value[0].provider, 'coverArtArchive');
  assert.equal(providers.value[0].used, 50);
});

test('useArtworkQuota sets errorMessage on failure', async () => {
  const fetchFn = async () => { throw new Error('network error'); };
  const { errorMessage, quota, loadQuota } = useArtworkQuota({
    fetchArtworkQuota: fetchFn,
  });

  await loadQuota();

  assert.equal(quota.value, null);
  assert.ok(errorMessage.value.length > 0);
});

test('useArtworkQuota anyExceeded is true when a provider is exceeded', async () => {
  const fetchFn = async () => ({
    date: '2026-06-15',
    limit: 100,
    providers: [
      { exceeded: true, limit: 100, provider: 'coverArtArchive', remaining: 0, used: 100 },
      { exceeded: false, limit: 100, provider: 'fanartTv', remaining: 80, used: 20 },
    ],
    totalUsed: 120,
  });

  const { anyExceeded, loadQuota } = useArtworkQuota({ fetchArtworkQuota: fetchFn });
  await loadQuota();

  assert.equal(anyExceeded.value, true);
});

test('useArtworkQuota anyExceeded is false when no provider is exceeded', async () => {
  const fetchFn = async () => ({ ...mockQuotaPayload });
  const { anyExceeded, loadQuota } = useArtworkQuota({ fetchArtworkQuota: fetchFn });
  await loadQuota();

  assert.equal(anyExceeded.value, false);
});

test('useArtworkQuota returns sane defaults before loading', () => {
  const { providers, totalUsed, limit, date, anyExceeded } = useArtworkQuota({
    fetchArtworkQuota: async () => ({}),
  });

  assert.deepEqual(providers.value, []);
  assert.equal(totalUsed.value, 0);
  assert.equal(limit.value, 0);
  assert.equal(date.value, null);
  assert.equal(anyExceeded.value, false);
});
