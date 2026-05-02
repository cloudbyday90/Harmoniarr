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

const defaultBaseIntervalMs = 24 * 60 * 60 * 1000;
const defaultHighActivityIntervalMs = 12 * 60 * 60 * 1000;
const defaultStableCatalogIntervalMs = 7 * 24 * 60 * 60 * 1000;
const defaultJitterRatio = 0.2;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const defaultRecentReleaseWindowDays = 90;
const defaultUpcomingReleaseWindowDays = 60;
const defaultStableCatalogWindowDays = 365;

function toDate(value, name) {
  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date`);
  }

  return date;
}

function normalizeReleaseGroupType(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function parseReleaseDate(value) {
  if (typeof value !== 'string' || value.trim().length < 4) {
    return null;
  }

  if (/^\d{4}$/.test(value)) {
    return new Date(`${value}-01-01T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T00:00:00.000Z`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveJitteredIntervalMs(baseIntervalMs, jitterRatio, randomFn) {
  const jitterWindowMs = Math.floor(baseIntervalMs * jitterRatio);
  const jitterMs = jitterWindowMs > 0
    ? Math.floor(randomFn() * (jitterWindowMs + 1))
    : 0;

  return baseIntervalMs + jitterMs;
}

function resolveActivityBand({
  monitoredReleaseGroupTypes,
  now,
  recentReleaseWindowMs,
  releaseGroups,
  stableCatalogWindowMs,
  upcomingReleaseWindowMs,
}) {
  const normalizedTypes = new Set((Array.isArray(monitoredReleaseGroupTypes)
    ? monitoredReleaseGroupTypes
    : ['album', 'ep']).map(normalizeReleaseGroupType).filter(Boolean));
  const relevantDates = (Array.isArray(releaseGroups) ? releaseGroups : [])
    .filter((releaseGroup) => normalizedTypes.size < 1
      || normalizedTypes.has(normalizeReleaseGroupType(releaseGroup?.primaryType)))
    .map((releaseGroup) => parseReleaseDate(releaseGroup?.firstReleaseDate))
    .filter(Boolean);

  if (relevantDates.length < 1) {
    return {
      activityBand: 'standard',
      relevantReleaseDateCount: 0,
    };
  }

  const nowTime = now.getTime();
  const hasRecentOrUpcomingRelease = relevantDates.some((releaseDate) => {
    const deltaMs = releaseDate.getTime() - nowTime;
    return deltaMs >= -recentReleaseWindowMs && deltaMs <= upcomingReleaseWindowMs;
  });
  if (hasRecentOrUpcomingRelease) {
    return {
      activityBand: 'high_activity',
      relevantReleaseDateCount: relevantDates.length,
    };
  }

  const latestReleaseDate = relevantDates.reduce((latest, releaseDate) => (
    !latest || releaseDate.getTime() > latest.getTime() ? releaseDate : latest
  ), null);
  if (latestReleaseDate && (nowTime - latestReleaseDate.getTime()) > stableCatalogWindowMs) {
    return {
      activityBand: 'stable_catalog',
      relevantReleaseDateCount: relevantDates.length,
    };
  }

  return {
    activityBand: 'standard',
    relevantReleaseDateCount: relevantDates.length,
  };
}

export function createMetadataRefreshSchedulingPolicyService({
  baseIntervalMs = defaultBaseIntervalMs,
  highActivityIntervalMs = defaultHighActivityIntervalMs,
  jitterRatio = defaultJitterRatio,
  nowFn = () => new Date(),
  randomFn = Math.random,
  recentReleaseWindowDays = defaultRecentReleaseWindowDays,
  stableCatalogIntervalMs = defaultStableCatalogIntervalMs,
  stableCatalogWindowDays = defaultStableCatalogWindowDays,
  upcomingReleaseWindowDays = defaultUpcomingReleaseWindowDays,
} = {}) {
  if (!Number.isInteger(baseIntervalMs) || baseIntervalMs < 1000) {
    throw new Error('baseIntervalMs must be an integer greater than or equal to 1000');
  }

  if (!Number.isInteger(highActivityIntervalMs) || highActivityIntervalMs < 1000) {
    throw new Error('highActivityIntervalMs must be an integer greater than or equal to 1000');
  }

  if (!Number.isInteger(stableCatalogIntervalMs) || stableCatalogIntervalMs < 1000) {
    throw new Error('stableCatalogIntervalMs must be an integer greater than or equal to 1000');
  }

  if (typeof jitterRatio !== 'number' || jitterRatio < 0 || jitterRatio > 1) {
    throw new Error('jitterRatio must be a number between 0 and 1');
  }

  if (!Number.isInteger(recentReleaseWindowDays) || recentReleaseWindowDays < 0) {
    throw new Error('recentReleaseWindowDays must be an integer greater than or equal to 0');
  }

  if (!Number.isInteger(upcomingReleaseWindowDays) || upcomingReleaseWindowDays < 0) {
    throw new Error('upcomingReleaseWindowDays must be an integer greater than or equal to 0');
  }

  if (!Number.isInteger(stableCatalogWindowDays) || stableCatalogWindowDays < 1) {
    throw new Error('stableCatalogWindowDays must be an integer greater than or equal to 1');
  }

  const recentReleaseWindowMs = recentReleaseWindowDays * millisecondsPerDay;
  const upcomingReleaseWindowMs = upcomingReleaseWindowDays * millisecondsPerDay;
  const stableCatalogWindowMs = stableCatalogWindowDays * millisecondsPerDay;

  function buildInitialSchedule({ now = nowFn() } = {}) {
    return {
      nextRefreshAt: toDate(now, 'now').toISOString(),
    };
  }

  function buildNextSchedule({
    monitoredReleaseGroupTypes,
    refreshedAt = nowFn(),
    releaseGroups = [],
  } = {}) {
    const refreshedDate = toDate(refreshedAt, 'refreshedAt');
    const activity = resolveActivityBand({
      monitoredReleaseGroupTypes,
      now: refreshedDate,
      recentReleaseWindowMs,
      releaseGroups,
      stableCatalogWindowMs,
      upcomingReleaseWindowMs,
    });
    const intervalMs = activity.activityBand === 'high_activity'
      ? highActivityIntervalMs
      : activity.activityBand === 'stable_catalog'
        ? stableCatalogIntervalMs
        : baseIntervalMs;
    const nextRefreshAt = new Date(
      refreshedDate.getTime() + resolveJitteredIntervalMs(intervalMs, jitterRatio, randomFn),
    );

    return {
      activityBand: activity.activityBand,
      intervalMs,
      lastRefreshedAt: refreshedDate.toISOString(),
      nextRefreshAt: nextRefreshAt.toISOString(),
      relevantReleaseDateCount: activity.relevantReleaseDateCount,
    };
  }

  return {
    buildInitialSchedule,
    buildNextSchedule,
  };
}