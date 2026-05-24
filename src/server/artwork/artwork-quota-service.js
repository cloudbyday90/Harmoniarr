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

import { getPool } from '../database.js';

const DEFAULT_DAILY_LIMIT = 1000;
const SUPPORTED_PROVIDERS = ['coverArtArchive', 'fanartTv', 'theAudioDb'];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createArtworkQuotaService({
  getPoolFn = getPool,
  getDailyLimit = async () => DEFAULT_DAILY_LIMIT,
} = {}) {
  const cache = new Map();
  let cacheDate = null;

  function currentCacheKey(provider) {
    return `${cacheDate}:${provider}`;
  }

  function invalidateStaleCache() {
    const today = todayDate();
    if (cacheDate !== today) {
      cache.clear();
      cacheDate = today;
    }
  }

  async function incrementQuota(provider) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return;

    invalidateStaleCache();

    const db = getPoolFn();
    const today = todayDate();

    const result = await db.query(
      `INSERT INTO artwork_provider_quota (provider, window_date, request_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (provider, window_date)
       DO UPDATE SET request_count = artwork_provider_quota.request_count + 1,
                     updated_at = NOW()
       RETURNING request_count`,
      [provider, today],
    );

    const newCount = Number(result.rows[0]?.request_count ?? 0);
    cache.set(currentCacheKey(provider), newCount);

    return newCount;
  }

  async function isQuotaExceeded(provider) {
    if (!SUPPORTED_PROVIDERS.includes(provider)) return false;

    invalidateStaleCache();

    const cached = cache.get(currentCacheKey(provider));
    if (cached !== undefined) {
      const limit = await getDailyLimit();
      return cached >= limit;
    }

    const db = getPoolFn();
    const today = todayDate();

    const result = await db.query(
      'SELECT request_count FROM artwork_provider_quota WHERE provider = $1 AND window_date = $2',
      [provider, today],
    );

    const count = Number(result.rows[0]?.request_count ?? 0);
    cache.set(currentCacheKey(provider), count);

    const limit = await getDailyLimit();
    return count >= limit;
  }

  async function getQuotaStatus() {
    invalidateStaleCache();

    const limit = await getDailyLimit();
    const db = getPoolFn();
    const today = todayDate();

    const result = await db.query(
      'SELECT provider, request_count FROM artwork_provider_quota WHERE window_date = $1',
      [today],
    );

    const counts = {};
    for (const row of result.rows) {
      counts[row.provider] = Number(row.request_count);
    }

    const providers = SUPPORTED_PROVIDERS.map((provider) => {
      const used = counts[provider] ?? 0;
      return {
        exceeded: used >= limit,
        limit,
        provider,
        remaining: Math.max(0, limit - used),
        used,
      };
    });

    return {
      date: today,
      limit,
      providers,
      totalUsed: providers.reduce((sum, p) => sum + p.used, 0),
    };
  }

  async function getQuotaHistory({ days = 30 } = {}) {
    invalidateStaleCache();

    const limit = await getDailyLimit();
    const db = getPoolFn();

    const result = await db.query(
      `SELECT provider, window_date, request_count
       FROM artwork_provider_quota
       WHERE window_date >= CURRENT_DATE - ($1::integer || ' days')::interval
       ORDER BY provider, window_date`,
      [days],
    );

    const history = {};
    for (const row of result.rows) {
      if (!history[row.provider]) {
        history[row.provider] = [];
      }
      history[row.provider].push({
        date: row.window_date.toISOString().slice(0, 10),
        requestCount: Number(row.request_count),
      });
    }

    for (const provider of Object.keys(history)) {
      history[provider].sort((a, b) => a.date.localeCompare(b.date));
    }

    for (const provider of SUPPORTED_PROVIDERS) {
      if (!history[provider]) {
        history[provider] = [];
      }
    }

    return { days, history, limit };
  }

  return { getQuotaHistory, getQuotaStatus, incrementQuota, isQuotaExceeded };
}
