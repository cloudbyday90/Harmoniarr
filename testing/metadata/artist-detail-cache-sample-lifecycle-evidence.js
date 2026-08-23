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

import { performance } from 'node:perf_hooks';
import { artistDetailCacheSampleCatalog } from './artist-detail-cache-sample-catalog.js';
import {
  assertArtistDetailCacheSampleRead,
  normalizeArtistDetailCacheSampleCatalog,
  normalizeArtistDetailCacheSampleLimit,
} from './artist-detail-cache-sample-workload-contract.js';

const defaultReleaseGroupLimit = 25;
const defaultSimilarArtistLimit = 8;
const lifecyclePhases = new Set(['cold', 'fresh', 'stale', 'expired']);
const lookupStates = ['cold', 'fresh', 'stale'];
const responseStates = ['fresh', 'miss', 'stale'];
const refreshModes = ['background', 'foreground', 'none'];

function createCounts(values) {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

function assertLifecyclePhase(phase) {
  if (!lifecyclePhases.has(phase)) {
    throw new Error('phase must be cold, fresh, stale, or expired');
  }
}

function assertMonotonicClock(nowMsFn) {
  if (typeof nowMsFn !== 'function') {
    throw new Error('nowMsFn must be a function');
  }
}

function getCacheMetadata(response, operation) {
  const cache = response?.cache;
  if (!cache || typeof cache !== 'object') {
    throw new Error(`${operation} response must include cache metadata`);
  }
  if (!lookupStates.includes(cache.lookup)) {
    throw new Error(`${operation} cache lookup must be cold, fresh, or stale`);
  }
  if (!responseStates.includes(cache.state)) {
    throw new Error(`${operation} cache state must be fresh, miss, or stale`);
  }
  if (!refreshModes.includes(cache.refresh)) {
    throw new Error(`${operation} cache refresh must be background, foreground, or none`);
  }

  return cache;
}

function calculateP95(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

function createOperationEvidence() {
  return {
    cacheLookups: createCounts(lookupStates),
    cacheStates: createCounts(responseStates),
    refreshModes: createCounts(refreshModes),
    responseDurationsMs: [],
  };
}

function recordOperationEvidence(evidence, cache, responseDurationMs) {
  evidence.cacheLookups[cache.lookup] += 1;
  evidence.cacheStates[cache.state] += 1;
  evidence.refreshModes[cache.refresh] += 1;
  evidence.responseDurationsMs.push(responseDurationMs);
}

function finalizeOperationEvidence(evidence) {
  const responseDurationMs = Object.freeze({
    p95: calculateP95(evidence.responseDurationsMs),
    sampleCount: evidence.responseDurationsMs.length,
  });

  return Object.freeze({
    cacheLookups: Object.freeze(evidence.cacheLookups),
    cacheStates: Object.freeze(evidence.cacheStates),
    refreshModes: Object.freeze(evidence.refreshModes),
    responseDurationMs,
  });
}

async function observeRead({ evidence, nowMsFn, operation, read }) {
  const startedAt = nowMsFn();
  if (!Number.isFinite(startedAt)) {
    throw new Error('nowMsFn must return a finite number');
  }

  const response = await read();
  const completedAt = nowMsFn();
  if (!Number.isFinite(completedAt) || completedAt < startedAt) {
    throw new Error('nowMsFn must be monotonic and return finite numbers');
  }

  recordOperationEvidence(
    evidence,
    getCacheMetadata(response, operation),
    Math.round(completedAt - startedAt),
  );
}

/**
 * Collects bounded, test-only Artist Detail cache evidence for one lifecycle
 * phase. It intentionally retains only aggregate cache states and durations;
 * artist identifiers, cache keys, payloads, and provider details are not part
 * of the result.
 */
export async function collectArtistDetailCacheSampleLifecycleEvidence({
  browseArtistReleaseGroups,
  catalog = artistDetailCacheSampleCatalog,
  getSimilarArtists,
  nowMsFn = () => performance.now(),
  phase,
  releaseGroupLimit = defaultReleaseGroupLimit,
  similarArtistLimit = defaultSimilarArtistLimit,
} = {}) {
  assertLifecyclePhase(phase);
  assertArtistDetailCacheSampleRead(browseArtistReleaseGroups, 'browseArtistReleaseGroups');
  assertArtistDetailCacheSampleRead(getSimilarArtists, 'getSimilarArtists');
  assertMonotonicClock(nowMsFn);

  const samples = normalizeArtistDetailCacheSampleCatalog(catalog);
  const normalizedReleaseGroupLimit = normalizeArtistDetailCacheSampleLimit(
    releaseGroupLimit,
    'releaseGroupLimit',
  );
  const normalizedSimilarArtistLimit = normalizeArtistDetailCacheSampleLimit(
    similarArtistLimit,
    'similarArtistLimit',
  );
  const discography = createOperationEvidence();
  const relatedArtists = createOperationEvidence();

  for (const { musicBrainzArtistId } of samples) {
    await Promise.all([
      observeRead({
        evidence: discography,
        nowMsFn,
        operation: 'Discography',
        read: () => browseArtistReleaseGroups({
          artistId: musicBrainzArtistId,
          limit: normalizedReleaseGroupLimit,
          offset: 0,
        }),
      }),
      observeRead({
        evidence: relatedArtists,
        nowMsFn,
        operation: 'related artists',
        read: () => getSimilarArtists({
          artistMbid: musicBrainzArtistId,
          limit: normalizedSimilarArtistLimit,
        }),
      }),
    ]);
  }

  return Object.freeze({
    artistCount: samples.length,
    discography: finalizeOperationEvidence(discography),
    phase,
    relatedArtists: finalizeOperationEvidence(relatedArtists),
  });
}

/**
 * Adds the aggregate upstream-call delta observed by an integration harness.
 * The count remains phase-scoped and cannot contain provider request details.
 */
export function withArtistDetailCacheSampleUpstreamCallCount(evidence, upstreamCallCount) {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('lifecycle evidence is required');
  }
  if (!Number.isSafeInteger(upstreamCallCount) || upstreamCallCount < 0) {
    throw new Error('upstreamCallCount must be a non-negative safe integer');
  }

  return Object.freeze({
    ...evidence,
    upstreamCallCount,
  });
}
