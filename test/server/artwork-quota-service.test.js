import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkQuotaService } from '../../src/server/artwork/artwork-quota-service.js';

function createMockPool(rowsByQuery = []) {
  const calls = [];
  let queryIndex = 0;
  const pool = {
    async query(sql, params) {
      calls.push({ params, sql });
      const rows = rowsByQuery[queryIndex] ?? [];
      queryIndex++;
      return { rows };
    },
  };
  return { calls, pool };
}

test('incrementQuota inserts or updates request count', async () => {
  const { calls, pool } = createMockPool([[{ request_count: 1 }]]);
  const { incrementQuota } = createArtworkQuotaService({ getPoolFn: () => pool });

  const count = await incrementQuota('coverArtArchive');
  assert.equal(count, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params[0], 'coverArtArchive');
});

test('incrementQuota returns undefined for unsupported provider', async () => {
  const { pool } = createMockPool([[]]);
  const { incrementQuota } = createArtworkQuotaService({ getPoolFn: () => pool });

  const result = await incrementQuota('unsupported');
  assert.equal(result, undefined);
});

test('isQuotaExceeded returns false when count is below limit', async () => {
  const { pool } = createMockPool([[{ request_count: 5 }]]);
  const { isQuotaExceeded } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const exceeded = await isQuotaExceeded('coverArtArchive');
  assert.equal(exceeded, false);
});

test('isQuotaExceeded returns true when count equals limit', async () => {
  const { pool } = createMockPool([[{ request_count: 100 }]]);
  const { isQuotaExceeded } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const exceeded = await isQuotaExceeded('coverArtArchive');
  assert.equal(exceeded, true);
});

test('isQuotaExceeded returns false when no row exists', async () => {
  const { pool } = createMockPool([[]]);
  const { isQuotaExceeded } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const exceeded = await isQuotaExceeded('coverArtArchive');
  assert.equal(exceeded, false);
});

test('isQuotaExceeded uses cached value after increment', async () => {
  let queryCount = 0;
  const pool = {
    async query(sql, params) {
      queryCount++;
      if (sql.includes('INSERT')) return { rows: [{ request_count: 5 }] };
      return { rows: [{ request_count: 5 }] };
    },
  };

  const { incrementQuota, isQuotaExceeded } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  await incrementQuota('coverArtArchive');
  queryCount = 0;

  const exceeded = await isQuotaExceeded('coverArtArchive');
  assert.equal(exceeded, false);
  assert.equal(queryCount, 0, 'uses cache, no additional query');
});

test('isQuotaExceeded returns false for unsupported provider', async () => {
  const { pool } = createMockPool([]);
  const { isQuotaExceeded } = createArtworkQuotaService({ getPoolFn: () => pool });

  const exceeded = await isQuotaExceeded('unknown');
  assert.equal(exceeded, false);
});

test('getQuotaStatus returns status for all supported providers', async () => {
  const { pool } = createMockPool([
    [{ provider: 'coverArtArchive', request_count: 42 }],
  ]);
  const { getQuotaStatus } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const status = await getQuotaStatus();
  assert.equal(status.limit, 100);
  assert.equal(status.totalUsed, 42);
  assert.equal(status.providers.length, 2);

  const caa = status.providers.find((p) => p.provider === 'coverArtArchive');
  assert.equal(caa.used, 42);
  assert.equal(caa.remaining, 58);
  assert.equal(caa.exceeded, false);

  const fanart = status.providers.find((p) => p.provider === 'fanartTv');
  assert.equal(fanart.used, 0);
  assert.equal(fanart.remaining, 100);
  assert.equal(fanart.exceeded, false);
});

test('getQuotaStatus marks provider as exceeded when at limit', async () => {
  const { pool } = createMockPool([
    [
      { provider: 'coverArtArchive', request_count: 100 },
      { provider: 'fanartTv', request_count: 150 },
    ],
  ]);
  const { getQuotaStatus } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const status = await getQuotaStatus();
  assert.equal(status.providers[0].exceeded, true);
  assert.equal(status.providers[0].remaining, 0);
  assert.equal(status.providers[1].exceeded, true);
  assert.equal(status.providers[1].remaining, 0);
});
