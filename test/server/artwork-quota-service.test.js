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
  assert.equal(status.providers.length, 3);

  const caa = status.providers.find((p) => p.provider === 'coverArtArchive');
  assert.equal(caa.used, 42);
  assert.equal(caa.remaining, 58);
  assert.equal(caa.exceeded, false);

  const fanart = status.providers.find((p) => p.provider === 'fanartTv');
  assert.equal(fanart.used, 0);
  assert.equal(fanart.remaining, 100);
  assert.equal(fanart.exceeded, false);

  const theaudiodb = status.providers.find((p) => p.provider === 'theAudioDb');
  assert.equal(theaudiodb.used, 0);
  assert.equal(theaudiodb.remaining, 100);
  assert.equal(theaudiodb.exceeded, false);
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

test('getQuotaHistory returns history for all supported providers', async () => {
  const { pool } = createMockPool([
    [
      { provider: 'coverArtArchive', window_date: new Date('2026-05-14'), request_count: 42 },
      { provider: 'coverArtArchive', window_date: new Date('2026-05-15'), request_count: 55 },
      { provider: 'fanartTv', window_date: new Date('2026-05-15'), request_count: 10 },
    ],
  ]);
  const { getQuotaHistory } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const result = await getQuotaHistory({ days: 30 });
  assert.equal(result.days, 30);
  assert.equal(result.limit, 100);
  assert.equal(result.history.coverArtArchive.length, 2);
  assert.equal(result.history.fanartTv.length, 1);
  assert.equal(result.history.coverArtArchive[0].date, '2026-05-14');
  assert.equal(result.history.coverArtArchive[0].requestCount, 42);
});

test('getQuotaHistory returns empty arrays for providers with no data', async () => {
  const { pool } = createMockPool([[]]);
  const { getQuotaHistory } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const result = await getQuotaHistory({ days: 30 });
  assert.equal(result.history.coverArtArchive.length, 0);
  assert.equal(result.history.fanartTv.length, 0);
});

test('getQuotaHistory sorts entries by date ascending', async () => {
  const { pool } = createMockPool([
    [
      { provider: 'fanartTv', window_date: new Date('2026-05-15'), request_count: 10 },
      { provider: 'fanartTv', window_date: new Date('2026-05-13'), request_count: 5 },
      { provider: 'fanartTv', window_date: new Date('2026-05-14'), request_count: 8 },
    ],
  ]);
  const { getQuotaHistory } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  const result = await getQuotaHistory({ days: 30 });
  const dates = result.history.fanartTv.map((d) => d.date);
  assert.deepEqual(dates, ['2026-05-13', '2026-05-14', '2026-05-15']);
});

test('getQuotaHistory uses default 30 days when no options', async () => {
  const { calls, pool } = createMockPool([[]]);
  const { getQuotaHistory } = createArtworkQuotaService({
    getPoolFn: () => pool,
    getDailyLimit: async () => 100,
  });

  await getQuotaHistory();
  assert.equal(calls[0].params[0], 30);
});
