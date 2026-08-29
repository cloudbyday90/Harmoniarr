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

const endpointValues = new Set(['discography', 'related_artists']);
const requestTimingEndpointValues = new Set(['local_metadata', 'operator_projection']);
const lookupValues = new Set(['cold', 'fresh', 'stale']);
const phaseValues = new Set(['cold', 'fresh', 'stale']);
const refreshValues = new Set(['background', 'foreground', 'none']);
const stateValues = new Set(['fresh', 'stale']);
const serverTimingPattern = /(?:^|,)\s*harmoniarr-cache;desc="(cold|fresh|stale)\/(background|foreground|none)\/(fresh|stale)"(?:;dur=(\d+))?\s*(?=,|$)/u;

function assertAllowedValue(value, allowedValues, label) {
  if (!allowedValues.has(value)) {
    throw new Error(`Artist Detail cache browser evidence ${label} is invalid`);
  }
}

function normalizeDuration(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Artist Detail cache browser evidence ${label} is invalid`);
  }

  return Math.round(value);
}

function createClientTiming(resourceTiming) {
  const clientRequestDurationMs = normalizeDuration(resourceTiming?.durationMs, 'client duration');
  const responseEndMs = normalizeDuration(resourceTiming?.responseEndMs, 'response end');
  const startTimeMs = normalizeDuration(resourceTiming?.startTimeMs, 'start time');

  if (responseEndMs < startTimeMs) {
    throw new Error('Artist Detail cache browser evidence timing order is invalid');
  }

  return Object.freeze({
    clientRequestDurationMs,
    responseEndMs,
    startTimeMs,
  });
}

function parseArtistDetailCacheServerTiming(serverTiming) {
  if (typeof serverTiming !== 'string') {
    throw new Error('Artist Detail cache browser evidence Server-Timing is missing');
  }

  const match = serverTiming.match(serverTimingPattern);
  if (!match) {
    throw new Error('Artist Detail cache browser evidence Server-Timing is invalid');
  }

  const [, lookup, refresh, state, duration] = match;
  assertAllowedValue(lookup, lookupValues, 'lookup');
  assertAllowedValue(refresh, refreshValues, 'refresh');
  assertAllowedValue(state, stateValues, 'state');

  return {
    description: `${lookup}/${refresh}/${state}`,
    lookup,
    refresh,
    serverRefreshDurationMs: duration == null ? null : Number.parseInt(duration, 10),
    state,
  };
}

function findCacheServerTimingMetric(serverTimingMetrics) {
  if (!Array.isArray(serverTimingMetrics)) {
    throw new Error('Artist Detail cache browser evidence Resource Timing is missing');
  }

  const metric = serverTimingMetrics.find((candidate) => candidate?.name === 'harmoniarr-cache');
  if (!metric || typeof metric.description !== 'string') {
    throw new Error('Artist Detail cache browser evidence metric is missing');
  }

  return metric;
}

/**
 * Builds a bounded assertion artifact from one same-origin Artist Detail
 * response. The returned shape intentionally excludes request URLs, IDs,
 * cache keys, payloads, headers, and browser session data.
 */
export function buildArtistDetailCacheBrowserEvidence({
  endpoint,
  phase,
  resourceTiming,
  serverTiming,
}) {
  assertAllowedValue(endpoint, endpointValues, 'endpoint');
  assertAllowedValue(phase, phaseValues, 'phase');

  const cache = parseArtistDetailCacheServerTiming(serverTiming);
  const clientTiming = createClientTiming(resourceTiming);
  const metric = findCacheServerTimingMetric(resourceTiming?.serverTiming);

  if (metric.description !== cache.description) {
    throw new Error('Artist Detail cache browser evidence metric description does not match the response');
  }

  if (cache.serverRefreshDurationMs !== null
    && normalizeDuration(metric.durationMs, 'server refresh duration') !== cache.serverRefreshDurationMs) {
    throw new Error('Artist Detail cache browser evidence metric duration does not match the response');
  }

  return Object.freeze({
    cache: Object.freeze({
      lookup: cache.lookup,
      refresh: cache.refresh,
      state: cache.state,
    }),
    endpoint,
    phase,
    timing: Object.freeze({
      clientRequestDurationMs: clientTiming.clientRequestDurationMs,
      serverRefreshDurationMs: cache.serverRefreshDurationMs,
    }),
  });
}

/**
 * Builds a bounded timing artifact for the authenticated local-metadata and
 * operator-projection legs that precede the provider-backed Discography path.
 * Request URLs, identifiers, payloads, sessions, and headers are excluded.
 */
export function buildArtistDetailRequestTimingEvidence({ endpoint, resourceTiming }) {
  assertAllowedValue(endpoint, requestTimingEndpointValues, 'request timing endpoint');

  return Object.freeze({
    endpoint,
    timing: createClientTiming(resourceTiming),
  });
}
