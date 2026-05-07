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

import { createLibraryReleaseRadarStore } from './library-release-radar-store.js';

const defaultRecentDays = 30;
const defaultUpcomingDays = 90;
const defaultLimit = 100;
const maxLimit = 250;

/**
 * Clamps a limit value to [1, maxLimit], defaulting to `defaultLimit` when
 * the input is not a valid positive integer.
 * @param {number|null|undefined} limit
 * @returns {number}
 */
function resolveLimit(limit) {
  const n = Number.parseInt(String(limit ?? defaultLimit), 10);
  if (!Number.isFinite(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}

/**
 * Clamps a `days` window to [1, 365].
 * @param {number|null|undefined} days
 * @param {number} fallback
 * @returns {number}
 */
function resolveDays(days, fallback) {
  const n = Number.parseInt(String(days ?? fallback), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 365);
}

/**
 * Returns today's date as a YYYY-MM-DD string, derived from `now`.
 * @param {Date} now
 * @returns {string}
 */
function todayString(now) {
  return now.toISOString().slice(0, 10);
}

export function createLibraryReleaseRadarService({
  libraryReleaseRadarStore = createLibraryReleaseRadarStore(),
  nowFn = () => new Date(),
} = {}) {
  /**
   * Builds the release radar payload with two arrays:
   *  - `recent`: releases with `firstReleaseDate` in the past `recentDays`, newest first.
   *  - `upcoming`: releases with `firstReleaseDate` after today, soonest first.
   *
   * Both arrays are derived from a single sorted store query. The `limit` cap
   * applies to the combined raw result before splitting — each array can have
   * at most `limit` items.
   *
   * @param {{ recentDays?: number, upcomingDays?: number, limit?: number }} options
   * @returns {Promise<{ checkedAt: string, windows: object, recent: object[], upcoming: object[] }>}
   */
  async function buildReleaseRadar({
    recentDays = defaultRecentDays,
    upcomingDays = defaultUpcomingDays,
    limit = defaultLimit,
  } = {}) {
    const resolvedRecentDays = resolveDays(recentDays, defaultRecentDays);
    const resolvedUpcomingDays = resolveDays(upcomingDays, defaultUpcomingDays);
    const resolvedLimit = resolveLimit(limit);

    const now = nowFn();
    const checkedAt = now.toISOString();
    const today = todayString(now);

    const since = new Date(now);
    since.setDate(since.getDate() - resolvedRecentDays);

    const until = new Date(now);
    until.setDate(until.getDate() + resolvedUpcomingDays);

    const all = await libraryReleaseRadarStore.listRadarReleaseGroups({
      limit: resolvedLimit * 2,
      since,
      until,
    });

    // Split at today: recent = firstReleaseDate <= today; upcoming = firstReleaseDate > today
    const recent = all
      .filter((r) => r.firstReleaseDate !== null && r.firstReleaseDate <= today)
      .reverse() // newest first
      .slice(0, resolvedLimit);

    const upcoming = all
      .filter((r) => r.firstReleaseDate !== null && r.firstReleaseDate > today)
      .slice(0, resolvedLimit); // already ascending (soonest first)

    return {
      checkedAt,
      recent,
      upcoming,
      windows: {
        recentDays: resolvedRecentDays,
        upcomingDays: resolvedUpcomingDays,
      },
    };
  }

  return {
    buildReleaseRadar,
  };
}
